import { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle, Trophy, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  primaryPosition: string;
  isActive: boolean;
}

interface Fixture {
  id: string;
  type: string;
  opponent: string | null;
  location: string | null;
  date: string;
  kickOffTime: string | null;
  homeAway: string | null;
  status: string;
}

interface AvailabilityStatus {
  fixtureId: string;
  status: 'available' | 'unavailable' | 'unknown';
}

interface MotmVote {
  id: string;
  fixtureId: string;
  voterId: string;
  playerId: string;
}

/**
 * Parent Portal page.
 * Shows upcoming fixtures, availability toggle, and MOTM voting.
 */
export function ParentPage() {
  const { user } = useAuth();
  const [child, setChild] = useState<Player | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string>>({});
  const [motmVotes, setMotmVotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState<string | null>(null);
  const [savingMotm, setSavingMotm] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [childData, fixturesData, playersData] = await Promise.all([
        api.get<Player>('/parent/my-child').catch(() => null),
        api.get<Fixture[]>('/parent/fixtures').catch(() => []),
        api.get<Player[]>('/players').catch(() => []),
      ]);

      setChild(childData);
      setFixtures(fixturesData);
      setAllPlayers(playersData);

      // Fetch availability for each fixture from the availability endpoint
      // We'll check the availability status from the fixtures data
      if (childData && fixturesData.length > 0) {
        const avMap: Record<string, string> = {};
        for (const fixture of fixturesData) {
          try {
            const avData = await api.get<any[]>(`/fixtures/${fixture.id}/availability`);
            const childAv = avData.find((a: any) => a.playerId === childData.id);
            if (childAv) {
              avMap[fixture.id] = childAv.status;
            }
          } catch {}
        }
        setAvailabilityMap(avMap);
      }

      // Fetch MOTM votes for completed fixtures
      if (fixturesData.length > 0) {
        const voteMap: Record<string, string> = {};
        const completedFixtures = fixturesData.filter((f) => f.status === 'completed');
        for (const fixture of completedFixtures) {
          try {
            const data = await api.get<{ vote: MotmVote | null }>(`/parent/motm/${fixture.id}`);
            if (data.vote) {
              voteMap[fixture.id] = data.vote.playerId;
            }
          } catch {}
        }
        setMotmVotes(voteMap);
      }
    } catch (err) {
      console.error('Failed to load parent data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAvailability = async (fixtureId: string, status: 'available' | 'unavailable') => {
    setSavingAvailability(fixtureId);
    try {
      await api.post('/parent/availability', { fixtureId, status });
      setAvailabilityMap((prev) => ({ ...prev, [fixtureId]: status }));
    } catch (err) {
      console.error('Failed to update availability', err);
    } finally {
      setSavingAvailability(null);
    }
  };

  const handleMotmVote = async (fixtureId: string, playerId: string) => {
    setSavingMotm(true);
    try {
      await api.post('/parent/motm', { fixtureId, playerId });
      setMotmVotes((prev) => ({ ...prev, [fixtureId]: playerId }));
    } catch (err: any) {
      alert(err.message || 'Failed to cast vote');
    } finally {
      setSavingMotm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="text-4xl">⚽</span>
          <p className="text-slate-400 mt-2">Loading parent portal...</p>
        </div>
      </div>
    );
  }

  const upcomingFixtures = fixtures.filter((f) => f.status === 'scheduled' && f.type === 'match');
  const completedFixtures = fixtures.filter((f) => f.status === 'completed' && f.type === 'match');

  // Players eligible for MOTM vote (all active players except own child)
  const eligiblePlayers = allPlayers.filter((p) => p.isActive && p.id !== child?.id);

  return (
    <div className="space-y-6">
      {/* Header — child info */}
      <div className="flex items-center gap-3">
        <User className="w-6 h-6 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Parent Portal</h1>
          {child && (
            <p className="text-slate-400 text-sm">
              {child.firstName} {child.lastName} — {child.primaryPosition}
              {child.shirtNumber ? ` (#${child.shirtNumber})` : ''}
            </p>
          )}
          {!child && (
            <p className="text-yellow-400 text-sm">No child linked to your account. Ask your coach to link your player.</p>
          )}
        </div>
      </div>

      {/* Section 1: Upcoming Fixtures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Upcoming Fixtures
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingFixtures.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No upcoming fixtures.</p>
          ) : (
            <div className="space-y-3">
              {upcomingFixtures.map((fixture) => {
                const currentStatus = availabilityMap[fixture.id] || 'unknown';
                return (
                  <div
                    key={fixture.id}
                    className="border border-slate-700 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-100 font-medium">
                          {fixture.opponent || 'TBC'}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {new Date(fixture.date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                          {fixture.kickOffTime && ` — ${fixture.kickOffTime}`}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {fixture.location || 'TBC'} • {fixture.homeAway === 'home' ? 'Home' : fixture.homeAway === 'away' ? 'Away' : ''}
                        </p>
                      </div>
                      <Badge variant={fixture.homeAway === 'home' ? 'default' : 'secondary'}>
                        {fixture.homeAway === 'home' ? 'H' : fixture.homeAway === 'away' ? 'A' : '—'}
                      </Badge>
                    </div>

                    {/* Availability toggle */}
                    {child && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm mr-2">Availability:</span>
                        <button
                          onClick={() => handleAvailability(fixture.id, 'available')}
                          disabled={savingAvailability === fixture.id}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            currentStatus === 'available'
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-green-700 hover:text-white'
                          }`}
                        >
                          ✓ Available
                        </button>
                        <button
                          onClick={() => handleAvailability(fixture.id, 'unavailable')}
                          disabled={savingAvailability === fixture.id}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            currentStatus === 'unavailable'
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-red-700 hover:text-white'
                          }`}
                        >
                          ✗ Unavailable
                        </button>
                        {currentStatus === 'unknown' && (
                          <span className="text-slate-500 text-xs ml-2">Not set</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Man of the Match Voting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Man of the Match
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completedFixtures.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No completed fixtures to vote on yet.</p>
          ) : !child ? (
            <p className="text-yellow-400 text-center py-4">Link your child to vote.</p>
          ) : (
            <div className="space-y-4">
              {completedFixtures.map((fixture) => {
                const currentVote = motmVotes[fixture.id];
                const votedPlayer = allPlayers.find((p) => p.id === currentVote);
                return (
                  <div
                    key={fixture.id}
                    className="border border-slate-700 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-100 font-medium">
                          vs {fixture.opponent || 'Unknown'}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {new Date(fixture.date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>
                      {votedPlayer && (
                        <Badge variant="default" className="bg-yellow-600">
                          ⭐ {votedPlayer.firstName} {votedPlayer.lastName}
                        </Badge>
                      )}
                    </div>

                    {/* Player voting list */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {eligiblePlayers.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => handleMotmVote(fixture.id, player.id)}
                          disabled={savingMotm}
                          className={`px-3 py-2 rounded-md text-sm text-left transition-colors ${
                            currentVote === player.id
                              ? 'bg-yellow-600 text-white font-medium'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {player.firstName} {player.lastName}
                          {player.shirtNumber ? ` #${player.shirtNumber}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
