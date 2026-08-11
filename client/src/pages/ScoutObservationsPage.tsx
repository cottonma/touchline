import { useState, useEffect, useCallback } from 'react';
import { Eye, Plus, User, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useFixtures } from '@/hooks/use-fixtures';
import { usePlayers } from '@/hooks/use-players';
import { api } from '@/lib/api';

interface Observation {
  id: string;
  fixtureId: string;
  playerId: string | null;
  period: number | null;
  matchMinute: number | null;
  developmentArea: string;
  observationType: string;
  observation: string;
  followUp: string | null;
  createdAt: string;
}

const AREAS = ['physical', 'technical', 'mental', 'teamwork'] as const;
const AREA_LABELS: Record<string, string> = { physical: 'Physical', technical: 'Technical', mental: 'Mental', teamwork: 'Teamwork' };
const AREA_COLORS: Record<string, string> = { physical: 'bg-blue-100 text-blue-800', technical: 'bg-emerald-100 text-emerald-800', mental: 'bg-purple-100 text-purple-800', teamwork: 'bg-amber-100 text-amber-800' };
const TYPE_LABELS: Record<string, string> = { strength: '💪 Strength', development: '🎯 Development', general: '📝 General' };

/**
 * Scout Observations Page — Our Team observations during matches.
 * Quick entry optimised for sideline use.
 */
export function ScoutObservationsPage() {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | undefined>();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formPlayerId, setFormPlayerId] = useState<string>('');
  const [formArea, setFormArea] = useState<string>('technical');
  const [formType, setFormType] = useState<string>('general');
  const [formPeriod, setFormPeriod] = useState<string>('');
  const [formText, setFormText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: fixtures } = useFixtures({ status: 'scheduled' });
  const { data: completedFixtures } = useFixtures({ status: 'completed' });
  const { data: players } = usePlayers();

  const allFixtures = [
    ...(fixtures?.filter(f => f.type !== 'training') ?? []),
    ...(completedFixtures?.filter(f => f.type !== 'training') ?? []),
  ];

  if (!selectedFixtureId && allFixtures.length > 0) {
    setSelectedFixtureId(allFixtures[0].id);
  }

  const fetchObservations = useCallback(async () => {
    if (!selectedFixtureId) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: Observation[] }>(`/scout-observations?fixtureId=${selectedFixtureId}`);
      setObservations(res.data ?? []);
    } catch { setObservations([]); }
    setLoading(false);
  }, [selectedFixtureId]);

  useEffect(() => { fetchObservations(); }, [fetchObservations]);

  const handleSubmit = async () => {
    if (!selectedFixtureId || !formText.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/scout-observations', {
        fixtureId: selectedFixtureId,
        playerId: formPlayerId || undefined,
        period: formPeriod ? Number(formPeriod) : undefined,
        developmentArea: formArea,
        observationType: formType,
        observation: formText.trim(),
      });
      setFormText('');
      setShowForm(false);
      fetchObservations();
    } catch {}
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/scout-observations/${id}`);
      setObservations(prev => prev.filter(o => o.id !== id));
    } catch {}
  };

  // Group observations: team-level first, then by player
  const teamObs = observations.filter(o => !o.playerId);
  const playerObs = observations.filter(o => o.playerId);
  const playerGroups = new Map<string, Observation[]>();
  for (const obs of playerObs) {
    const existing = playerGroups.get(obs.playerId!) ?? [];
    existing.push(obs);
    playerGroups.set(obs.playerId!, existing);
  }

  const selectedFixture = allFixtures.find(f => f.id === selectedFixtureId);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Scout — Our Team</h2>
        <p className="text-sm text-muted-foreground">Record development observations during matches.</p>
      </div>

      {/* Fixture selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {allFixtures.map(fixture => (
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

      {/* Quick add buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => { setShowForm(true); setFormType('general'); }}>
          <Plus className="h-3.5 w-3.5" /> Add Observation
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setFormType('strength'); }}>
          💪 Strength
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setFormType('development'); }}>
          🎯 Development
        </Button>
      </div>

      {/* Quick entry form */}
      {showForm && (
        <Card className="border-primary/50">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Player (or Team)</label>
                <Select value={formPlayerId} onChange={(e) => setFormPlayerId(e.target.value)} className="h-9 text-xs">
                  <option value="">🏟️ Team observation</option>
                  {players?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Area</label>
                <Select value={formArea} onChange={(e) => setFormArea(e.target.value)} className="h-9 text-xs">
                  {AREAS.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Type</label>
                <Select value={formType} onChange={(e) => setFormType(e.target.value)} className="h-9 text-xs">
                  <option value="general">📝 General</option>
                  <option value="strength">💪 Strength</option>
                  <option value="development">🎯 Development</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Quarter (optional)</label>
                <Select value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)} className="h-9 text-xs">
                  <option value="">—</option>
                  <option value="1">Q1</option>
                  <option value="2">Q2</option>
                  <option value="3">Q3</option>
                  <option value="4">Q4</option>
                </Select>
              </div>
            </div>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="What did you observe?"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !formText.trim()}>
                {submitting ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observations list */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading observations...</p>
      ) : observations.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Eye className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No observations yet for this fixture.</p>
          <p className="text-xs text-muted-foreground mt-1">Use the buttons above to capture observations during the match.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Team observations */}
          {teamObs.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" /> Team Observations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {teamObs.map(obs => (
                  <ObservationRow key={obs.id} obs={obs} onDelete={handleDelete} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Player observations grouped */}
          {[...playerGroups.entries()].map(([playerId, obs]) => {
            const player = players?.find(p => p.id === playerId);
            return (
              <Card key={playerId}>
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {player ? `${player.firstName} ${player.lastName}` : 'Unknown'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {obs.map(o => <ObservationRow key={o.id} obs={o} onDelete={handleDelete} />)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ObservationRow({ obs, onDelete }: { obs: Observation; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-start gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${AREA_COLORS[obs.developmentArea]}`}>
            {AREA_LABELS[obs.developmentArea]}
          </span>
          {obs.observationType !== 'general' && (
            <span className="text-[10px]">{TYPE_LABELS[obs.observationType]}</span>
          )}
          {obs.period && <span className="text-[10px] text-muted-foreground">Q{obs.period}</span>}
        </div>
        <p className="text-xs">{obs.observation}</p>
        {obs.followUp && <p className="text-xs text-primary mt-1 italic">↳ {obs.followUp}</p>}
      </div>
      <button onClick={() => onDelete(obs.id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
