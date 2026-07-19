import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wand2, AlertTriangle, Check, Clock, Users, ArrowRightLeft, Edit3, RotateCcw, CheckCircle, X, ChevronDown } from 'lucide-react';
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
  GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB',
  CM: 'CM', LM: 'LM', RM: 'RM', CF: 'CF',
  LCB: 'LCB', RCB: 'RCB', LWB: 'LWB', RWB: 'RWB',
  LCM: 'LCM', RCM: 'RCM',
};

const ALL_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CM', 'LM', 'RM', 'CF'];

const POSITION_ORDER: Record<string, number> = {
  GK: 0, CB: 1, LB: 1, RB: 1, LCB: 1, RCB: 1, LWB: 1, RWB: 1,
  CM: 2, LM: 2, RM: 2, LCM: 2, RCM: 2,
  CF: 3,
};

function sortByPosition(a: PeriodPlayer, b: PeriodPlayer): number {
  return (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99);
}

/**
 * Team Selection page — mobile-optimised with touch-friendly interactions.
 * Features: large tap targets (min 44px), bottom action bar, sub-minute slider.
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
  // Bottom action bar state
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [showSubMinuteSlider, setShowSubMinuteSlider] = useState<{
    periodIdx: number; playerOffId: string; playerOnId: string; currentMinute: number; min: number; max: number;
  } | null>(null);
  const [gkWarning, setGkWarning] = useState<{ periodIdx: number; onPitchPlayerId: string; benchPlayerId: string } | null>(null);
  // Active quarter for mobile (-1 = show all, 0-3 = single quarter detail)
  const [activeQuarter, setActiveQuarter] = useState(-1);

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
    setActiveQuarter(-1);

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
      setIsEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve plan.');
    }
  };

  const handleResetPlan = () => {
    setEditablePlan(null);
    setEditSwapState(null);
    setShowPositionPicker(false);
    setShowSubMinuteSlider(null);
  };

  /** Swap a player on pitch with a player on bench for a specific period */
  const handleSwapPlayers = useCallback((periodIdx: number, onPitchPlayerId: string, benchPlayerId: string) => {
    if (!result) return;
    const basePlan = editablePlan ?? result.plan;
    const period = basePlan.periods[periodIdx];
    const onPitchEntry = period.onPitch.find((pp) => pp.playerId === onPitchPlayerId);

    // If swapping the GK, check if bench player is a GK volunteer
    if (onPitchEntry?.isGk) {
      const benchPlayer = result.availablePlayers.find((p) => p.id === benchPlayerId);
      if (!benchPlayer?.isGkVolunteer) {
        // Show warning — don't proceed
        setGkWarning({ periodIdx, onPitchPlayerId, benchPlayerId });
        setEditSwapState(null);
        return;
      }
    }

    const newPeriods = basePlan.periods.map((p, idx) => {
      if (idx !== periodIdx) return p;
      const newOnPitch = p.onPitch.map((pp) => {
        if (pp.playerId === onPitchPlayerId) {
          // GK: bench player takes over GK duties
          // Outfield: bench player inherits the formation slot position
          if (pp.isGk) {
            return { ...pp, playerId: benchPlayerId, position: 'GK', isGk: true };
          }
          return { ...pp, playerId: benchPlayerId };
        }
        return pp;
      });
      const newGkPlayerId = onPitchEntry?.isGk ? benchPlayerId : p.gkPlayerId;
      const newOffPitch = p.offPitch.filter((id) => id !== benchPlayerId).concat(onPitchPlayerId);
      return { ...p, onPitch: newOnPitch, offPitch: newOffPitch, gkPlayerId: newGkPlayerId };
    });
    const newSummary = recalculateSummary(newPeriods, result.availablePlayers, result.config);
    setEditablePlan({ ...basePlan, periods: newPeriods, summary: newSummary });
    setEditSwapState(null);
  }, [result, editablePlan]);

  /** Change a player's position for a specific period */
  const handleChangePosition = useCallback((periodIdx: number, playerId: string, newPosition: string) => {
    if (!result) return;
    const basePlan = editablePlan ?? result.plan;
    const newPeriods = basePlan.periods.map((period, idx) => {
      if (idx !== periodIdx) return period;
      const newOnPitch = period.onPitch.map((pp) => pp.playerId === playerId ? { ...pp, position: newPosition } : pp);
      return { ...period, onPitch: newOnPitch };
    });
    setEditablePlan({ ...basePlan, periods: newPeriods });
    setShowPositionPicker(false);
  }, [result, editablePlan]);

  /** Swap positions between two on-pitch starters */
  const handleSwapPositions = useCallback((periodIdx: number, playerAId: string, playerBId: string) => {
    if (!result) return;
    const basePlan = editablePlan ?? result.plan;
    const period = basePlan.periods[periodIdx];
    const entryA = period.onPitch.find((pp) => pp.playerId === playerAId);
    const entryB = period.onPitch.find((pp) => pp.playerId === playerBId);
    if (!entryA || !entryB) return;

    const newPeriods = basePlan.periods.map((p, idx) => {
      if (idx !== periodIdx) return p;
      const newOnPitch = p.onPitch.map((pp) => {
        if (pp.playerId === playerAId) {
          return { ...pp, position: entryB.position, isGk: entryB.isGk };
        }
        if (pp.playerId === playerBId) {
          return { ...pp, position: entryA.position, isGk: entryA.isGk };
        }
        return pp;
      });
      // Update gkPlayerId if one of them was GK
      let newGkPlayerId = p.gkPlayerId;
      if (entryA.isGk) newGkPlayerId = playerBId;
      else if (entryB.isGk) newGkPlayerId = playerAId;
      return { ...p, onPitch: newOnPitch, gkPlayerId: newGkPlayerId };
    });
    setEditablePlan({ ...basePlan, periods: newPeriods });
    setEditSwapState(null);
  }, [result, editablePlan]);

  /** Swap a starter with a sub — starter becomes the sub, sub becomes the starter */
  const handleSwapStarterWithSub = useCallback((periodIdx: number, starterId: string, subId: string) => {
    if (!result) return;
    const basePlan = editablePlan ?? result.plan;
    const period = basePlan.periods[periodIdx];
    const periodDuration = period.endMinute - period.startMinute;
    const subEntry = period.onPitch.find((pp) => pp.playerId === subId);
    if (!subEntry) return;
    const subMinute = subEntry.startMinute;

    const newPeriods = basePlan.periods.map((p, idx) => {
      if (idx !== periodIdx) return p;
      const newOnPitch = p.onPitch.map((pp) => {
        if (pp.playerId === starterId) return { ...pp, startMinute: subMinute, endMinute: periodDuration };
        if (pp.playerId === subId) return { ...pp, startMinute: 0, endMinute: subMinute };
        return pp;
      });
      return { ...p, onPitch: newOnPitch };
    });

    const newSubs = (basePlan.substitutions || []).map(sub => {
      if (sub.period === periodIdx + 1 && sub.playerOffId === starterId && sub.playerOnId === subId) {
        return { ...sub, playerOffId: subId, playerOnId: starterId };
      }
      return sub;
    });

    const newSummary = recalculateSummary(newPeriods, result.availablePlayers, result.config);
    setEditablePlan({ ...basePlan, periods: newPeriods, substitutions: newSubs, summary: newSummary });
    setEditSwapState(null);
  }, [result, editablePlan]);

  /** Change the sub minute for a rolling sub in a specific period */
  const handleChangeSubMinute = useCallback((periodIdx: number, playerOffId: string, playerOnId: string, newMinute: number) => {
    if (!result) return;
    const basePlan = editablePlan ?? result.plan;
    const period = basePlan.periods[periodIdx];
    const periodDuration = period.endMinute - period.startMinute;
    const relativeMinute = Math.max(1, Math.min(periodDuration - 1, newMinute - period.startMinute));

    const newPeriods = basePlan.periods.map((p, idx) => {
      if (idx !== periodIdx) return p;
      const newOnPitch = p.onPitch.map(pp => {
        if (pp.playerId === playerOffId && pp.startMinute === 0) return { ...pp, endMinute: relativeMinute };
        if (pp.playerId === playerOnId && pp.startMinute > 0) return { ...pp, startMinute: relativeMinute };
        return pp;
      });
      return { ...p, onPitch: newOnPitch };
    });

    const newSubs = (basePlan.substitutions || []).map(sub => {
      if (sub.period === periodIdx + 1 && sub.playerOffId === playerOffId && sub.playerOnId === playerOnId) {
        return { ...sub, minute: period.startMinute + relativeMinute, periodMinute: relativeMinute };
      }
      return sub;
    });

    const newSummary = recalculateSummary(newPeriods, result.availablePlayers, result.config);
    setEditablePlan({ ...basePlan, periods: newPeriods, substitutions: newSubs, summary: newSummary });
    setShowSubMinuteSlider(null);
  }, [result, editablePlan]);

  /** Handle player tap in edit mode — manages swap logic */
  const handlePlayerTap = useCallback((periodIdx: number, playerId: string) => {
    if (!isEditMode || !currentPlan) return;
    const period = currentPlan.periods[periodIdx];
    const isOnPitch = period.onPitch.some((pp) => pp.playerId === playerId);
    const isOnBench = period.offPitch.includes(playerId);

    if (!editSwapState) {
      if (isOnPitch || isOnBench) setEditSwapState({ periodIdx, playerId });
      return;
    }

    if (editSwapState.playerId === playerId && editSwapState.periodIdx === periodIdx) {
      setEditSwapState(null);
      return;
    }

    if (editSwapState.periodIdx !== periodIdx) {
      setEditSwapState({ periodIdx, playerId });
      return;
    }

    const firstIsOnPitch = period.onPitch.some((pp) => pp.playerId === editSwapState.playerId);
    const firstIsOnBench = period.offPitch.includes(editSwapState.playerId);

    if (firstIsOnPitch && isOnBench) {
      handleSwapPlayers(periodIdx, editSwapState.playerId, playerId);
    } else if (firstIsOnBench && isOnPitch) {
      handleSwapPlayers(periodIdx, playerId, editSwapState.playerId);
    } else if (firstIsOnPitch && isOnPitch) {
      const firstEntry = period.onPitch.find((pp) => pp.playerId === editSwapState.playerId);
      const secondEntry = period.onPitch.find((pp) => pp.playerId === playerId);
      if (firstEntry && secondEntry) {
        const firstIsStarter = firstEntry.startMinute === 0;
        const secondIsStarter = secondEntry.startMinute === 0;
        if (firstIsStarter && !secondIsStarter) handleSwapStarterWithSub(periodIdx, editSwapState.playerId, playerId);
        else if (!firstIsStarter && secondIsStarter) handleSwapStarterWithSub(periodIdx, playerId, editSwapState.playerId);
        else if (firstIsStarter && secondIsStarter) handleSwapPositions(periodIdx, editSwapState.playerId, playerId);
        else setEditSwapState({ periodIdx, playerId });
      }
    } else {
      setEditSwapState({ periodIdx, playerId });
    }
  }, [isEditMode, currentPlan, editSwapState, handleSwapPlayers, handleSwapStarterWithSub]);

  /** Get selected player info for the bottom bar */
  const selectedPlayerInfo = useMemo(() => {
    if (!editSwapState || !currentPlan) return null;
    const period = currentPlan.periods[editSwapState.periodIdx];
    const onPitchEntry = period.onPitch.find((pp) => pp.playerId === editSwapState.playerId);
    const playerSummary = currentPlan.summary.find((s) => s.playerId === editSwapState.playerId);
    const isOnBench = period.offPitch.includes(editSwapState.playerId);
    return { onPitchEntry, playerSummary, isOnBench, period, periodIdx: editSwapState.periodIdx };
  }, [editSwapState, currentPlan]);

  if (fixturesLoading) {
    return <div className="text-muted-foreground py-12 text-center">Loading fixtures...</div>;
  }

  return (
    <div className="pb-32 md:pb-4">
      {/* Header */}
      <div className="px-1 pt-1 pb-3">
        <h2 className="text-xl font-bold tracking-tight">Team Selection</h2>
        <p className="text-sm text-muted-foreground">
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
          {/* Fixture selector — horizontal scroll, large touch targets */}
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory">
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

          {/* Generate button — full width for easy thumb tap */}
          <Button
            onClick={handleGenerate}
            disabled={!selectedFixtureId || generatePlan.isPending}
            className="w-full h-12 text-base"
          >
            <Wand2 className="h-5 w-5" />
            {generatePlan.isPending ? 'Generating...' : 'Generate Team Selection'}
          </Button>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive mt-3">
              {error}
            </div>
          )}

          {/* Approved success */}
          {approved && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800 mt-3">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Plan approved — available on Match Day.</span>
            </div>
          )}

          {/* Results */}
          {result && currentPlan && (
            <div className="mt-4 space-y-4">
              {/* Validity banner */}
              {currentPlan.isValid ? (
                <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  <span>Valid plan — equal time within ±{result.config.toleranceMinutes} min.</span>
                </div>
              ) : (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">Needs adjustment</span>
                  </div>
                  {currentPlan.validationErrors.map((err, i) => (
                    <p key={i} className="text-xs mt-1 pl-6">- {err}</p>
                  ))}
                </div>
              )}

              {/* Quarter tabs — swipeable on mobile, show one quarter at a time */}
              <div>
                {/* View toggle + Edit button inline */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <button
                      onClick={() => setActiveQuarter(-1)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activeQuarter === -1 ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      All Quarters
                    </button>
                    {currentPlan.periods.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveQuarter(idx)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          activeQuarter === idx ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        Q{idx + 1}
                      </button>
                    ))}
                  </div>
                  {!approved && (
                    <Button
                      variant={isEditMode ? 'default' : 'outline'}
                      size="sm"
                      className="h-9"
                      onClick={() => { setIsEditMode(!isEditMode); setEditSwapState(null); setShowPositionPicker(false); }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {isEditMode ? 'Done' : 'Edit'}
                    </Button>
                  )}
                </div>

                {isEditMode && (
                  <div className="rounded-md bg-blue-50 p-2.5 text-xs text-blue-800 mb-3">
                    Tap a player, then tap a bench player to swap them.
                    {editSwapState && (
                      <span className="block mt-1 font-medium text-blue-600">
                        Player selected — tap another to swap, or tap again to deselect.
                      </span>
                    )}
                  </div>
                )}

                {/* All quarters view — compact grid, 2 cols mobile, 4 cols desktop */}
                {activeQuarter === -1 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    {currentPlan.periods.map((period, idx) => (
                      <CompactPeriodCard
                        key={period.period}
                        period={period}
                        periodIdx={idx}
                        plan={currentPlan}
                        config={result.config}
                        isEditMode={isEditMode}
                        editSwapState={editSwapState}
                        onPlayerTap={handlePlayerTap}
                      />
                    ))}
                  </div>
                ) : (
                  /* Single quarter detail view */
                  currentPlan.periods[activeQuarter] && (
                    <MobilePeriodCard
                      period={currentPlan.periods[activeQuarter]}
                      periodIdx={activeQuarter}
                      plan={currentPlan}
                      config={result.config}
                      isEditMode={isEditMode}
                      editSwapState={editSwapState}
                      onPlayerTap={handlePlayerTap}
                      onSubMinuteTap={(periodIdx, playerOffId, playerOnId, currentMin, min, max) => {
                        setShowSubMinuteSlider({ periodIdx, playerOffId, playerOnId, currentMinute: currentMin, min, max });
                      }}
                    />
                  )
                )}
              </div>

              {/* Rolling subs timeline */}
              {currentPlan.substitutions && currentPlan.substitutions.length > 0 && (
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4" />
                      <CardTitle className="text-sm">Substitutions</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-2">
                      {[...currentPlan.substitutions].sort((a, b) => a.minute - b.minute).map((sub, i) => (
                        <SubstitutionRow key={i} sub={sub} plan={currentPlan} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Balance indicator */}
              {(() => {
                const outfieldPlayers = currentPlan.summary.filter(s => s.gkMinutes === 0);
                if (outfieldPlayers.length === 0) return null;
                const minTime = Math.min(...outfieldPlayers.map(s => s.totalMinutes));
                const maxTime = Math.max(...outfieldPlayers.map(s => s.totalMinutes));
                const difference = maxTime - minTime;
                const isBalanced = difference <= result.config.toleranceMinutes;
                return isBalanced ? (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                    <Check className="h-4 w-4 flex-shrink-0" />
                    <span>Balanced — {difference} min difference</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>Imbalance — {difference} min gap (target: ±{result.config.toleranceMinutes})</span>
                  </div>
                );
              })()}

              {/* Compact playing time summary */}
              <MobileTimeSummary plan={currentPlan} config={result.config} />
            </div>
          )}
        </>
      )}

      {/* === BOTTOM ACTION BAR === */}
      {result && currentPlan && (
        <BottomActionBar
          isEditMode={isEditMode}
          wasManuallyEdited={wasManuallyEdited}
          approved={approved}
          approvePending={approvePlan.isPending}
          selectedPlayerInfo={selectedPlayerInfo}
          onToggleEditMode={() => { setIsEditMode(!isEditMode); setEditSwapState(null); setShowPositionPicker(false); }}
          onResetPlan={handleResetPlan}
          onApprove={handleApprove}
          onDeselect={() => setEditSwapState(null)}
          onShowPositionPicker={() => setShowPositionPicker(true)}
        />
      )}

      {/* Position picker overlay */}
      {showPositionPicker && editSwapState && currentPlan && (
        <PositionPickerOverlay
          currentPosition={
            currentPlan.periods[editSwapState.periodIdx].onPitch.find(pp => pp.playerId === editSwapState.playerId)?.position ?? ''
          }
          onSelect={(pos) => handleChangePosition(editSwapState.periodIdx, editSwapState.playerId, pos)}
          onClose={() => setShowPositionPicker(false)}
        />
      )}

      {/* Sub minute slider overlay */}
      {showSubMinuteSlider && (
        <SubMinuteSliderOverlay
          {...showSubMinuteSlider}
          onConfirm={(newMinute) => {
            handleChangeSubMinute(showSubMinuteSlider.periodIdx, showSubMinuteSlider.playerOffId, showSubMinuteSlider.playerOnId, newMinute);
          }}
          onClose={() => setShowSubMinuteSlider(null)}
          plan={currentPlan!}
        />
      )}

      {/* GK swap warning overlay */}
      {gkWarning && result && (
        <GkWarningOverlay
          benchPlayerName={
            result.availablePlayers.find(p => p.id === gkWarning.benchPlayerId)
              ? `${result.availablePlayers.find(p => p.id === gkWarning.benchPlayerId)!.firstName} ${result.availablePlayers.find(p => p.id === gkWarning.benchPlayerId)!.lastName}`
              : 'This player'
          }
          onClose={() => setGkWarning(null)}
        />
      )}
    </div>
  );
}

// ─── FIXTURE TAB ─────────────────────────────────────────────────────────────

function FixtureTab({ fixture, selected, onSelect }: { fixture: Fixture; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex-shrink-0 snap-start rounded-lg border px-5 py-3 min-h-[52px] min-w-[120px] text-sm transition-colors active:scale-95 ${
        selected
          ? 'border-primary bg-primary/10 text-primary font-medium'
          : 'border-border bg-card active:bg-accent'
      }`}
    >
      <div className="font-medium">vs {fixture.opponent}</div>
      <div className="text-xs text-muted-foreground">
        {new Date(fixture.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
    </button>
  );
}

// ─── COMPACT PERIOD CARD (for all-quarters overview) ─────────────────────────

interface CompactPeriodCardProps {
  period: PeriodPlan;
  periodIdx: number;
  plan: SubstitutionPlan;
  config: EngineConfig;
  isEditMode: boolean;
  editSwapState: { periodIdx: number; playerId: string } | null;
  onPlayerTap: (periodIdx: number, playerId: string) => void;
}

function CompactPeriodCard({ period, periodIdx, plan, config, isEditMode, editSwapState, onPlayerTap }: CompactPeriodCardProps) {
  const periodDuration = period.endMinute - period.startMinute;
  const isSelectedPeriod = editSwapState?.periodIdx === periodIdx;
  const startersAll = period.onPitch.filter((pp) => pp.startMinute === 0).sort(sortByPosition);
  const arrivingPlayers = period.onPitch.filter((pp) => pp.startMinute > 0);

  return (
    <div className={`rounded-lg border p-2 ${isEditMode ? 'border-blue-300 bg-blue-50/30' : 'bg-card'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-bold">Q{period.period}</h4>
        <span className="text-[10px] text-muted-foreground">{period.startMinute}–{period.endMinute}'</span>
      </div>

      {/* Starters */}
      <div className="space-y-0.5">
        {startersAll.map((pp) => {
          const name = plan.summary.find((s) => s.playerId === pp.playerId)?.playerName ?? pp.playerId;
          const firstName = name.split(' ')[0];
          const leavesEarly = pp.endMinute < periodDuration;
          const isSelected = isSelectedPeriod && editSwapState?.playerId === pp.playerId;

          return (
            <div
              key={pp.playerId}
              onClick={() => isEditMode && onPlayerTap(periodIdx, pp.playerId)}
              className={`flex items-center gap-1 min-h-[28px] px-1 rounded transition-colors ${
                isEditMode ? 'active:bg-blue-100' : ''
              } ${isSelected ? 'bg-blue-100 ring-1 ring-blue-400' : ''}`}
            >
              <span className="text-[10px] font-bold text-muted-foreground w-6">{POSITION_SHORT[pp.position] ?? pp.position}</span>
              <span className={`text-xs truncate flex-1 ${leavesEarly ? 'text-red-700' : ''}`}>{firstName}</span>
              {leavesEarly && <span className="text-red-600 text-[10px]">▼</span>}
            </div>
          );
        })}

        {/* Subs arriving */}
        {arrivingPlayers.map((pp) => {
          const name = plan.summary.find((s) => s.playerId === pp.playerId)?.playerName ?? pp.playerId;
          const firstName = name.split(' ')[0];
          const isSelected = isSelectedPeriod && editSwapState?.playerId === pp.playerId;

          return (
            <div
              key={`sub-${pp.playerId}`}
              onClick={() => isEditMode && onPlayerTap(periodIdx, pp.playerId)}
              className={`flex items-center gap-1 min-h-[28px] px-1 rounded transition-colors ${
                isEditMode ? 'active:bg-blue-100' : ''
              } ${isSelected ? 'bg-blue-100 ring-1 ring-blue-400' : ''}`}
            >
              <span className="text-green-600 text-[10px]">▲</span>
              <span className="text-xs truncate flex-1 text-green-700">{firstName}</span>
            </div>
          );
        })}
      </div>

      {/* Bench */}
      {period.offPitch.length > 0 && (
        <div className="mt-1 pt-1 border-t border-dashed">
          <div className="flex flex-wrap gap-0.5">
            {period.offPitch.map((pid) => {
              const name = plan.summary.find((s) => s.playerId === pid)?.playerName?.split(' ')[0] ?? pid;
              const isSelected = isSelectedPeriod && editSwapState?.playerId === pid;
              return (
                <button
                  key={pid}
                  onClick={() => isEditMode && onPlayerTap(periodIdx, pid)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    isSelected ? 'bg-blue-100 text-blue-700 font-bold' : 'text-muted-foreground'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MOBILE PERIOD CARD ──────────────────────────────────────────────────────

interface MobilePeriodCardProps {
  period: PeriodPlan;
  periodIdx: number;
  plan: SubstitutionPlan;
  config: EngineConfig;
  isEditMode: boolean;
  editSwapState: { periodIdx: number; playerId: string } | null;
  onPlayerTap: (periodIdx: number, playerId: string) => void;
  onSubMinuteTap: (periodIdx: number, playerOffId: string, playerOnId: string, currentMin: number, min: number, max: number) => void;
}

function MobilePeriodCard({ period, periodIdx, plan, config, isEditMode, editSwapState, onPlayerTap, onSubMinuteTap }: MobilePeriodCardProps) {
  const periodDuration = period.endMinute - period.startMinute;
  const isSelectedPeriod = editSwapState?.periodIdx === periodIdx;

  const startersAll = period.onPitch.filter((pp) => pp.startMinute === 0).sort(sortByPosition);
  const arrivingPlayers = period.onPitch.filter((pp) => pp.startMinute > 0).sort((a, b) => a.startMinute - b.startMinute);

  return (
    <div className={`rounded-lg border p-3 ${isEditMode ? 'border-blue-300 bg-blue-50/30' : 'bg-card'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Quarter {period.period}</h4>
        <span className="text-xs text-muted-foreground">{period.startMinute}–{period.endMinute} min</span>
      </div>

      {/* On Pitch — large tap targets */}
      <div className="space-y-1">
        {startersAll.map((pp) => {
          const playerName = plan.summary.find((s) => s.playerId === pp.playerId)?.playerName ?? pp.playerId;
          const leavesEarly = pp.endMinute < periodDuration;
          const subMinute = leavesEarly ? period.startMinute + pp.endMinute : null;
          const isSelected = isSelectedPeriod && editSwapState?.playerId === pp.playerId;
          const matchingArrival = leavesEarly ? arrivingPlayers.find((ap) => ap.startMinute === pp.endMinute) : null;

          return (
            <div
              key={pp.playerId}
              onClick={() => isEditMode && onPlayerTap(periodIdx, pp.playerId)}
              className={`flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-md transition-colors ${
                isEditMode ? 'cursor-pointer active:bg-blue-100' : ''
              } ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
            >
              <Badge variant={pp.isGk ? 'warning' : 'secondary'} className="text-xs w-10 justify-center font-bold">
                {POSITION_SHORT[pp.position] ?? pp.position}
              </Badge>
              <span className={`flex-1 text-sm font-medium ${leavesEarly ? 'text-red-700' : ''}`}>{playerName}</span>
              {leavesEarly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEditMode && matchingArrival) {
                      onSubMinuteTap(periodIdx, pp.playerId, matchingArrival.playerId, subMinute!, period.startMinute + 1, period.endMinute - 1);
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    isEditMode ? 'bg-red-100 active:bg-red-200' : 'text-red-600'
                  }`}
                >
                  <span className="text-red-600 font-bold">▼</span>
                  <span className="text-red-600">{subMinute}'</span>
                </button>
              )}
            </div>
          );
        })}

        {/* Subs coming on */}
        {arrivingPlayers.length > 0 && (
          <>
            <div className="border-t border-dashed border-muted-foreground/30 my-2" />
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">Subs On</div>
            {arrivingPlayers.map((pp) => {
              const playerName = plan.summary.find((s) => s.playerId === pp.playerId)?.playerName ?? pp.playerId;
              const onMinute = period.startMinute + pp.startMinute;
              const isSelected = isSelectedPeriod && editSwapState?.playerId === pp.playerId;
              const matchingLeaver = startersAll.find((sp) => sp.endMinute === pp.startMinute && sp.endMinute < periodDuration);

              return (
                <div
                  key={`sub-${pp.playerId}`}
                  onClick={() => isEditMode && onPlayerTap(periodIdx, pp.playerId)}
                  className={`flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-md transition-colors ${
                    isEditMode ? 'cursor-pointer active:bg-blue-100' : ''
                  } ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                >
                  <span className="text-green-600 font-bold text-base">▲</span>
                  <Badge variant="secondary" className="text-xs w-10 justify-center font-bold">
                    {POSITION_SHORT[pp.position] ?? pp.position}
                  </Badge>
                  <span className="flex-1 text-sm font-medium text-green-700">{playerName}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditMode && matchingLeaver) {
                        onSubMinuteTap(periodIdx, matchingLeaver.playerId, pp.playerId, onMinute, period.startMinute + 1, period.endMinute - 1);
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      isEditMode ? 'bg-green-100 active:bg-green-200' : 'text-green-600'
                    }`}
                  >
                    <span className="text-green-600">{onMinute}'</span>
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Bench — large tap targets for easy selection */}
      {period.offPitch.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Bench</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {period.offPitch.map((pid) => {
              const name = plan.summary.find((s) => s.playerId === pid)?.playerName ?? pid;
              const isSelected = isSelectedPeriod && editSwapState?.playerId === pid;
              return (
                <button
                  key={pid}
                  onClick={() => isEditMode && onPlayerTap(periodIdx, pid)}
                  className={`min-h-[44px] px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isEditMode ? 'active:scale-95' : ''
                  } ${
                    isSelected
                      ? 'bg-blue-100 border-blue-400 text-blue-700 ring-2 ring-blue-400'
                      : 'bg-muted/50 border-border text-foreground'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOTTOM ACTION BAR ───────────────────────────────────────────────────────

interface BottomActionBarProps {
  isEditMode: boolean;
  wasManuallyEdited: boolean;
  approved: boolean;
  approvePending: boolean;
  selectedPlayerInfo: {
    onPitchEntry: PeriodPlayer | undefined;
    playerSummary: PlayerTimeSummary | undefined;
    isOnBench: boolean;
    period: PeriodPlan;
    periodIdx: number;
  } | null;
  onToggleEditMode: () => void;
  onResetPlan: () => void;
  onApprove: () => void;
  onDeselect: () => void;
  onShowPositionPicker: () => void;
}

function BottomActionBar({
  isEditMode, wasManuallyEdited, approved, approvePending,
  selectedPlayerInfo, onToggleEditMode, onResetPlan, onApprove, onDeselect, onShowPositionPicker,
}: BottomActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg safe-area-bottom md:static md:mt-4 md:border md:rounded-lg md:shadow-sm">
      <div className="px-4 py-3 md:max-w-none">
        {/* When a player is selected in edit mode, show contextual actions */}
        {isEditMode && selectedPlayerInfo ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{selectedPlayerInfo.playerSummary?.playerName}</span>
              {selectedPlayerInfo.onPitchEntry && (
                <Badge variant="secondary" className="text-xs">
                  {POSITION_SHORT[selectedPlayerInfo.onPitchEntry.position] ?? selectedPlayerInfo.onPitchEntry.position}
                </Badge>
              )}
            </div>
            {selectedPlayerInfo.onPitchEntry && !selectedPlayerInfo.isOnBench && (
              <Button variant="outline" size="sm" className="h-10" onClick={onShowPositionPicker}>
                <ChevronDown className="h-4 w-4" />
                Change Position
              </Button>
            )}
            <p className="text-xs text-muted-foreground flex-1">
              {selectedPlayerInfo.isOnBench ? 'Tap a player on pitch to swap' : 'Tap a bench player to swap'}
            </p>
            <button onClick={onDeselect} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          /* Default action bar — edit/approve controls */
          <div className="flex gap-2">
            <Button
              variant={isEditMode ? 'default' : 'outline'}
              className="flex-1 h-12 md:flex-none md:h-10"
              onClick={onToggleEditMode}
            >
              <Edit3 className="h-4 w-4" />
              {isEditMode ? 'Done' : 'Edit Plan'}
            </Button>
            {wasManuallyEdited && (
              <Button variant="outline" className="h-12 md:h-10" onClick={onResetPlan}>
                <RotateCcw className="h-4 w-4" />
                <span className="hidden md:inline">Reset</span>
              </Button>
            )}
            {!approved && (
              <Button className="flex-1 h-12 md:flex-none md:h-10" onClick={onApprove} disabled={approvePending}>
                <CheckCircle className="h-4 w-4" />
                {approvePending ? 'Saving...' : 'Approve'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── POSITION PICKER OVERLAY ─────────────────────────────────────────────────

function PositionPickerOverlay({ currentPosition, onSelect, onClose }: {
  currentPosition: string;
  onSelect: (pos: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full bg-card rounded-t-2xl p-4 pb-8 animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
        <h3 className="text-base font-semibold mb-4 text-center">Change Position</h3>
        <div className="grid grid-cols-4 gap-3">
          {ALL_POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => onSelect(pos)}
              className={`min-h-[52px] rounded-lg border text-sm font-bold transition-colors active:scale-95 ${
                pos === currentPosition
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 border-border active:bg-accent'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GK WARNING OVERLAY ──────────────────────────────────────────────────────

function GkWarningOverlay({ benchPlayerName, onClose }: {
  benchPlayerName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full bg-card rounded-t-2xl p-4 pb-8 animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h3 className="text-base font-semibold">Can't put in goal</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          <span className="font-medium text-foreground">{benchPlayerName}</span> isn't marked as a GK volunteer. Only players flagged as willing to go in goal can replace the goalkeeper.
        </p>
        <Button className="w-full h-12" onClick={onClose}>Got it</Button>
      </div>
    </div>
  );
}

// ─── SUB MINUTE SLIDER OVERLAY ───────────────────────────────────────────────

function SubMinuteSliderOverlay({ periodIdx, playerOffId, playerOnId, currentMinute, min, max, onConfirm, onClose, plan }: {
  periodIdx: number;
  playerOffId: string;
  playerOnId: string;
  currentMinute: number;
  min: number;
  max: number;
  onConfirm: (minute: number) => void;
  onClose: () => void;
  plan: SubstitutionPlan;
}) {
  const [value, setValue] = useState(currentMinute);
  const playerOffName = plan.summary.find(s => s.playerId === playerOffId)?.playerName ?? 'Player';
  const playerOnName = plan.summary.find(s => s.playerId === playerOnId)?.playerName ?? 'Sub';

  return (
    <div className="fixed inset-0 z-[60] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full bg-card rounded-t-2xl p-4 pb-8 animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
        <h3 className="text-base font-semibold mb-2 text-center">Sub Timing</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          <span className="text-red-600">▼ {playerOffName}</span>
          {' → '}
          <span className="text-green-600">▲ {playerOnName}</span>
        </p>

        {/* Large minute display */}
        <div className="text-center mb-4">
          <span className="text-4xl font-bold tabular-nums">{value}</span>
          <span className="text-lg text-muted-foreground ml-1">min</span>
        </div>

        {/* Range slider — large touch target */}
        <div className="px-2 mb-6">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full h-10 accent-primary cursor-pointer appearance-none bg-transparent
              [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-muted
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:mt-[-12px] [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{min}'</span>
            <span>{max}'</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-12" onClick={() => onConfirm(value)}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}

// ─── MOBILE TIME SUMMARY ─────────────────────────────────────────────────────

function MobileTimeSummary({ plan, config }: { plan: SubstitutionPlan; config: EngineConfig }) {
  const sorted = [...plan.summary].sort((a, b) => a.playerName.localeCompare(b.playerName));
  const maxMinutes = config.matchDurationMinutes;

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <CardTitle className="text-sm">Playing Time</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* Mobile: progress bars */}
        <div className="md:hidden space-y-2">
          {sorted.map((s) => (
            <div key={s.playerId} className="flex items-center gap-3 min-h-[36px]">
              <span className="text-xs font-medium w-24 truncate">{s.playerName}</span>
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-primary/70 rounded-full transition-all"
                  style={{ width: `${(s.totalMinutes / maxMinutes) * 100}%` }}
                />
                {s.gkMinutes > 0 && (
                  <div
                    className="absolute top-0 left-0 h-full bg-amber-400/70 rounded-full"
                    style={{ width: `${(s.gkMinutes / maxMinutes) * 100}%` }}
                  />
                )}
              </div>
              <span className="text-xs font-bold tabular-nums w-10 text-right">{s.totalMinutes}m</span>
            </div>
          ))}
        </div>

        {/* Desktop: full table with quarter breakdown */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Player</th>
                {plan.periods.map((p) => (
                  <th key={p.period} className="pb-2 font-medium text-right">Q{p.period}</th>
                ))}
                <th className="pb-2 font-medium text-right">Outfield</th>
                <th className="pb-2 font-medium text-right">GK</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const quarterMinutes = plan.periods.map((period) => {
                  const entry = period.onPitch.find((pp) => pp.playerId === s.playerId);
                  if (entry) return Math.round((entry.endMinute - entry.startMinute) * 10) / 10;
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
                    <td className="py-2 text-right">{s.outfieldMinutes}</td>
                    <td className="py-2 text-right">{s.gkMinutes > 0 ? s.gkMinutes : '-'}</td>
                    <td className="py-2 text-right font-bold">{s.totalMinutes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SUBSTITUTION ROW ────────────────────────────────────────────────────────

function SubstitutionRow({ sub, plan }: { sub: SubstitutionEvent; plan: SubstitutionPlan }) {
  const playerOff = plan.summary.find((s) => s.playerId === sub.playerOffId);
  const playerOn = plan.summary.find((s) => s.playerId === sub.playerOnId);

  return (
    <div className="flex items-center gap-3 min-h-[40px] rounded-md bg-muted/50 px-3 py-2">
      <span className="font-mono text-xs text-muted-foreground w-8">{sub.minute}'</span>
      <Badge variant="secondary" className="text-xs">Q{sub.period}</Badge>
      <div className="flex-1 flex items-center gap-2 text-sm">
        <span className="text-red-600">▼ {playerOff?.playerName?.split(' ')[0]}</span>
        <span className="text-green-600">▲ {playerOn?.playerName?.split(' ')[0]}</span>
      </div>
    </div>
  );
}

// ─── HELPER: RECALCULATE SUMMARY ─────────────────────────────────────────────

function recalculateSummary(
  periods: PeriodPlan[],
  availablePlayers: PlayerForSelection[],
  config: EngineConfig
): PlayerTimeSummary[] {
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
        if (onPitchEntry.isGk) { gkMinutes += minutes; periodsInGoal++; }
        else { outfieldMinutes += minutes; }
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
