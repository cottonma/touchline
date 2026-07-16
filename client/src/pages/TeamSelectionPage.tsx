import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wand2, AlertTriangle, Check, Clock, Users, ArrowRightLeft, Edit3, RotateCcw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFixtures } from '@/hooks/use-fixtures';
import { useGenerateTeamSelection, useApproveTeamSelection } from '@/hooks/use-team-selection';
import type {
  TeamSelectionResult,
  PlayerTimeSummary,
  SubstitutionEvent,
  SubstitutionPlan,
  PeriodPlan,
  PeriodPlayer,
  EngineConfig,
  PlayerForSelection,
} from '@/services/team-selection.service';
import type { Fixture } from '@/services/fixture.service';

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

const ALL_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CM', 'LM', 'RM', 'CF'];

/** Position sort order: GK first, then defence, midfield, attack */
const POSITION_ORDER: Record<string, number> = {
  GK: 0,
  CB: 1,
  LB: 1,
  RB: 1,
  CM: 2,
  LM: 2,
  RM: 2,
  CF: 3,
};

function sortByPosition(a: PeriodPlayer, b: PeriodPlayer): number {
  return (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99);
}

/**
 * Team Selection page.
 * Select a fixture, generate a balanced substitution plan, manually adjust, review and approve.
 */
export function TeamSelectionPage() {
  const [searchParams] = useSearchParams();
  const fixtureFromUrl = searchParams.get('fixture') ?? undefined;
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | undefined>(fixtureFromUrl);
  const [result, setResult] = useState<TeamSelectionResult | null>(null);
  const [editablePlan, setEditablePlan] = useState<SubstitutionPlan | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSwapState, setEditSwapState] = useState<{ periodIdx: number; playerId: string } | null>(null);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: fixtures, isLoading: fixturesLoading } = useFixtures({ status: 'upcoming' });
  const generatePlan = useGenerateTeamSelection();
  const approvePlan = useApproveTeamSelection();

  const matchFixtures = fixtures?.filter((f) => f.type !== 'training') ?? [];

  if (!selectedFixtureId && matchFixtures.length > 0) {
    setSelectedFixtureId(matchFixtures[0].id);
  }

  const currentPlan = editablePlan ?? result?.plan ?? null;
  const wasManuallyEdited = editablePlan !== null;

  const handleGenerate = async () => {
    if (!selectedFixtureId) return;
    setError(null);
    setResult(null);
    setEditablePlan(null);
    setIsEditMode(false);
    setApproved(false);

    try {
      const response = await generatePlan.mutateAsync({ fixtureId: selectedFixtureId });
      setResult(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate team selection.');
    }
  };

  const handleApprove = async () => {
    if (!selectedFixtureId || !result) return;
    const planToApprove = currentPlan!;
    try {
      await approvePlan.mutateAsync({
        fixtureId: selectedFixtureId,
        plan: planToApprove,
        config: result.config,
        availablePlayers: result.availablePlayers,
        generatedBy: wasManuallyEdited ? 'coach' : 'engine',
      });
      setApproved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve plan.');
    }
  };

  const handleResetPlan = () => {
    setEditablePlan(null);
    setEditSwapState(null);
  };

  /** Swap a player on pitch with a player on bench for a specific period */
  const handleSwapPlayers = useCallback((periodIdx: number, onPitchPlayerId: string, benchPlayerId: string) => {
    if (!result) return;
    const basePlan = editablePlan ?? result.plan;
    const newPeriods = basePlan.periods.map((period, idx) => {
      if (idx !== periodIdx) return period;
      const periodDuration = period.endMinute - period.startMinute;
      // Move the on-pitch player to bench, bring bench player on
      const newOnPitch = period.onPitch.map((pp) => {
        if (pp.playerId === onPitchPlayerId) {
          // Replace with bench player
          const benchPlayer = result.availablePlayers.find((p) => p.id === benchPlayerId);
          return {
            ...pp,
            playerId: benchPlayerId,
            position: benchPlayer?.primaryPosition ?? pp.position,
          };
        }
        return pp;
      });
      const newOffPitch = period.offPitch
        .filter((id) => id !== benchPlayerId)
        .concat(onPitchPlayerId);
      return { ...period, onPitch: newOnPitch, offPitch: newOffPitch };
    });

    // Recalculate summary
    const newSummary = recalculateSummary(newPeriods, result.availablePlayers, result.config);
    const newPlan: SubstitutionPlan = {
      ...basePlan,
      periods: newPeriods,
      summary: newSummary,
    };
    setEditablePlan(newPlan);
    setEditSwapState(null);
  }, [result, editablePlan]);

  /** Change a player's position for a specific period */
  const handleChangePosition = useCallback((periodIdx: number, playerId: string, newPosition: string) => {
    if (!result) return;
    const basePlan = editablePlan ?? result.plan;
    const newPeriods = basePlan.periods.map((period, idx) => {
      if (idx !== periodIdx) return period;
      const newOnPitch = period.onPitch.map((pp) => {
        if (pp.playerId === playerId) {
          return { ...pp, position: newPosition };
        }
        return pp;
      });
      return { ...period, onPitch: newOnPitch };
    });
    const newPlan: SubstitutionPlan = { ...basePlan, periods: newPeriods };
    setEditablePlan(newPlan);
  }, [result, editablePlan]);

  /** Change the sub minute for a rolling sub in a specific period */
  const handleChangeSubMinute = useCallback((periodIdx: number, playerOffId: string, playerOnId: string, newMinute: number) => {
    if (!result) return;
    const basePlan = editablePlan ?? result.plan;
    const period = basePlan.periods[periodIdx];
    const periodDuration = period.endMinute - period.startMinute;

    // Clamp minute to valid range (within the period, relative to period start)
    const relativeMinute = Math.max(1, Math.min(periodDuration - 1, newMinute - period.startMinute));

    const newPeriods = basePlan.periods.map((p, idx) => {
      if (idx !== periodIdx) return p;
      const newOnPitch = p.onPitch.map(pp => {
        if (pp.playerId === playerOffId && pp.startMinute === 0) {
          // Player going off — update their endMinute
          return { ...pp, endMinute: relativeMinute };
        }
        if (pp.playerId === playerOnId && pp.startMinute > 0) {
          // Player coming on — update their startMinute
          return { ...pp, startMinute: relativeMinute };
        }
        return pp;
      });
      return { ...p, onPitch: newOnPitch };
    });

    // Also update the substitutions array
    const newSubs = (basePlan.substitutions || []).map(sub => {
      if (sub.period === periodIdx + 1 && sub.playerOffId === playerOffId && sub.playerOnId === playerOnId) {
        return { ...sub, minute: period.startMinute + relativeMinute, periodMinute: relativeMinute };
      }
      return sub;
    });

    const newSummary = recalculateSummary(newPeriods, result.availablePlayers, result.config);
    const newPlan: SubstitutionPlan = {
      ...basePlan,
      periods: newPeriods,
      substitutions: newSubs,
      summary: newSummary,
    };
    setEditablePlan(newPlan);
  }, [result, editablePlan]);

  if (fixturesLoading) {
    return <div className="text-muted-foreground py-12 text-center">Loading fixtures...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Team Selection</h2>
        <p className="text-muted-foreground">
          Generate a balanced substitution plan for your next match.
        </p>
      </div>

      {matchFixtures.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No upcoming matches</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a match fixture and mark players as available first.
          </p>
        </div>
      ) : (
        <>

          {/* Fixture selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {matchFixtures.map((fixture) => (
              <FixtureTab
                key={fixture.id}
                fixture={fixture}
                selected={selectedFixtureId === fixture.id}
                onSelect={() => {
                  setSelectedFixtureId(fixture.id);
                  setResult(null);
                  setEditablePlan(null);
                  setIsEditMode(false);
                  setApproved(false);
                  setError(null);
                }}
              />
            ))}
          </div>

          {/* Current fixture banner */}
          {selectedFixtureId && (() => {
            const selected = matchFixtures.find(f => f.id === selectedFixtureId);
            if (!selected) return null;
            return (
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                <p className="text-sm font-medium text-primary">
                  Preparing for: {selected.homeAway === 'home' ? 'vs' : '@'} {selected.opponent} — {new Date(selected.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              </div>
            );
          })()}

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!selectedFixtureId || generatePlan.isPending}
            className="w-full sm:w-auto"
          >
            <Wand2 className="h-4 w-4" />
            {generatePlan.isPending ? 'Generating...' : 'Generate Team Selection'}
          </Button>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Approved success */}
          {approved && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Plan approved — available on Match Day.</span>
            </div>
          )}

          {/* Results */}
          {result && currentPlan && (
            <TeamSelectionResults
              result={result}
              plan={currentPlan}
              isEditMode={isEditMode}
              editSwapState={editSwapState}
              wasManuallyEdited={wasManuallyEdited}
              approved={approved}
              approvePending={approvePlan.isPending}
              onToggleEditMode={() => setIsEditMode(!isEditMode)}
              onResetPlan={handleResetPlan}
              onApprove={handleApprove}
              onChangeSubMinute={handleChangeSubMinute}
              onSelectPlayer={(periodIdx, playerId) => {
                if (!isEditMode) return;
                const period = currentPlan.periods[periodIdx];
                const isOnPitch = period.onPitch.some((pp) => pp.playerId === playerId);
                const isOnBench = period.offPitch.includes(playerId);

                if (!editSwapState) {
                  // First click - select player
                  if (isOnPitch || isOnBench) {
                    setEditSwapState({ periodIdx, playerId });
                  }
                } else if (editSwapState.playerId === playerId && editSwapState.periodIdx === periodIdx) {
                  // Clicked same player again — deselect
                  setEditSwapState(null);
                } else {
                  // Second click - complete the swap
                  if (editSwapState.periodIdx !== periodIdx) {
                    // Different period, start fresh selection
                    setEditSwapState({ periodIdx, playerId });
                    return;
                  }
                  const firstIsOnPitch = period.onPitch.some((pp) => pp.playerId === editSwapState.playerId);
                  const secondIsOnPitch = isOnPitch;
                  const firstIsOnBench = period.offPitch.includes(editSwapState.playerId);
                  const secondIsOnBench = isOnBench;

                  if (firstIsOnPitch && secondIsOnBench) {
                    handleSwapPlayers(periodIdx, editSwapState.playerId, playerId);
                  } else if (firstIsOnBench && secondIsOnPitch) {
                    handleSwapPlayers(periodIdx, playerId, editSwapState.playerId);
                  } else {
                    // Both on same area (both on pitch or both on bench) — just reselect
                    setEditSwapState({ periodIdx, playerId });
                  }
                }
              }}
              onChangePosition={handleChangePosition}
            />
          )}
        </>
      )}
    </div>
  );
}

function FixtureTab({ fixture, selected, onSelect }: { fixture: Fixture; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex-shrink-0 rounded-lg border px-4 py-2 text-sm transition-colors ${
        selected
          ? 'border-primary bg-primary/10 text-primary font-medium'
          : 'border-border hover:bg-accent'
      }`}
    >
      <div className="font-medium">vs {fixture.opponent}</div>
      <div className="text-xs text-muted-foreground">
        {new Date(fixture.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
    </button>
  );
}

interface TeamSelectionResultsProps {
  result: TeamSelectionResult;
  plan: SubstitutionPlan;
  isEditMode: boolean;
  editSwapState: { periodIdx: number; playerId: string } | null;
  wasManuallyEdited: boolean;
  approved: boolean;
  approvePending: boolean;
  onToggleEditMode: () => void;
  onResetPlan: () => void;
  onApprove: () => void;
  onSelectPlayer: (periodIdx: number, playerId: string) => void;
  onChangePosition: (periodIdx: number, playerId: string, newPosition: string) => void;
  onChangeSubMinute: (periodIdx: number, playerOffId: string, playerOnId: string, newMinute: number) => void;
}

function TeamSelectionResults({
  result,
  plan,
  isEditMode,
  editSwapState,
  wasManuallyEdited,
  approved,
  approvePending,
  onToggleEditMode,
  onResetPlan,
  onApprove,
  onSelectPlayer,
  onChangePosition,
  onChangeSubMinute,
}: TeamSelectionResultsProps) {
  const { config } = result;
  const periodDuration = config.matchDurationMinutes / config.periods;

  return (
    <div className="space-y-6">
      {/* Status */}
      {plan.isValid ? (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
          <Check className="h-4 w-4" />
          <span className="font-medium">Valid plan generated.</span>
          <span>All players get equal outfield time within ±{config.toleranceMinutes} minutes.</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Plan has issues that may need manual adjustment:</span>
          </div>
          {plan.validationErrors.map((err, i) => (
            <p key={i} className="text-sm text-amber-700 pl-7">- {err}</p>
          ))}
        </div>
      )}

      {/* Edit / Approve toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button variant={isEditMode ? 'default' : 'outline'} size="sm" onClick={onToggleEditMode}>
          <Edit3 className="h-4 w-4" />
          {isEditMode ? 'Done Editing' : 'Edit Plan'}
        </Button>
        {wasManuallyEdited && (
          <Button variant="outline" size="sm" onClick={onResetPlan}>
            <RotateCcw className="h-4 w-4" />
            Reset to Generated
          </Button>
        )}
        {!approved && (
          <Button size="sm" onClick={onApprove} disabled={approvePending}>
            <CheckCircle className="h-4 w-4" />
            {approvePending ? 'Approving...' : 'Approve Plan'}
          </Button>
        )}
      </div>

      {isEditMode && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          <span className="font-medium">Edit mode:</span> Tap a player on pitch (they highlight), then tap a bench player to swap them. Change sub minutes by editing the numbers. Tap "Done Editing" when finished.
          {editSwapState && (
            <span className="block mt-1 font-medium text-blue-600">
              Player selected — now tap a bench player to complete the swap, or tap them again to deselect.
            </span>
          )}
        </div>
      )}

      {/* GK Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goalkeeper</CardTitle>
        </CardHeader>
        <CardContent>
          {plan.gkAssignments.map((gk) => {
            const playerSummary = plan.summary.find((s) => s.playerId === gk.playerId);
            return (
              <div key={gk.playerId} className="flex items-center gap-3">
                <Badge variant="warning">GK</Badge>
                <span className="font-medium">{playerSummary?.playerName}</span>
                <span className="text-sm text-muted-foreground">
                  Quarters {gk.periods.join(', ')} ({gk.periods.length * periodDuration} min)
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Substitution Events */}
      {plan.substitutions && plan.substitutions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              <CardTitle className="text-base">Rolling Substitutions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...plan.substitutions].sort((a, b) => a.minute - b.minute).map((sub, i) => (
                <SubstitutionRow key={i} sub={sub} plan={plan} config={config} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period-by-period plan with triangle indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Substitution Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {plan.periods.map((period, periodIdx) => (
              <PeriodCard
                key={period.period}
                period={period}
                periodIdx={periodIdx}
                plan={plan}
                periodDuration={periodDuration}
                isEditMode={isEditMode}
                editSwapState={editSwapState}
                onSelectPlayer={onSelectPlayer}
                onChangePosition={onChangePosition}
                onChangeSubMinute={onChangeSubMinute}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Balance Indicator */}
      {(() => {
        const outfieldPlayers = plan.summary.filter(s => s.gkMinutes === 0);
        if (outfieldPlayers.length === 0) return null;
        const minTime = Math.min(...outfieldPlayers.map(s => s.totalMinutes));
        const maxTime = Math.max(...outfieldPlayers.map(s => s.totalMinutes));
        const difference = maxTime - minTime;
        const isBalanced = difference <= config.toleranceMinutes;

        return isBalanced ? (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            <Check className="h-4 w-4" />
            <span className="font-medium">✓ Balanced</span>
            <span>— all players within ±{config.toleranceMinutes} min ({difference} min difference)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">⚠ Imbalance</span>
            <span>— {difference} min difference (target: ±{config.toleranceMinutes} min)</span>
          </div>
        );
      })()}

      {/* Player time summary table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <CardTitle className="text-base">Playing Time Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Player</th>
                  {plan.periods.map((p) => (
                    <th key={p.period} className="pb-2 font-medium text-right">Q{p.period}</th>
                  ))}
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {plan.summary
                  .sort((a, b) => a.playerName.localeCompare(b.playerName))
                  .map((s) => {
                    // Calculate minutes per quarter for this player
                    const quarterMinutes = plan.periods.map((period) => {
                      const entry = period.onPitch.find((pp) => pp.playerId === s.playerId);
                      if (entry) {
                        return Math.round((entry.endMinute - entry.startMinute) * 10) / 10;
                      }
                      return 0;
                    });
                    return (
                      <tr key={s.playerId} className="border-b last:border-0">
                        <td className="py-2 font-medium">{s.playerName}</td>
                        {quarterMinutes.map((mins, idx) => (
                          <td key={idx} className={`py-2 text-right ${mins === 0 ? 'text-muted-foreground' : ''}`}>
                            {mins > 0 ? `${mins}` : '-'}
                          </td>
                        ))}
                        <td className="py-2 text-right font-bold">{s.totalMinutes}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface PeriodCardProps {
  period: PeriodPlan;
  periodIdx: number;
  plan: SubstitutionPlan;
  periodDuration: number;
  isEditMode: boolean;
  editSwapState: { periodIdx: number; playerId: string } | null;
  onSelectPlayer: (periodIdx: number, playerId: string) => void;
  onChangePosition: (periodIdx: number, playerId: string, newPosition: string) => void;
  onChangeSubMinute: (periodIdx: number, playerOffId: string, playerOnId: string, newMinute: number) => void;
}

function PeriodCard({
  period,
  periodIdx,
  plan,
  periodDuration,
  isEditMode,
  editSwapState,
  onSelectPlayer,
  onChangePosition,
  onChangeSubMinute,
}: PeriodCardProps) {
  const isSelectedPeriod = editSwapState?.periodIdx === periodIdx;

  // ALL players who start the quarter (startMinute === 0), sorted by position
  // This includes those who leave mid-quarter — they'll get a red ▼ indicator
  const startersAll = period.onPitch
    .filter((pp) => pp.startMinute === 0)
    .sort(sortByPosition);

  // Players coming on mid-quarter (the subs coming in)
  const arrivingPlayers = period.onPitch
    .filter((pp) => pp.startMinute > 0)
    .sort((a, b) => a.startMinute - b.startMinute);

  const hasSubs = arrivingPlayers.length > 0;

  return (
    <div className={`rounded-md border p-3 ${isEditMode ? 'border-blue-300 bg-blue-50/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">Quarter {period.period}</h4>
        <span className="text-xs text-muted-foreground">
          {period.startMinute}-{period.endMinute} min
        </span>
      </div>
      <div className="space-y-1">

        {/* All starters with position — red ▼ + minute if they leave mid-quarter */}
        {startersAll.map((pp) => {
          const playerName = plan.summary.find((s) => s.playerId === pp.playerId)?.playerName ?? pp.playerId;
          const leavesEarly = pp.endMinute < periodDuration;
          const subMinute = leavesEarly ? period.startMinute + pp.endMinute : null;
          const isSelected = isSelectedPeriod && editSwapState?.playerId === pp.playerId;

          // Find the player coming on for this player (to link the sub minute edit)
          const matchingArrival = leavesEarly
            ? arrivingPlayers.find((ap) => ap.startMinute === pp.endMinute)
            : null;

          return (
            <div
              key={pp.playerId}
              className={`flex items-center gap-2 text-xs ${
                isEditMode ? 'cursor-pointer hover:bg-blue-100 rounded px-1 py-0.5' : ''
              } ${isSelected ? 'bg-blue-100 ring-1 ring-blue-400 rounded px-1 py-0.5' : ''}`}
              onClick={isEditMode ? () => onSelectPlayer(periodIdx, pp.playerId) : undefined}
            >
              {isEditMode ? (
                <select
                  value={pp.position}
                  onChange={(e) => { e.stopPropagation(); onChangePosition(periodIdx, pp.playerId, e.target.value); }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] w-12 bg-transparent border rounded px-0.5"
                >
                  {ALL_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{POSITION_SHORT[pos] ?? pos}</option>
                  ))}
                </select>
              ) : (
                <Badge
                  variant={pp.isGk ? 'warning' : 'secondary'}
                  className="text-[10px] w-8 justify-center"
                >
                  {POSITION_SHORT[pp.position] ?? pp.position}
                </Badge>
              )}
              <span className={leavesEarly ? 'text-red-700' : ''}>{playerName}</span>
              {leavesEarly && (
                <>
                  <span className="text-red-600 font-bold text-sm leading-none">▼</span>
                  {isEditMode && matchingArrival ? (
                    <input
                      type="number"
                      value={subMinute ?? ''}
                      min={period.startMinute + 1}
                      max={period.endMinute - 1}
                      onChange={(e) => {
                        e.stopPropagation();
                        onChangeSubMinute(periodIdx, pp.playerId, matchingArrival.playerId, Number(e.target.value));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 h-6 text-center text-[10px] text-red-600 border border-red-300 rounded bg-white"
                    />
                  ) : (
                    <span className="text-red-600 text-[10px]">{subMinute}'</span>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Subs coming on */}
        {hasSubs && (
          <>
            <div className="border-t border-dashed border-muted-foreground/30 my-2" />
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Subs</div>
            {arrivingPlayers.map((pp) => {
              const playerName = plan.summary.find((s) => s.playerId === pp.playerId)?.playerName ?? pp.playerId;
              const onMinute = period.startMinute + pp.startMinute;
              const posLabel = POSITION_SHORT[pp.position] ?? pp.position;
              const isSelected = isSelectedPeriod && editSwapState?.playerId === pp.playerId;

              // Find the player who left for this sub
              const matchingLeaver = startersAll.find((sp) => sp.endMinute === pp.startMinute && sp.endMinute < periodDuration);

              return (
                <div
                  key={`sub-${pp.playerId}`}
                  className={`flex items-center gap-2 text-xs ${
                    isEditMode ? 'cursor-pointer hover:bg-blue-100 rounded px-1 py-0.5' : ''
                  } ${isSelected ? 'bg-blue-100 ring-1 ring-blue-400 rounded px-1 py-0.5' : ''}`}
                  onClick={isEditMode ? () => onSelectPlayer(periodIdx, pp.playerId) : undefined}
                >
                  <span className="text-green-600 font-bold text-sm leading-none">▲</span>
                  <span className="text-green-700 font-medium">{playerName}</span>
                  {isEditMode && matchingLeaver ? (
                    <input
                      type="number"
                      value={onMinute}
                      min={period.startMinute + 1}
                      max={period.endMinute - 1}
                      onChange={(e) => {
                        e.stopPropagation();
                        onChangeSubMinute(periodIdx, matchingLeaver.playerId, pp.playerId, Number(e.target.value));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 h-6 text-center text-[10px] text-green-600 border border-green-300 rounded bg-white"
                    />
                  ) : (
                    <span className="text-green-600 text-[10px]">{onMinute}'</span>
                  )}
                  <Badge variant="secondary" className="text-[10px] w-8 justify-center">{posLabel}</Badge>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Bench */}
      {period.offPitch.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">Bench: </span>
          <span className="text-xs">
            {period.offPitch.map((pid) => {
              const name = plan.summary.find((s) => s.playerId === pid)?.playerName?.split(' ')[0] ?? pid;
              const isSelected = isSelectedPeriod && editSwapState?.playerId === pid;
              return (
                <button
                  key={pid}
                  onClick={() => isEditMode && onSelectPlayer(periodIdx, pid)}
                  className={`inline-block mr-2 ${isEditMode ? 'cursor-pointer hover:text-blue-600' : ''} ${
                    isSelected ? 'text-blue-600 font-bold underline' : ''
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </span>
        </div>
      )}
    </div>
  );
}

interface PlayerSlotProps {
  pp: PeriodPlayer;
  plan: SubstitutionPlan;
  periodIdx: number;
  period: PeriodPlan;
  indicator: 'none' | 'leaving' | 'arriving';
  minuteLabel?: number;
  isEditMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onChangePosition: (periodIdx: number, playerId: string, newPosition: string) => void;
}

function PlayerSlot({ pp, plan, periodIdx, period, indicator, minuteLabel, isEditMode, isSelected, onSelect, onChangePosition }: PlayerSlotProps) {
  const playerName = plan.summary.find((s) => s.playerId === pp.playerId)?.playerName ?? pp.playerId;

  return (
    <div
      className={`flex items-center gap-2 text-xs ${
        isEditMode ? 'cursor-pointer hover:bg-blue-100 rounded px-1 py-0.5' : ''
      } ${isSelected ? 'bg-blue-100 ring-1 ring-blue-400 rounded px-1 py-0.5' : ''}`}
      onClick={isEditMode ? onSelect : undefined}
    >
      {/* Green ▲ before position for arriving players */}
      {indicator === 'arriving' && (
        <span className="text-green-600 font-bold text-sm leading-none">▲</span>
      )}

      {/* Position badge - clickable in edit mode */}
      {isEditMode ? (
        <select
          value={pp.position}
          onChange={(e) => {
            e.stopPropagation();
            onChangePosition(periodIdx, pp.playerId, e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] w-12 bg-transparent border rounded px-0.5"
        >
          {ALL_POSITIONS.map((pos) => (
            <option key={pos} value={pos}>{POSITION_SHORT[pos] ?? pos}</option>
          ))}
        </select>
      ) : (
        <Badge
          variant={pp.isGk ? 'warning' : 'secondary'}
          className="text-[10px] w-8 justify-center"
        >
          {POSITION_SHORT[pp.position] ?? pp.position}
        </Badge>
      )}

      <span className={indicator === 'arriving' ? 'text-green-700 font-medium' : indicator === 'leaving' ? 'text-red-700' : ''}>
        {playerName}
      </span>

      {/* Red ▼ after name for leaving players */}
      {indicator === 'leaving' && (
        <>
          <span className="text-red-600 font-bold text-sm leading-none">▼</span>
          <span className="text-red-600 text-[10px]">off {minuteLabel}'</span>
        </>
      )}

      {/* Green "on X'" after name for arriving players */}
      {indicator === 'arriving' && (
        <span className="text-green-600 text-[10px]">on {minuteLabel}'</span>
      )}
    </div>
  );
}

function SubstitutionRow({ sub, plan, config }: { sub: SubstitutionEvent; plan: SubstitutionPlan; config: EngineConfig }) {
  const playerOff = plan.summary.find((s) => s.playerId === sub.playerOffId);
  const playerOn = plan.summary.find((s) => s.playerId === sub.playerOnId);

  return (
    <div className="flex items-center gap-3 text-sm rounded-md bg-muted/50 px-3 py-2">
      <span className="font-mono text-xs text-muted-foreground w-10">{sub.minute}'</span>
      <span className="text-xs text-muted-foreground">Q{sub.period}</span>
      <span className="text-red-600 text-xs">▼ {playerOff?.playerName}</span>
      <span className="text-green-600 text-xs">▲ {playerOn?.playerName}</span>
    </div>
  );
}

function PlayerTimeRow({ summary }: { summary: PlayerTimeSummary }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 font-medium">{summary.playerName}</td>
      <td className="py-2 text-right">{summary.outfieldMinutes} min</td>
      <td className="py-2 text-right">
        {summary.gkMinutes > 0 ? `${summary.gkMinutes} min` : '-'}
      </td>
      <td className="py-2 text-right font-medium">{summary.totalMinutes} min</td>
      <td className="py-2 text-right text-muted-foreground">
        {summary.periodsOnBench > 0 ? `${summary.periodsOnBench} Qs` : '-'}
      </td>
    </tr>
  );
}

/** Recalculate playing time summary from period data */
function recalculateSummary(
  periods: PeriodPlan[],
  availablePlayers: PlayerForSelection[],
  config: EngineConfig
): PlayerTimeSummary[] {
  const periodDuration = config.matchDurationMinutes / config.periods;

  return availablePlayers.map((player) => {
    let outfieldMinutes = 0;
    let gkMinutes = 0;
    let periodsPlayed = 0;
    let periodsOnBench = 0;
    let periodsInGoal = 0;

    for (const period of periods) {
      const onPitchEntry = period.onPitch.find((pp) => pp.playerId === player.id);
      if (onPitchEntry) {
        const minutes = onPitchEntry.endMinute - onPitchEntry.startMinute;
        if (onPitchEntry.isGk) {
          gkMinutes += minutes;
          periodsInGoal++;
        } else {
          outfieldMinutes += minutes;
        }
        periodsPlayed++;
      } else if (period.offPitch.includes(player.id)) {
        periodsOnBench++;
      }
    }

    return {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      outfieldMinutes: Math.round(outfieldMinutes * 10) / 10,
      gkMinutes,
      totalMinutes: Math.round((outfieldMinutes + gkMinutes) * 10) / 10,
      periodsPlayed,
      periodsOnBench,
      periodsInGoal,
    };
  });
}
