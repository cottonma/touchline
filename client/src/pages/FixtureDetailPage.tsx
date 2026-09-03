import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Ban, Trash2, MapPin, Clock, Target, Trophy, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useFixture, useCancelFixture, useDeleteFixture } from '@/hooks/use-fixtures';
import { FixtureForm } from '@/components/fixtures/FixtureForm';
import { api } from '@/lib/api';
import { usePlayers } from '@/hooks/use-players';
import { formatScoreline } from '@/lib/utils';

interface GoalEntry {
  scorerId: string;
  assistId?: string;
  period?: number;
}

const TYPE_LABELS: Record<string, string> = {
  match: 'Match',
  training: 'Training',
  friendly: 'Friendly',
  tournament: 'Tournament',
};

const OBJECTIVE_LABELS: Record<string, string> = {
  development: 'Development',
  balanced: 'Balanced',
  competitive: 'Competitive',
};

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  scheduled: 'secondary',
  completed: 'success',
  cancelled: 'outline',
};

/**
 * Fixture detail page - shows full fixture info, links to availability, team selection, match day.
 */
export function FixtureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: fixture, isLoading, error } = useFixture(id);
  const cancelFixture = useCancelFixture();
  const deleteFixture = useDeleteFixture();
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [matchRecord, setMatchRecord] = useState<any>(null);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<GoalEntry[]>([]);
  const [savingGoals, setSavingGoals] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const { data: players } = usePlayers();

  // Fetch match result for completed fixtures
  const loadMatchRecord = () => {
    if (id) {
      api.get<any>(`/fixtures/${id}/match-day`).then(res => {
        setMatchRecord(res?.data ?? res ?? null);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (fixture?.status === 'completed' && id) {
      loadMatchRecord();
    }
  }, [fixture?.status, id]);

  const startEditGoals = () => {
    const existing: GoalEntry[] = (matchRecord?.goals ?? []).map((g: any) => ({
      scorerId: g.scorerId,
      assistId: g.assistId || g.assistPlayerId || undefined,
      period: g.period ?? undefined,
    }));
    setGoalDraft(existing);
    setEditingGoals(true);
  };

  const saveGoals = async () => {
    if (!id) return;
    setSavingGoals(true);
    try {
      await api.put(`/match-plans/${id}/goals`, { goals: goalDraft.filter(g => g.scorerId) });
      setEditingGoals(false);
      loadMatchRecord();
    } catch (e) {
      // swallow — keep editor open so the coach can retry
    } finally {
      setSavingGoals(false);
    }
  };

  const totalPeriods = matchRecord?.result?.periodScores
    ? (JSON.parse(matchRecord.result.periodScores) as any[]).length
    : 4;

  const startEditNotes = () => {
    setNotesDraft(matchRecord?.result?.coachNotes ?? '');
    setEditingNotes(true);
  };

  const saveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    try {
      await api.put(`/match-plans/${id}/coach-notes`, { coachNotes: notesDraft });
      setEditingNotes(false);
      loadMatchRecord();
    } catch (e) {
      // keep editor open so the coach can retry
    } finally {
      setSavingNotes(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading fixture...</div>
      </div>
    );
  }

  if (error || !fixture) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/fixtures')}>
          <ArrowLeft className="h-4 w-4" /> Back to Fixtures
        </Button>
        <div className="flex items-center justify-center py-12">
          <div className="text-destructive">Fixture not found.</div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setIsEditing(false)}>
          <ArrowLeft className="h-4 w-4" /> Cancel Edit
        </Button>
        <FixtureForm
          fixture={fixture}
          onClose={() => setIsEditing(false)}
          onSuccess={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const handleCancel = async () => {
    await cancelFixture.mutateAsync(fixture.id);
    setShowConfirmCancel(false);
  };

  const handleDelete = async () => {
    await deleteFixture.mutateAsync(fixture.id);
    navigate('/fixtures');
  };

  const isMatch = fixture.type === 'match' || fixture.type === 'friendly' || fixture.type === 'tournament';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/fixtures')}>
        <ArrowLeft className="h-4 w-4" /> Back to Fixtures
      </Button>

      {/* Fixture header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={STATUS_COLORS[fixture.status] ?? 'secondary'}>
              {fixture.status.charAt(0).toUpperCase() + fixture.status.slice(1)}
            </Badge>
            <Badge variant="secondary">
              {TYPE_LABELS[fixture.type]}
            </Badge>
          </div>
          <h2 className="text-2xl font-bold">
            {fixture.type === 'training'
              ? 'Training Session'
              : `${fixture.homeAway === 'home' ? 'vs' : '@'} ${fixture.opponent}`}
          </h2>
          <p className="text-muted-foreground mt-1">
            {formatFullDate(fixture.date)}
            {fixture.kickOffTime && ` at ${fixture.kickOffTime}`}
          </p>
        </div>

        {fixture.status === 'scheduled' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmCancel(true)}
              className="text-destructive hover:text-destructive"
            >
              <Ban className="h-4 w-4" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        )}
      </div>

      {/* Cancel confirmation */}
      {showConfirmCancel && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm font-medium">Cancel this fixture?</p>
          <p className="text-sm text-muted-foreground mt-1">
            This will mark the fixture as cancelled. You can reschedule it later.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="destructive" onClick={handleCancel} disabled={cancelFixture.isPending}>
              {cancelFixture.isPending ? 'Cancelling...' : 'Yes, cancel it'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirmCancel(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showConfirmDelete && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm font-medium">Delete this fixture permanently?</p>
          <p className="text-sm text-muted-foreground mt-1">
            This cannot be undone. All related data will be lost.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteFixture.isPending}>
              {deleteFixture.isPending ? 'Deleting...' : 'Yes, delete'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Fixture details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fixture.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{fixture.location}</span>
              </div>
            )}
            {fixture.kickOffTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{fixture.kickOffTime}</span>
              </div>
            )}
            {fixture.matchObjective && (
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Objective: {OBJECTIVE_LABELS[fixture.matchObjective]}</span>
              </div>
            )}
            {isMatch && fixture.homeAway && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Venue:</span>
                <span className="capitalize">{fixture.homeAway}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions — scheduled matches */}
        {fixture.status === 'scheduled' && isMatch && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Preparation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/availability?fixture=${fixture.id}`)}
              >
                Set Availability
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/team-selection?fixture=${fixture.id}`)}
              >
                Select Team
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/match-day?fixture=${fixture.id}`)}
              >
                Match Day
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Match Review — completed matches */}
        {fixture.status === 'completed' && isMatch && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/team-selection?fixture=${fixture.id}`)}
              >
                View Team Selection
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/match-day?fixture=${fixture.id}`)}
              >
                View Match Record
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Match Result — completed matches */}
        {fixture.status === 'completed' && isMatch && matchRecord && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Match Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">
                  {fixture.homeAway === 'away' ? fixture.opponent : 'Our Team'}
                  {' vs '}
                  {fixture.homeAway === 'away' ? 'Our Team' : (fixture.opponent ?? 'Opponent')}
                </p>
                <p className="text-2xl font-bold">
                  {formatScoreline(matchRecord.result?.goalsFor ?? '?', matchRecord.result?.goalsAgainst ?? '?', fixture.homeAway)}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  {matchRecord.result?.result ?? ''}
                </p>
              </div>

              {/* Goals */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Goalscorers</h4>
                  {!editingGoals && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={startEditGoals}>
                      <Edit className="h-3.5 w-3.5" /> {matchRecord.goals && matchRecord.goals.length > 0 ? 'Edit' : 'Add goalscorers'}
                    </Button>
                  )}
                </div>

                {!editingGoals ? (
                  matchRecord.goals && matchRecord.goals.length > 0 ? (
                    <div className="space-y-1">
                      {matchRecord.goals.map((g: any, i: number) => {
                        const scorer = players?.find(p => p.id === g.scorerId);
                        const assist = players?.find(p => p.id === (g.assistId || g.assistPlayerId));
                        return (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span>⚽</span>
                            <span className="font-medium">{scorer ? `${scorer.firstName} ${scorer.lastName}` : 'Unknown'}</span>
                            {assist && <span className="text-muted-foreground text-xs">(assist: {assist.firstName})</span>}
                            {g.period && <span className="text-muted-foreground text-xs">Q{g.period}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No goalscorers recorded yet.</p>
                  )
                ) : (
                  <div className="space-y-2">
                    {typeof matchRecord.result?.goalsFor === 'number' && (
                      <p className="text-[11px] text-muted-foreground">
                        Your team scored {matchRecord.result.goalsFor} — add one line per goal.
                      </p>
                    )}
                    {goalDraft.map((goal, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Select value={goal.scorerId} onChange={(e) => { const u = [...goalDraft]; u[idx].scorerId = e.target.value; setGoalDraft(u); }} className="flex-1 h-9 text-xs">
                          <option value="">Scorer...</option>
                          {players?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                        </Select>
                        <Select value={goal.assistId ?? ''} onChange={(e) => { const u = [...goalDraft]; u[idx].assistId = e.target.value || undefined; setGoalDraft(u); }} className="flex-1 h-9 text-xs">
                          <option value="">Assist...</option>
                          {players?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                        </Select>
                        <Select value={String(goal.period ?? '')} onChange={(e) => { const u = [...goalDraft]; u[idx].period = Number(e.target.value) || undefined; setGoalDraft(u); }} className="w-16 h-9 text-xs">
                          <option value="">Q?</option>
                          {Array.from({ length: totalPeriods }, (_, i) => <option key={i + 1} value={i + 1}>Q{i + 1}</option>)}
                        </Select>
                        <button onClick={() => setGoalDraft(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 p-1"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setGoalDraft([...goalDraft, { scorerId: '' }])}>
                        <Plus className="h-3.5 w-3.5" /> Add Goal
                      </Button>
                      <Button size="sm" onClick={saveGoals} disabled={savingGoals}>
                        <Save className="h-3.5 w-3.5" /> {savingGoals ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingGoals(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Coach notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Coach Notes</h4>
                  {!editingNotes && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={startEditNotes}>
                      <Edit className="h-3.5 w-3.5" /> {matchRecord.result?.coachNotes ? 'Edit' : 'Add notes'}
                    </Button>
                  )}
                </div>

                {!editingNotes ? (
                  matchRecord.result?.coachNotes ? (
                    <p className="text-sm whitespace-pre-wrap">{matchRecord.result.coachNotes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No coach notes yet.</p>
                  )
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={4}
                      placeholder="Add your reflections on the match..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                        <Save className="h-3.5 w-3.5" /> {savingNotes ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* MOTM */}
              {matchRecord.result?.motmPlayerId && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Man of the Match</h4>
                  <p className="text-sm font-medium">
                    🏆 {players?.find(p => p.id === matchRecord.result.motmPlayerId)?.firstName ?? ''} {players?.find(p => p.id === matchRecord.result.motmPlayerId)?.lastName ?? ''}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {fixture.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{fixture.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete option — available for all fixtures */}
      <div className="pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowConfirmDelete(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete fixture permanently
        </Button>
      </div>
    </div>
  );
}

function formatFullDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
