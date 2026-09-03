import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Public, no-login availability page.
 *
 * A coach shares one link (per club) in the team WhatsApp group. A parent
 * opens it, picks which player they are responding for, and sets availability
 * for each upcoming fixture. Writes into the same availability data the coach
 * manages manually.
 */

interface PublicPlayer {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
}

interface PublicFixture {
  id: string;
  opponent: string | null;
  location: string | null;
  date: string;
  kickOffTime: string | null;
  homeAway: string | null;
}

interface PublicStatus {
  fixtureId: string;
  playerId: string;
  status: string;
}

interface PublicData {
  clubName: string;
  players: PublicPlayer[];
  fixtures: PublicFixture[];
  statuses: PublicStatus[];
}

export function PublicAvailabilityPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [saving, setSaving] = useState<string | null>(null);
  // Local overrides so the UI updates instantly after a tap
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/public/availability/${token}`);
      if (!res.ok) {
        setError('This availability link is not valid. Please ask your coach for a new one.');
        return;
      }
      const json = await res.json();
      setData(json.data);
      // Remember the last player picked on this device
      const remembered = localStorage.getItem(`touchline_avail_player_${token}`);
      if (remembered && json.data.players.some((p: PublicPlayer) => p.id === remembered)) {
        setPlayerId(remembered);
      }
    } catch {
      setError('Could not load fixtures. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const statusFor = (fixtureId: string): string => {
    const key = `${fixtureId}:${playerId}`;
    if (localStatus[key]) return localStatus[key];
    const found = data?.statuses.find((s) => s.fixtureId === fixtureId && s.playerId === playerId);
    return found?.status ?? 'unknown';
  };

  const setStatus = async (fixtureId: string, status: 'available' | 'unavailable') => {
    if (!token || !playerId) return;
    setSaving(fixtureId);
    const key = `${fixtureId}:${playerId}`;
    // Optimistic update
    setLocalStatus((prev) => ({ ...prev, [key]: status }));
    try {
      const res = await fetch(`/api/public/availability/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId, playerId, status }),
      });
      if (!res.ok) {
        // Revert on failure
        setLocalStatus((prev) => { const n = { ...prev }; delete n[key]; return n; });
        setError('Could not save. Please try again.');
      }
    } catch {
      setLocalStatus((prev) => { const n = { ...prev }; delete n[key]; return n; });
      setError('Could not save. Please check your connection.');
    } finally {
      setSaving(null);
    }
  };

  const onPickPlayer = (id: string) => {
    setPlayerId(id);
    if (token) localStorage.setItem(`touchline_avail_player_${token}`, id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <span className="text-4xl">⚽</span>
          <p className="text-slate-500 mt-2">Loading fixtures...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <span className="text-4xl">⚠️</span>
          <p className="text-slate-700 mt-3">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="text-center py-3">
          <p className="text-2xl">⚽</p>
          <h1 className="text-xl font-bold text-slate-900">{data?.clubName}</h1>
          <p className="text-sm text-slate-500">Player availability</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Player picker */}
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <label className="text-sm font-medium text-slate-700">Who are you responding for?</label>
          <select
            value={playerId}
            onChange={(e) => onPickPlayer(e.target.value)}
            className="w-full h-11 rounded-md border border-slate-300 bg-white px-3 text-base"
          >
            <option value="">Select your player…</option>
            {data?.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}{p.shirtNumber ? ` (#${p.shirtNumber})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Fixtures */}
        {!playerId ? (
          <p className="text-center text-sm text-slate-500 py-6">Choose your player above to set availability.</p>
        ) : data && data.fixtures.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-6">No upcoming fixtures right now.</p>
        ) : (
          <div className="space-y-3">
            {data?.fixtures.map((f) => {
              const status = statusFor(f.id);
              const venue = f.homeAway === 'home' ? 'Home' : f.homeAway === 'away' ? 'Away' : '';
              return (
                <div key={f.id} className="bg-white rounded-lg border p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {f.homeAway === 'away' ? '@' : 'vs'} {f.opponent || 'TBC'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {new Date(f.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {f.kickOffTime && ` — KO ${f.kickOffTime}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[f.location, venue].filter(Boolean).join(' · ') || 'Venue TBC'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatus(f.id, 'available')}
                      disabled={saving === f.id}
                      className={`flex-1 min-h-[48px] rounded-lg text-sm font-medium transition-colors ${
                        status === 'available'
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-green-50'
                      }`}
                    >
                      ✓ Available
                    </button>
                    <button
                      onClick={() => setStatus(f.id, 'unavailable')}
                      disabled={saving === f.id}
                      className={`flex-1 min-h-[48px] rounded-lg text-sm font-medium transition-colors ${
                        status === 'unavailable'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-red-50'
                      }`}
                    >
                      ✗ Not available
                    </button>
                  </div>
                  {status === 'unknown' && (
                    <p className="text-xs text-slate-400 text-center">Not yet responded</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pt-4">
          Your responses are saved automatically. You can change them any time from this link.
        </p>
      </div>
    </div>
  );
}
