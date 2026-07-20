import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Trophy, Calendar, UserX, AlertCircle, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFixtures } from '@/hooks/use-fixtures';
import { usePlayers } from '@/hooks/use-players';
import { useRecordMatch } from '@/hooks/use-match-day';
import { useApprovedPlan, useRegenerateTeamSelection } from '@/hooks/use-team-selection';
import { useOppositionNotes, useCreateOppositionNote } from '@/hooks/use-opposition-notes';
import type { SubstitutionPlan, PeriodPlan, EngineConfig, PlayerForSelection } from '@/services/team-selection.service';

const POSITION_SHORT: Record<string, string> = {
  GK: 'GK',
  CB: 'CB',
  LB: 'LB',
  RB: 'RB',
  CM: 'CM',
  LM: 'LM',
  RM: 'RM',
  CF: 'CF',
};

interface GoalEntry {
  scorerId: string;
  assistId?: string;
  period?: number;
}

interface PlayingTimeEntry {
  playerId: string;
  playerName: string;
  outfieldMinutes: number;
  goalkeeperMinutes: number;
  periodsPlayed: number;
  periodsInGoal: number;
}

/**
 * Match Day page - pre-match plan reference + post-match recording.
 * Shows approved substitution plan, allows match-day adjustments,
 * then records score, goals, assists, playing time, notes, MOTM.
 */
export function MatchDayPage() {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | undefined>();
  const [goalsFor, setGoalsFor] = useState(0);
  const [goalsAgainst, setGoalsAgainst] = useState(0);
  const [goalsForTouched, setGoalsForTouched] = useState(false);
  const [goalsAgainstTouched, setGoalsAgainstTouched] = useState(false);
  const [coachNotes, setCoachNotes] = useState('');
  const [motmPlayerId, setMotmPlayerId] = useState<string>('');
  const [goalEntries, setGoalEntries] = useState<GoalEntry[]>([]);
  const [playingTimeEntries, setPlayingTimeEntries] = useState<PlayingTimeEntry[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oppositionNotesText, setOppositionNotesText] = useState('');

  // Match day adjustments state
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<string[]>([]);
  const [modifiedPlan, setModifiedPlan] = useState<SubstitutionPlan | null>(null);
  const [adHocMode, setAdHocMode] = useState<{ type: 'swap' | 'injury'; quarter?: number } | null>(null);
  const [adHocFirstPlayer, setAdHocFirstPlayer] = useState<string | null>(null);

  const { data: fixtures, isLoading: fixturesLoading } = useFixtures({ status: 'upcoming' });
  const { data: players } = usePlayers();
  const recordMatch = useRecordMatch();
  const regeneratePlan = useRegenerateTeamSelection();
  const createOppositionNote = useCreateOppositionNote();

  const { data: completedFixtures } = useFixtures({ status: 'completed' });

  const allMatchFixtures = [
    ...(fixtures?.filter((f) => f.type !== 'training') ?? []),
    ...(completedFixtures?.filter((f) => f.type !== 'training') ?? []),
  ];

  // Get the selected fixture's opponent name for opposition notes lookup
  const selectedFixture = allMatchFixtures.find((f) => f.id === selectedFixtureId);
  const opponentName = selectedFixture?.opponent ?? undefined;
  const { data: previousOppositionNotes } = useOppositionNotes(opponentName);

  if (!selectedFixtureId && allMatchFixtures.length > 0) {
    setSelectedFixtureId(allMatchFixtures[0].id);
  }

  // Fetch approved plan
  const { data: approvedPlanData } = useApprovedPlan(selectedFixtureId);
  const displayPlan = modifiedPlan ?? approvedPlanData?.plan ?? null;
  const planConfig = approvedPlanData?.config ?? null;
  const planPlayers = approvedPlanData?.availablePlayers ?? null;

  // Pre-fill playing time from plan summary
  const initPlayingTime = () => {
    if (displayPlan) {
      setPlayingTimeEntries(
        displayPlan.summary.map((s) => ({
          playerId: s.playerId,
          playerName: s.playerName,
          outfieldMinutes: Math.round(s.outfieldMinutes),
          goalkeeperMinutes: Math.round(s.gkMinutes),
          periodsPlayed: s.periodsPlayed,
          periodsInGoal: s.periodsInGoal,
        }))
      );
    } else if (players) {
      setPlayingTimeEntries(
        players.map((p) => ({
          playerId: p.id,
          playerName: `${p.firstName} ${p.lastName}`,
          outfieldMinutes: 24,
          goalkeeperMinutes: 0,
          periodsPlayed: 2,
          periodsInGoal: 0,
        }))
      );
    }
  };

  const handleMarkUnavailable = (playerId: string) => {
    setExcludedPlayerIds((prev) => [...prev, playerId]);
  };

  const handleRecalculate = async () => {
    if (!selectedFixtureId) return;
    try {
      const response = await regeneratePlan.mutateAsync({
        fixtureId: selectedFixtureId,
        excludePlayerIds: excludedPlayerIds,
      });
      setModifiedPlan(response.data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate plan.');
    }
  };

  const handleInjury = (playerId: string, currentQuarter: number) => {
    if (!displayPlan || !planConfig) return;
    const periodDuration = planConfig.matchDurationMinutes / planConfig.periods;
    // Remove player from remaining quarters
    const newPeriods = displayPlan.periods.map((period, idx) => {
      if (idx < currentQuarter) return period; // Past quarters unchanged
      const playerEntry = period.onPitch.find((pp) => pp.playerId === playerId);
      if (!playerEntry) return period;
      // Remove from on-pitch, add to off-pitch
      return {
        ...period,
        onPitch: period.onPitch.filter((pp) => pp.playerId !== playerId),
        offPitch: [...period.offPitch, playerId],
      };
    });
    setModifiedPlan({ ...displayPlan, periods: newPeriods });
  };

  const handleAdHocSub = (onPitchId: string, benchId: string, quarterIdx: number) => {
    if (!displayPlan) return;
    const newPeriods = displayPlan.periods.map((period, idx) => {
      if (idx !== quarterIdx) return period;
      const onPitchEntry = period.onPitch.find((pp) => pp.playerId === onPitchId);
      if (!onPitchEntry) return period;
      const newOnPitch = period.onPitch.map((pp) => {
        if (pp.playerId === onPitchId) {
          return { ...pp, playerId: benchId };
        }
        return pp;
      });
      const newOffPitch = period.offPitch.filter((id) => id !== benchId).concat(onPitchId);
      return { ...period, onPitch: newOnPitch, offPitch: newOffPitch };
    });
    setModifiedPlan({ ...displayPlan, periods: newPeriods });
    setAdHocMode(null);
    setAdHocFirstPlayer(null);
  };

  const handleSubmit = async () => {
    if (!selectedFixtureId) return;
    setError(null);

    // If playing time not loaded yet, use plan summary
    let finalPlayingTime = playingTimeEntries;
    if (finalPlayingTime.length === 0 && displayPlan) {
      finalPlayingTime = displayPlan.summary.map((s) => ({
        playerId: s.playerId,
        playerName: s.playerName,
        outfieldMinutes: Math.round(s.outfieldMinutes),
        goalkeeperMinutes: Math.round(s.gkMinutes),
        periodsPlayed: s.periodsPlayed,
        periodsInGoal: s.periodsInGoal,
      }));
    }

    try {
      await recordMatch.mutateAsync({
        fixtureId: selectedFixtureId,
        data: {
          goalsFor,
          goalsAgainst,
          coachNotes: coachNotes || undefined,
          motmPlayerId: motmPlayerId || undefined,
          goals: goalEntries.filter((g) => g.scorerId),
          playingTime: finalPlayingTime.map((pt) => ({
            playerId: pt.playerId,
            outfieldMinutes: pt.outfieldMinutes,
            goalkeeperMinutes: pt.goalkeeperMinutes,
            periodsPlayed: pt.periodsPlayed,
            periodsInGoal: pt.periodsInGoal,
          })),
        },
      });

      // Save opposition notes if provided
      if (oppositionNotesText.trim() && opponentName) {
        await createOppositionNote.mutateAsync({
          opponent: opponentName,
          fixtureId: selectedFixtureId,
          notes: oppositionNotesText.trim(),
        });
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record match.');
    }
  };

  if (fixturesLoading) {
    return <div className="text-muted-foreground py-12 text-center">Loading...</div>;
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center py-12">
          <Trophy className="h-16 w-16 text-primary mb-4" />
          <h2 className="text-2xl font-bold">Match Recorded</h2>
          <p className="text-muted-foreground mt-2">
            {goalsFor}-{goalsAgainst} {goalsFor > goalsAgainst ? '(Win)' : goalsFor < goalsAgainst ? '(Loss)' : '(Draw)'}
          </p>
          <Button className="mt-6" onClick={() => { setSubmitted(false); setGoalsFor(0); setGoalsAgainst(0); setGoalEntries([]); setCoachNotes(''); setMotmPlayerId(''); setOppositionNotesText(''); }}>
            Record Another Match
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Match Day</h2>
        <p className="text-muted-foreground">Record match results and playing time.</p>
      </div>

      {allMatchFixtures.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No matches to record</h3>
          <p className="mt-2 text-sm text-muted-foreground">Add a match fixture first.</p>
        </div>
      ) : (
        <>

          {/* Fixture selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {allMatchFixtures.map((f) => (
              <button
                key={f.id}
                onClick={() => { setSelectedFixtureId(f.id); initPlayingTime(); setExcludedPlayerIds([]); setModifiedPlan(null); }}
                className={`flex-shrink-0 rounded-lg border px-4 py-2 text-sm transition-colors ${
                  selectedFixtureId === f.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">vs {f.opponent}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(f.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {/* Match Plan Card - Feature 4 */}
          <MatchPlanCard
            plan={displayPlan}
            config={planConfig}
            excludedPlayerIds={excludedPlayerIds}
            onMarkUnavailable={handleMarkUnavailable}
            onRecalculate={handleRecalculate}
            isRecalculating={regeneratePlan.isPending}
            adHocMode={adHocMode}
            adHocFirstPlayer={adHocFirstPlayer}
            onStartAdHocSub={(quarter) => { setAdHocMode({ type: 'swap', quarter }); setAdHocFirstPlayer(null); }}
            onStartInjury={(playerId, quarter) => handleInjury(playerId, quarter)}
            onAdHocSelectPlayer={(playerId, quarterIdx) => {
              if (!displayPlan) return;
              const period = displayPlan.periods[quarterIdx];
              if (!adHocFirstPlayer) {
                // First selection - must be on-pitch player
                if (period.onPitch.some((pp) => pp.playerId === playerId)) {
                  setAdHocFirstPlayer(playerId);
                }
              } else {
                // Second selection - must be bench player
                if (period.offPitch.includes(playerId)) {
                  handleAdHocSub(adHocFirstPlayer, playerId, quarterIdx);
                } else {
                  setAdHocFirstPlayer(playerId);
                }
              }
            }}
            onCancelAdHoc={() => { setAdHocMode(null); setAdHocFirstPlayer(null); }}
          />

          {/* Score */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Final Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 justify-center">
                <div className="space-y-1 text-center flex-1">
                  <Label className="text-xs font-medium truncate block">
                    {selectedFixture?.homeAway === 'home' ? 'Home' : 'Away'}
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={goalsFor === 0 && !goalsForTouched ? '' : goalsFor}
                    onFocus={() => setGoalsForTouched(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGoalsForTouched(true);
                      setGoalsFor(val === '' ? 0 : Math.min(50, Math.max(0, parseInt(val) || 0)));
                    }}
                    placeholder="0"
                    className="w-20 mx-auto text-center text-2xl font-bold h-14"
                  />
                </div>
                <span className="text-2xl font-bold text-muted-foreground">–</span>
                <div className="space-y-1 text-center flex-1">
                  <Label className="text-xs font-medium truncate block">
                    {selectedFixture?.opponent ?? 'Opponent'}
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={goalsAgainst === 0 && !goalsAgainstTouched ? '' : goalsAgainst}
                    onFocus={() => setGoalsAgainstTouched(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGoalsAgainstTouched(true);
                      setGoalsAgainst(val === '' ? 0 : Math.min(50, Math.max(0, parseInt(val) || 0)));
                    }}
                    placeholder="0"
                    className="w-20 mx-auto text-center text-2xl font-bold h-14"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opposition Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opposition Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Previous encounters */}
              {previousOppositionNotes && previousOppositionNotes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Previous encounters</Label>
                  <div className="space-y-2 rounded-md border p-3 bg-muted/30 max-h-48 overflow-y-auto">
                    {previousOppositionNotes.map((note) => (
                      <div key={note.id} className="text-sm">
                        <span className="font-medium text-xs text-muted-foreground">
                          {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}:
                        </span>{' '}
                        <span>{note.notes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Current notes input */}
              <div className="space-y-2">
                <Label>Notes on the Opposition</Label>
                <textarea
                  value={oppositionNotesText}
                  onChange={(e) => setOppositionNotesText(e.target.value)}
                  placeholder="Formation, key players, strengths, weaknesses..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {/* Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Goalscorers & Assists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {goalEntries.map((goal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={goal.scorerId} onChange={(e) => { const updated = [...goalEntries]; updated[idx].scorerId = e.target.value; setGoalEntries(updated); }}>
                    <option value="">Scorer...</option>
                    {players?.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                    </Select>
                    <Select value={goal.assistId ?? ''} onChange={(e) => { const updated = [...goalEntries]; updated[idx].assistId = e.target.value || undefined; setGoalEntries(updated); }}>
                      <option value="">Assist...</option>
                      {players?.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                    </Select>
                    <Select value={goal.period?.toString() ?? ''} onChange={(e) => { const updated = [...goalEntries]; updated[idx].period = e.target.value ? Number(e.target.value) : undefined; setGoalEntries(updated); }}>
                      <option value="">Q?</option>
                      <option value="1">Q1</option>
                      <option value="2">Q2</option>
                      <option value="3">Q3</option>
                      <option value="4">Q4</option>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => setGoalEntries(goalEntries.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              <Button variant="outline" size="sm" onClick={() => setGoalEntries([...goalEntries, { scorerId: '' }])}>
                <Plus className="h-4 w-4" /> Add Goal
              </Button>
            </CardContent>
          </Card>

          {/* Playing Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Playing Time (Actual)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Record the actual minutes each player played. Pre-filled from the plan — adjust if different on the day.
              </p>
            </CardHeader>
            <CardContent>
              {playingTimeEntries.length === 0 ? (
                <div className="text-center py-4">
                  <Button variant="outline" onClick={initPlayingTime}>
                    {displayPlan ? 'Load from Plan' : 'Load Players'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    {displayPlan ? 'Pre-fills minutes from the approved plan.' : 'Pre-fills with default minutes. Adjust as needed.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr,80px,80px] gap-2 pb-2 border-b text-xs text-muted-foreground font-medium">
                    <span>Player</span>
                    <span className="text-center">Outfield mins</span>
                    <span className="text-center">GK mins</span>
                  </div>
                  {/* Player rows */}
                  {playingTimeEntries.map((pt, idx) => (
                    <div key={pt.playerId} className="grid grid-cols-[1fr,80px,80px] gap-2 items-center py-1">
                      <span className="text-sm font-medium truncate">{pt.playerName}</span>
                      <Input
                        type="number" min={0} max={48}
                        value={pt.outfieldMinutes}
                        onChange={(e) => { const updated = [...playingTimeEntries]; updated[idx].outfieldMinutes = Number(e.target.value); setPlayingTimeEntries(updated); }}
                        className="h-8 text-center text-sm"
                      />
                      <Input
                        type="number" min={0} max={48}
                        value={pt.goalkeeperMinutes}
                        onChange={(e) => { const updated = [...playingTimeEntries]; updated[idx].goalkeeperMinutes = Number(e.target.value); setPlayingTimeEntries(updated); }}
                        className="h-8 text-center text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* MOTM & Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Man of the Match (private)</Label>
                <Select value={motmPlayerId} onChange={(e) => setMotmPlayerId(e.target.value)}>
                  <option value="">None selected</option>
                  {players?.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Coach Notes</Label>
                <textarea
                  value={coachNotes}
                  onChange={(e) => setCoachNotes(e.target.value)}
                  placeholder="Observations, areas to work on, positives..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={recordMatch.isPending} className="w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {recordMatch.isPending ? 'Saving...' : 'Save Match Record'}
          </Button>
        </>
      )}
    </div>
  );
}

interface MatchPlanCardProps {
  plan: SubstitutionPlan | null;
  config: EngineConfig | null;
  excludedPlayerIds: string[];
  onMarkUnavailable: (playerId: string) => void;
  onRecalculate: () => void;
  isRecalculating: boolean;
  adHocMode: { type: 'swap' | 'injury'; quarter?: number } | null;
  adHocFirstPlayer: string | null;
  onStartAdHocSub: (quarter: number) => void;
  onStartInjury: (playerId: string, quarter: number) => void;
  onAdHocSelectPlayer: (playerId: string, quarterIdx: number) => void;
  onCancelAdHoc: () => void;
}

function MatchPlanCard({
  plan,
  config,
  excludedPlayerIds,
  onMarkUnavailable,
  onRecalculate,
  isRecalculating,
  adHocMode,
  adHocFirstPlayer,
  onStartAdHocSub,
  onStartInjury,
  onAdHocSelectPlayer,
  onCancelAdHoc,
}: MatchPlanCardProps) {
  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Match Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground text-sm">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            No plan approved — generate one from Team Selection.
          </div>
        </CardContent>
      </Card>
    );
  }

  const periodDuration = config ? config.matchDurationMinutes / config.periods : 12;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Match Plan</CardTitle>
          <div className="flex gap-2">
            {excludedPlayerIds.length > 0 && (
              <Button variant="outline" size="sm" onClick={onRecalculate} disabled={isRecalculating}>
                <RefreshCw className={`h-3 w-3 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Recalculating...' : 'Recalculate'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Excluded players notice */}
        {excludedPlayerIds.length > 0 && (
          <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 mb-3">
            {excludedPlayerIds.length} player(s) marked unavailable.
          </div>
        )}

        {/* Quarter-by-quarter compact view */}
        <div className="grid gap-3 md:grid-cols-2">
          {plan.periods.map((period, periodIdx) => {
            const isAdHocQuarter = adHocMode?.quarter === periodIdx;
            return (
              <div key={period.period} className={`rounded-md border p-2 text-xs ${isAdHocQuarter ? 'border-blue-300 bg-blue-50/30' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">Q{period.period}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onStartAdHocSub(periodIdx)}
                      className="text-[10px] text-blue-600 hover:underline"
                      title="Ad-hoc sub"
                    >
                      Sub
                    </button>
                  </div>
                </div>

                {isAdHocQuarter && (
                  <div className="rounded bg-blue-100 p-1 mb-1 text-[10px] text-blue-700">
                    {adHocFirstPlayer ? 'Now click a bench player to swap with' : 'Click a player on pitch to sub off'}
                    <button onClick={onCancelAdHoc} className="ml-2 underline">Cancel</button>
                  </div>
                )}

                <div className="space-y-0.5">
                  {period.onPitch.map((pp) => {
                    const playerName = plan.summary.find((s) => s.playerId === pp.playerId)?.playerName ?? '';
                    const firstName = playerName.split(' ')[0];
                    const isExcluded = excludedPlayerIds.includes(pp.playerId);
                    const isFullPeriod = pp.startMinute === 0 && pp.endMinute === periodDuration;
                    const isLeaving = pp.startMinute === 0 && pp.endMinute < periodDuration;
                    const isArriving = pp.startMinute > 0;
                    const isSelectedForSub = isAdHocQuarter && adHocFirstPlayer === pp.playerId;

                    return (
                      <div
                        key={pp.playerId}
                        className={`flex items-center gap-1 ${isExcluded ? 'line-through opacity-50' : ''} ${isSelectedForSub ? 'bg-blue-200 rounded px-1' : ''} ${isAdHocQuarter ? 'cursor-pointer hover:bg-blue-100 rounded px-1' : ''}`}
                        onClick={isAdHocQuarter ? () => onAdHocSelectPlayer(pp.playerId, periodIdx) : undefined}
                      >
                        {isArriving && <span className="text-green-600 font-bold">▲</span>}
                        <Badge variant={pp.isGk ? 'warning' : 'secondary'} className="text-[8px] w-6 justify-center py-0">
                          {POSITION_SHORT[pp.position] ?? pp.position.slice(0, 3).toUpperCase()}
                        </Badge>
                        <span className={isArriving ? 'text-green-700' : ''}>{firstName}</span>
                        {isLeaving && <span className="text-red-600 font-bold">▼ {period.startMinute + pp.endMinute}'</span>}
                        {isArriving && <span className="text-green-600 text-[10px]">{period.startMinute + pp.startMinute}'</span>}
                        {!isExcluded && (
                          <div className="ml-auto flex gap-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); onMarkUnavailable(pp.playerId); }}
                              className="text-[9px] text-red-500 hover:text-red-700"
                              title="Mark unavailable"
                            >
                              <UserX className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onStartInjury(pp.playerId, periodIdx); }}
                              className="text-[9px] text-orange-500 hover:text-orange-700"
                              title="Injury"
                            >
                              ⚡
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bench */}
                {period.offPitch.length > 0 && (
                  <div className="mt-1 pt-1 border-t text-[10px] text-muted-foreground">
                    Bench:{' '}
                    {period.offPitch.map((pid) => {
                      const name = plan.summary.find((s) => s.playerId === pid)?.playerName?.split(' ')[0] ?? '';
                      const isExcluded = excludedPlayerIds.includes(pid);
                      return (
                        <span
                          key={pid}
                          className={`mr-1 ${isExcluded ? 'line-through opacity-50' : ''} ${isAdHocQuarter ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          onClick={isAdHocQuarter ? () => onAdHocSelectPlayer(pid, periodIdx) : undefined}
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
