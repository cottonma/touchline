import { useState, useEffect, useMemo } from 'react';
import { Trophy, Check, Plus, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PitchView, getFormationSlots, type PitchSlot } from '@/components/match-planning/PitchView';
import { PlayingTimeTable } from '@/components/match-planning/PlayingTimeTable';
import { useFixtures } from '@/hooks/use-fixtures';
import { usePlayers } from '@/hooks/use-players';
import { api } from '@/lib/api';
import type { PlayerForSelection } from '@/services/team-selection.service';

interface PeriodScore {
  period: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface GoalEntry {
  scorerId: string;
  assistId?: string;
  period?: number;
}

interface SlotData {
  period: number;
  playerId: string;
  position: string;
  isGk: boolean;
  startMinute: number;
  endMinute: number;
}

interface MatchPlan {
  id: string;
  fixtureId: string;
  status: string;
  formation: string | null;
  periods: number;
  periodDurationMinutes: string;
  matchDurationMinutes: number;
  outfieldSlots: number;
}

/**
 * Match Day Page V2 — uses the match plan as source of truth.
 * Flow: Load ready plan → show lineups → record period scores → complete match.
 */
export function MatchDayPageV2() {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | undefined>();
  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [periodScores, setPeriodScores] = useState<PeriodScore[]>([]);
  const [goalEntries, setGoalEntries] = useState<GoalEntry[]>([]);
  const [motmPlayerId, setMotmPlayerId] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motmTally, setMotmTally] = useState<{ totalVotes: number; results: { playerId: string; playerName: string; votes: number }[] } | null>(null);

  const { data: fixtures } = useFixtures({ status: 'scheduled' });
  const { data: completedFixtures } = useFixtures({ status: 'completed' });
  const { data: players } = usePlayers();

  const allMatchFixtures = [
    ...(fixtures?.filter(f => f.type !== 'training') ?? []),
    ...(completedFixtures?.filter(f => f.type !== 'training') ?? []),
  ];

  if (!selectedFixtureId && allMatchFixtures.length > 0) {
    setSelectedFixtureId(allMatchFixtures[0].id);
  }

  const selectedFixture = allMatchFixtures.find(f => f.id === selectedFixtureId);

  // Fetch club name
  useEffect(() => {
    api.get<any[]>('/auth/clubs').then(clubs => {
      const activeClub = localStorage.getItem('touchline_active_club');
      const club = clubs.find((c: any) => c.id === activeClub) ?? clubs[0];
      if (club) setClubName(club.name || 'Our Team');
    }).catch(() => {});
  }, []);

  // Load match plan
  useEffect(() => {
    if (!selectedFixtureId) return;
    setLoading(true);
    setError(null);
    setCompleted(false);
    api.get<{ data: { plan: MatchPlan; slots: SlotData[] } }>(`/match-plans/${selectedFixtureId}`)
      .then(res => {
        setPlan(res.data.plan);
        setSlots(res.data.slots);
        // Init period scores
        const ps: PeriodScore[] = Array.from({ length: res.data.plan.periods }, (_, i) => ({
          period: i + 1, goalsFor: 0, goalsAgainst: 0,
        }));
        setPeriodScores(ps);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    // Fetch MOTM votes
    api.get<{ data: { totalVotes: number; results: any[] } }>(`/match-plans/${selectedFixtureId}/motm-votes`)
      .then(res => setMotmTally(res.data))
      .catch(() => setMotmTally(null));
  }, [selectedFixtureId]);

  const formation = plan?.formation ?? '2-3-1';
  const periodDuration = Number(plan?.periodDurationMinutes ?? 12);
  const totalPeriods = plan?.periods ?? 4;
  const matchDuration = plan?.matchDurationMinutes ?? 48;

  const availablePlayers: PlayerForSelection[] = useMemo(() =>
    (players ?? []).map(p => ({
      id: p.id, firstName: p.firstName, lastName: p.lastName,
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition ?? null,
      tertiaryPosition: p.tertiaryPosition ?? null,
      isGkVolunteer: p.isGkVolunteer,
    })), [players]);

  // Final score (internal: goalsFor = our goals, goalsAgainst = opponent)
  const totalGoalsFor = periodScores.reduce((s, p) => s + p.goalsFor, 0);
  const totalGoalsAgainst = periodScores.reduce((s, p) => s + p.goalsAgainst, 0);

  // Are we the away side for this fixture?
  const isAway = selectedFixture?.homeAway === 'away';

  // Scores are entered as HOME – AWAY. We convert to our internal
  // goalsFor/goalsAgainst based on whether we're home or away.
  const handleHomeAwayScore = (period: number, side: 'home' | 'away', value: number) => {
    // Which internal field does this side map to?
    // If we're home: home=goalsFor, away=goalsAgainst.
    // If we're away: home=goalsAgainst, away=goalsFor.
    const field: 'goalsFor' | 'goalsAgainst' =
      (side === 'home') === !isAway ? 'goalsFor' : 'goalsAgainst';
    setPeriodScores(prev => prev.map(ps =>
      ps.period === period ? { ...ps, [field]: value } : ps
    ));
  };

  // Read a period's score for a given side (home/away) from internal fields
  const periodSideValue = (ps: PeriodScore, side: 'home' | 'away'): number => {
    if (!isAway) return side === 'home' ? ps.goalsFor : ps.goalsAgainst;
    return side === 'home' ? ps.goalsAgainst : ps.goalsFor;
  };

  // Complete match
  const handleComplete = async () => {
    if (!selectedFixtureId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/match-plans/${selectedFixtureId}/complete`, {
        periodScores,
        coachNotes: coachNotes || undefined,
        motmPlayerId: motmPlayerId || undefined,
        goals: goalEntries.filter(g => g.scorerId),
      });
      setCompleted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to complete match');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Match Day</h2>
        <p className="text-sm text-muted-foreground">Record the match as it happens.</p>
      </div>

      {/* Fixture selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {allMatchFixtures.map(fixture => (
          <button
            key={fixture.id}
            onClick={() => setSelectedFixtureId(fixture.id)}
            className={`flex-shrink-0 rounded-lg border px-4 py-2 text-sm min-h-[44px] transition-colors ${
              selectedFixtureId === fixture.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border'
            }`}
          >
            <div className="font-medium">vs {fixture.opponent}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(fixture.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </button>
        ))}
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {completed && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-emerald-800">
          <div className="flex items-center gap-2 font-medium"><Check className="h-5 w-5" /> Match Completed</div>
          <p className="text-sm mt-1">
            {clubName} {totalGoalsFor} – {totalGoalsAgainst} {selectedFixture?.opponent}.
            Player minutes recorded.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading match plan...</div>
      ) : plan && !completed ? (
        <>
          {/* Match header */}
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold">
                  {selectedFixture?.homeAway === 'away' ? selectedFixture?.opponent : clubName}
                  <span className="mx-3 text-2xl font-bold">
                    {selectedFixture?.homeAway === 'away' ? totalGoalsAgainst : totalGoalsFor}
                    {' – '}
                    {selectedFixture?.homeAway === 'away' ? totalGoalsFor : totalGoalsAgainst}
                  </span>
                  {selectedFixture?.homeAway === 'away' ? clubName : selectedFixture?.opponent}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Period scores — entered as HOME – AWAY. The app works out which is ours from the fixture. */}
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs">Period Scores (Home – Away)</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Enter the score as home team – away team. You're the {isAway ? 'away' : 'home'} side for this fixture, so your goals go {isAway ? 'on the right' : 'on the left'}.
              </p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {periodScores.map(ps => (
                  <div key={ps.period} className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold w-6">Q{ps.period}</span>
                    <div className="flex flex-col items-center">
                      <span className={`text-[8px] font-medium leading-none mb-0.5 max-w-[3rem] truncate ${!isAway ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {!isAway ? clubName : (selectedFixture?.opponent ?? 'Opp')}
                      </span>
                      <Input
                        type="number" min={0} max={20}
                        value={periodSideValue(ps, 'home') || ''}
                        onChange={(e) => handleHomeAwayScore(ps.period, 'home', Number(e.target.value) || 0)}
                        className="w-10 h-7 text-center text-xs p-0"
                        placeholder="0"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-3">–</span>
                    <div className="flex flex-col items-center">
                      <span className={`text-[8px] font-medium leading-none mb-0.5 max-w-[3rem] truncate ${isAway ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {isAway ? clubName : (selectedFixture?.opponent ?? 'Opp')}
                      </span>
                      <Input
                        type="number" min={0} max={20}
                        value={periodSideValue(ps, 'away') || ''}
                        onChange={(e) => handleHomeAwayScore(ps.period, 'away', Number(e.target.value) || 0)}
                        className="w-10 h-7 text-center text-xs p-0"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Full match view — all periods as compact pitches + edit button */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Match Plan</span>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => {
                // Navigate to team selection to edit the plan
                window.location.href = `/team-selection?fixture=${selectedFixtureId}`;
              }}>
                Edit Plan (injuries/no-shows)
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Array.from({ length: totalPeriods }, (_, i) => i + 1).map(period => {
                const pSlots = slots.filter(s => s.period === period);
                const formSlots = getFormationSlots(formation);
                const pPitchSlots: PitchSlot[] = formSlots.map(fs => {
                  const posSlots = pSlots.filter(s => {
                    if (fs.isGk && s.isGk) return true;
                    return s.position === fs.position && !s.isGk;
                  }).sort((a, b) => a.startMinute - b.startMinute);
                  if (posSlots.length === 0) return fs;
                  const segments = posSlots.map(s => {
                    const p = availablePlayers.find(pl => pl.id === s.playerId);
                    return { playerId: s.playerId, playerName: p ? `${p.firstName} ${p.lastName}` : '?', startMinute: s.startMinute, endMinute: s.endMinute, isGk: s.isGk };
                  });
                  const first = availablePlayers.find(p => p.id === posSlots[0].playerId);
                  return { ...fs, playerId: posSlots[0].playerId, playerName: first ? `${first.firstName} ${first.lastName}` : '?', segments: segments.length > 1 ? segments : undefined };
                });
                return (
                  <div key={period}>
                    <span className="text-[10px] font-bold block text-center mb-0.5">Q{period}</span>
                    <PitchView formation={formation} slots={pPitchSlots} availablePlayers={availablePlayers} periodDuration={periodDuration} compact />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Playing Time table — directly under match view */}
          <PlayingTimeTable
            slots={slots}
            players={availablePlayers}
            periods={totalPeriods}
            periodDuration={periodDuration}
            matchDuration={matchDuration}
            outfieldSlots={plan?.outfieldSlots ?? 6}
          />

          {/* Goals & Assists */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Goals & Assists</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {goalEntries.map((goal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={goal.scorerId} onChange={(e) => { const u = [...goalEntries]; u[idx].scorerId = e.target.value; setGoalEntries(u); }} className="flex-1 h-9 text-xs">
                    <option value="">Scorer...</option>
                    {players?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                  </Select>
                  <Select value={goal.assistId ?? ''} onChange={(e) => { const u = [...goalEntries]; u[idx].assistId = e.target.value || undefined; setGoalEntries(u); }} className="flex-1 h-9 text-xs">
                    <option value="">Assist...</option>
                    {players?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                  </Select>
                  <Select value={String(goal.period ?? '')} onChange={(e) => { const u = [...goalEntries]; u[idx].period = Number(e.target.value) || undefined; setGoalEntries(u); }} className="w-16 h-9 text-xs">
                    <option value="">Q?</option>
                    {Array.from({ length: totalPeriods }, (_, i) => <option key={i + 1} value={i + 1}>Q{i + 1}</option>)}
                  </Select>
                  <button onClick={() => setGoalEntries(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setGoalEntries([...goalEntries, { scorerId: '' }])}>
                <Plus className="h-3.5 w-3.5" /> Add Goal
              </Button>
            </CardContent>
          </Card>

          {/* MOTM + Notes */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Man of the Match & Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Man of the Match</Label>
                <Select value={motmPlayerId} onChange={(e) => setMotmPlayerId(e.target.value)} className="h-9 text-xs">
                  <option value="">Select MOTM...</option>
                  {players?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Coach Notes</Label>
                <textarea
                  value={coachNotes}
                  onChange={(e) => setCoachNotes(e.target.value)}
                  placeholder="Observations, areas to improve..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {/* Scout Observations link */}
          <Button
            variant="outline"
            className="w-full justify-start h-10 text-xs"
            onClick={() => window.location.href = `/scout-observations?fixture=${selectedFixtureId}`}
          >
            <Eye className="h-4 w-4" /> Scout Observations — Record observations for this match
          </Button>

          {/* MOTM Votes — show parent votes tally */}
          {motmTally && motmTally.totalVotes > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Parent MOTM Votes ({motmTally.totalVotes})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-1.5">
                  {motmTally.results.map((entry, i) => (
                    <div key={entry.playerId} className="flex items-center gap-2">
                      {i === 0 && <span className="text-base">🏆</span>}
                      {i === 1 && <span className="text-base">🥈</span>}
                      {i === 2 && <span className="text-base">🥉</span>}
                      {i > 2 && <span className="w-6" />}
                      <span className={`text-sm flex-1 ${i === 0 ? 'font-bold' : ''}`}>{entry.playerName}</span>
                      <span className="text-sm font-bold tabular-nums">{entry.votes}</span>
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(entry.votes / motmTally.totalVotes) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Complete Match */}
          <Button className="w-full h-12 text-base" onClick={handleComplete} disabled={submitting}>
            <Trophy className="h-5 w-5" />
            {submitting ? 'Completing...' : 'Complete Match'}
          </Button>
        </>
      ) : !loading && !plan ? (
        <div className="text-center py-12 text-muted-foreground">
          No match plan found. Create a team selection first.
        </div>
      ) : null}
    </div>
  );
}
