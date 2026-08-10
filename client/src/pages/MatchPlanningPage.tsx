import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wand2, Save, Trash2, Copy, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFixtures } from '@/hooks/use-fixtures';
import { usePlayers } from '@/hooks/use-players';
import { PitchView, getFormationSlots, type PitchSlot } from '@/components/match-planning/PitchView';
import { PlayerPool, type PlayerPoolEntry } from '@/components/match-planning/PlayerPool';
import { IntelligencePanel, type PlanIntelligence } from '@/components/match-planning/IntelligencePanel';
import { PlayingTimeTable } from '@/components/match-planning/PlayingTimeTable';
import { SubstitutionPanel } from '@/components/match-planning/SubstitutionPanel';
import { SavedPlansPanel } from '@/components/match-planning/SavedPlansPanel';
import { api } from '@/lib/api';
import type { PlayerForSelection } from '@/services/team-selection.service';
import type { Fixture } from '@/services/fixture.service';

interface MatchPlan {
  id: string;
  fixtureId: string;
  status: string;
  formation: string | null;
  periods: number;
  periodDurationMinutes: string;
  matchDurationMinutes: number;
  outfieldSlots: number;
  generatedBy: string | null;
}

interface SlotData {
  id: string;
  matchPlanId: string;
  period: number;
  playerId: string;
  position: string;
  isGk: boolean;
  startMinute: number;
  endMinute: number;
}

interface SlotInput {
  period: number;
  playerId: string;
  position: string;
  isGk?: boolean;
  startMinute?: number;
  endMinute?: number;
}

/**
 * Match Planning Page — visual pitch-based workspace.
 * Coach can start from blank or generate, then edit freely.
 */
export function MatchPlanningPage() {
  const [searchParams] = useSearchParams();
  const fixtureFromUrl = searchParams.get('fixture') ?? undefined;
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | undefined>(fixtureFromUrl);
  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [allSlots, setAllSlots] = useState<SlotData[]>([]);
  const [activePeriod, setActivePeriod] = useState(1);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedPoolPlayer, setSelectedPoolPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'pitch' | 'time' | 'overview'>('pitch');
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string>>({});
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [lastSavedSlots, setLastSavedSlots] = useState<string>('[]'); // JSON for dirty check

  const { data: fixtures } = useFixtures({ status: 'upcoming' });
  const { data: players } = usePlayers();
  const matchFixtures = fixtures?.filter(f => f.type !== 'training') ?? [];

  // Auto-select first fixture
  if (!selectedFixtureId && matchFixtures.length > 0) {
    setSelectedFixtureId(matchFixtures[0].id);
  }

  // Load plan and availability when fixture changes
  useEffect(() => {
    if (!selectedFixtureId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<{ data: { plan: MatchPlan; slots: SlotData[] } }>(`/match-plans/${selectedFixtureId}`),
      api.get<{ data: any[] }>(`/fixtures/${selectedFixtureId}/availability`).catch(() => ({ data: [] })),
    ])
      .then(([planRes, availRes]) => {
        setPlan(planRes.data.plan);
        setAllSlots(planRes.data.slots);
        setLastSavedSlots(JSON.stringify(planRes.data.slots));
        // Build availability map: playerId -> status
        const avMap: Record<string, string> = {};
        const avData = Array.isArray(availRes.data) ? availRes.data : (availRes as any)?.data ?? [];
        for (const a of avData) {
          if (a.playerId && a.status) avMap[a.playerId] = a.status;
        }
        setAvailabilityMap(avMap);
        // Fetch versions
        api.get<{ data: any[] }>(`/match-plans/${selectedFixtureId}/versions`)
          .then(res => setVersions(res.data ?? []))
          .catch(() => setVersions([]));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedFixtureId]);

  const defaultFormation = plan?.formation ?? '2-3-1';
  const [periodFormations, setPeriodFormations] = useState<Record<string, string>>({});
  const periodDuration = Number(plan?.periodDurationMinutes ?? 12);
  const totalPeriods = plan?.periods ?? 4;
  const matchDuration = plan?.matchDurationMinutes ?? 48;

  // Get formation for the active period
  const formation = periodFormations[String(activePeriod)] ?? defaultFormation;

  // Load period formations from plan
  useEffect(() => {
    if (plan?.periodFormations) {
      try { setPeriodFormations(JSON.parse(plan.periodFormations)); } catch { setPeriodFormations({}); }
    } else {
      setPeriodFormations({});
    }
  }, [plan?.periodFormations]);

  // Current period's slots
  const periodSlots = useMemo(() => allSlots.filter(s => s.period === activePeriod), [allSlots, activePeriod]);

  // Build available players list filtered by fixture availability
  const availablePlayers: PlayerForSelection[] = useMemo(() => {
    return (players ?? [])
      .filter(p => {
        const status = availabilityMap[p.id];
        if (showUnavailable) return true; // coach override: show all
        return status === 'available'; // only show available players
      })
      .map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        primaryPosition: p.primaryPosition,
        secondaryPosition: p.secondaryPosition ?? null,
        tertiaryPosition: p.tertiaryPosition ?? null,
        isGkVolunteer: p.isGkVolunteer,
      }));
  }, [players, availabilityMap, showUnavailable]);

  // Players in the plan who are now unavailable (availability changed after selection)
  const unavailableInPlan = useMemo(() => {
    const plannedPlayerIds = new Set(allSlots.map(s => s.playerId));
    return [...plannedPlayerIds].filter(pid => {
      const status = availabilityMap[pid];
      return status === 'unavailable' || status === 'unknown';
    });
  }, [allSlots, availabilityMap]);

  // Convert DB slots to PitchSlot format for rendering
  const pitchSlots: PitchSlot[] = useMemo(() => {
    const formSlots = getFormationSlots(formation);
    return formSlots.map(fs => {
      // Find ALL players assigned to this position in this period
      const positionSlots = periodSlots.filter(s => {
        if (fs.isGk && s.isGk) return true;
        return s.position === fs.position && !s.isGk;
      }).sort((a, b) => a.startMinute - b.startMinute);

      if (positionSlots.length === 0) return fs;

      // Build segments from all players sharing this position
      const segments = positionSlots.map(s => {
        const player = availablePlayers.find(p => p.id === s.playerId) ||
          (players ?? []).find(p => p.id === s.playerId);
        return {
          playerId: s.playerId,
          playerName: player ? `${player.firstName} ${player.lastName}` : s.playerId,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
          isGk: s.isGk,
        };
      });

      // First player is the "primary" for the slot
      const firstPlayer = availablePlayers.find(p => p.id === positionSlots[0].playerId) ||
        (players ?? []).find(p => p.id === positionSlots[0].playerId);

      return {
        ...fs,
        playerId: positionSlots[0].playerId,
        playerName: firstPlayer ? `${firstPlayer.firstName} ${firstPlayer.lastName}` : positionSlots[0].playerId,
        segments: segments.length > 1 ? segments : undefined,
      };
    });
  }, [formation, periodSlots, availablePlayers, players]);

  // Calculate playing time for each player across all periods
  const playerMinutes = useMemo(() => {
    const map = new Map<string, { total: number; outfield: number; gk: number; periods: Set<number> }>();
    for (const slot of allSlots) {
      const mins = slot.endMinute - slot.startMinute;
      const existing = map.get(slot.playerId) ?? { total: 0, outfield: 0, gk: 0, periods: new Set() };
      existing.total += mins;
      if (slot.isGk) existing.gk += mins;
      else existing.outfield += mins;
      existing.periods.add(slot.period);
      map.set(slot.playerId, existing);
    }
    return map;
  }, [allSlots]);

  // Player pool entries
  const poolEntries: PlayerPoolEntry[] = useMemo(() => {
    return availablePlayers.map(player => {
      const mins = playerMinutes.get(player.id);
      return {
        player,
        plannedMinutes: mins?.total ?? 0,
        outfieldMinutes: mins?.outfield ?? 0,
        gkMinutes: mins?.gk ?? 0,
        periodsPlayed: mins?.periods.size ?? 0,
        isAllocated: (mins?.total ?? 0) > 0,
      };
    });
  }, [availablePlayers, playerMinutes]);

  // Target outfield minutes per player (for fairness comparison)
  const targetMinutes = useMemo(() => {
    if (availablePlayers.length === 0) return 0;
    // Target = total outfield slot-minutes / number of players
    return Math.round(matchDuration * (plan?.outfieldSlots ?? 6) / availablePlayers.length);
  }, [matchDuration, plan, availablePlayers]);

  // Intelligence data — fairness uses OUTFIELD minutes only
  const intelligence: PlanIntelligence = useMemo(() => {
    const allocatedEntries = poolEntries.filter(e => e.isAllocated);
    // Use outfield minutes for fairness (GK minutes don't count toward balance)
    const outfieldMins = poolEntries.map(e => e.outfieldMinutes);
    const allocatedOutfield = outfieldMins.filter(m => m > 0);

    const warnings: string[] = [];
    if (allocatedOutfield.length > 0) {
      const diff = Math.max(...allocatedOutfield) - Math.min(...allocatedOutfield);
      if (diff > 5) warnings.push(`${diff} min outfield difference between highest and lowest`);
    }
    // Also check for players with zero minutes (total, not just outfield)
    const totalAllocated = poolEntries.filter(e => e.plannedMinutes > 0);

    return {
      availableCount: availablePlayers.length,
      selectedCount: totalAllocated.length,
      notAllocatedCount: poolEntries.filter(e => !e.isAllocated).length,
      highestMinutes: allocatedOutfield.length > 0 ? Math.max(...allocatedOutfield) : 0,
      lowestMinutes: allocatedOutfield.length > 0 ? Math.min(...allocatedOutfield) : 0,
      averageMinutes: allocatedOutfield.length > 0 ? Math.round(allocatedOutfield.reduce((a, b) => a + b, 0) / allocatedOutfield.length) : 0,
      warnings,
    };
  }, [poolEntries, availablePlayers]);

  // Track unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(allSlots) !== lastSavedSlots;
  }, [allSlots, lastSavedSlots]);

  const fetchVersions = useCallback(() => {
    if (!selectedFixtureId) return;
    api.get<{ data: any[] }>(`/match-plans/${selectedFixtureId}/versions`)
      .then(res => setVersions(res.data ?? []))
      .catch(() => {});
  }, [selectedFixtureId]);

  /** Restore a saved version */
  const handleRestoreVersion = useCallback(async (versionId: string) => {
    if (!selectedFixtureId) return;
    try {
      const res = await api.post<{ data: { plan: MatchPlan; slots: SlotData[] } }>(`/match-plans/${selectedFixtureId}/versions/${versionId}/restore`, {});
      setPlan(res.data.plan);
      setAllSlots(res.data.slots);
      setLastSavedSlots(JSON.stringify(res.data.slots));
    } catch {}
  }, [selectedFixtureId]);

  // === ACTIONS ===

  /** Place a player from the pool into a slot */
  const handlePlacePlayer = useCallback((slotId: string, playerId: string) => {
    const formSlots = getFormationSlots(formation);
    const targetSlot = formSlots.find(s => s.id === slotId);
    if (!targetSlot) return;

    const newSlot: SlotData = {
      id: `temp-${Date.now()}`,
      matchPlanId: plan?.id ?? '',
      period: activePeriod,
      playerId,
      position: targetSlot.position,
      isGk: targetSlot.isGk ?? false,
      startMinute: 0,
      endMinute: periodDuration,
    };

    // Remove any existing assignment for this slot position + period
    const updated = allSlots.filter(s => !(s.period === activePeriod && s.position === targetSlot.position && s.isGk === (targetSlot.isGk ?? false) && s.startMinute === 0));
    setAllSlots([...updated, newSlot]);
    setSelectedSlotId(null);
    setSelectedPoolPlayer(null);
  }, [formation, activePeriod, periodDuration, plan, allSlots]);

  /** Remove a player from a slot */
  const handleRemoveFromSlot = useCallback((slotId: string) => {
    const formSlots = getFormationSlots(formation);
    const targetSlot = formSlots.find(s => s.id === slotId);
    if (!targetSlot) return;

    setAllSlots(prev => prev.filter(s => !(s.period === activePeriod && s.position === targetSlot.position && s.isGk === (targetSlot.isGk ?? false) && s.startMinute === 0)));
    setSelectedSlotId(null);
  }, [formation, activePeriod]);

  /** Swap two players on the pitch */
  const handleSwapSlots = useCallback((slotIdA: string, slotIdB: string) => {
    const formSlots = getFormationSlots(formation);
    const slotA = formSlots.find(s => s.id === slotIdA);
    const slotB = formSlots.find(s => s.id === slotIdB);
    if (!slotA || !slotB) return;

    setAllSlots(prev => prev.map(s => {
      if (s.period !== activePeriod) return s;
      const dbSlotA = prev.find(x => x.period === activePeriod && x.position === slotA.position && x.isGk === (slotA.isGk ?? false) && x.startMinute === 0);
      const dbSlotB = prev.find(x => x.period === activePeriod && x.position === slotB.position && x.isGk === (slotB.isGk ?? false) && x.startMinute === 0);
      if (s === dbSlotA && dbSlotB) return { ...s, position: slotB.position, isGk: slotB.isGk ?? false };
      if (s === dbSlotB && dbSlotA) return { ...s, position: slotA.position, isGk: slotA.isGk ?? false };
      return s;
    }));
    setSelectedSlotId(null);
  }, [formation, activePeriod]);

  /** Handle slot tap — context-dependent */
  const handleSlotTap = useCallback((slotId: string) => {
    const slot = pitchSlots.find(s => s.id === slotId);
    if (!slot) return;

    // If a pool player is selected, place them into this slot
    if (selectedPoolPlayer) {
      handlePlacePlayer(slotId, selectedPoolPlayer);
      return;
    }

    // If another slot is already selected, swap them
    if (selectedSlotId && selectedSlotId !== slotId) {
      const prevSlot = pitchSlots.find(s => s.id === selectedSlotId);
      if (prevSlot?.playerId && slot.playerId) {
        handleSwapSlots(selectedSlotId, slotId);
      } else if (prevSlot?.playerId && !slot.playerId) {
        // Move from filled slot to empty slot
        handlePlacePlayer(slotId, prevSlot.playerId);
        handleRemoveFromSlot(selectedSlotId);
      }
      return;
    }

    // Select/deselect this slot
    setSelectedSlotId(selectedSlotId === slotId ? null : slotId);
    setSelectedPoolPlayer(null);
  }, [pitchSlots, selectedPoolPlayer, selectedSlotId, handlePlacePlayer, handleSwapSlots, handleRemoveFromSlot]);

  /** Handle player pool tap */
  const handlePoolPlayerTap = useCallback((playerId: string) => {
    // If a slot is selected, place this player there
    if (selectedSlotId) {
      handlePlacePlayer(selectedSlotId, playerId);
      return;
    }
    // Toggle selection
    setSelectedPoolPlayer(selectedPoolPlayer === playerId ? null : playerId);
    setSelectedSlotId(null);
  }, [selectedSlotId, selectedPoolPlayer, handlePlacePlayer]);

  /** Copy previous period into active period */
  const handleCopyPeriod = useCallback((fromPeriod: number) => {
    const source = allSlots.filter(s => s.period === fromPeriod);
    const copied: SlotData[] = source.map(s => ({
      ...s,
      id: `temp-${Date.now()}-${Math.random()}`,
      period: activePeriod,
    }));
    // Remove existing slots for active period, add copied
    const filtered = allSlots.filter(s => s.period !== activePeriod);
    setAllSlots([...filtered, ...copied]);
  }, [allSlots, activePeriod]);

  /** Clear current period */
  const handleClearPeriod = useCallback(() => {
    setAllSlots(prev => prev.filter(s => s.period !== activePeriod));
  }, [activePeriod]);

  /** Change formation for the active period */
  const handleFormationChange = useCallback(async (newFormation: string) => {
    setPeriodFormations(prev => ({ ...prev, [String(activePeriod)]: newFormation }));
    if (selectedFixtureId) {
      try {
        await api.put(`/match-plans/${selectedFixtureId}/formation/${activePeriod}`, { formation: newFormation });
      } catch {}
    }
  }, [activePeriod, selectedFixtureId]);

  /** Add a within-period substitution */
  const handleAddSub = useCallback((playerOffId: string, playerOnId: string, minute: number, position: string, isGk: boolean) => {
    setAllSlots(prev => {
      // Find the off-player's current slot and shorten it
      const updated = prev.map(s => {
        if (s.period === activePeriod && s.playerId === playerOffId && s.startMinute === 0 && s.endMinute === periodDuration) {
          return { ...s, endMinute: minute };
        }
        return s;
      });
      // Add the on-player's slot starting at the sub minute
      const newSlot: SlotData = {
        id: `temp-sub-${Date.now()}`,
        matchPlanId: plan?.id ?? '',
        period: activePeriod,
        playerId: playerOnId,
        position,
        isGk,
        startMinute: minute,
        endMinute: periodDuration,
      };
      return [...updated, newSlot];
    });
  }, [activePeriod, periodDuration, plan]);

  /** Edit a substitution minute */
  const handleEditSubMinute = useCallback((playerOffId: string, playerOnId: string, newMinute: number) => {
    setAllSlots(prev => prev.map(s => {
      if (s.period !== activePeriod) return s;
      // Adjust the off-player's end
      if (s.playerId === playerOffId && s.startMinute === 0) return { ...s, endMinute: newMinute };
      // Adjust the on-player's start
      if (s.playerId === playerOnId && s.startMinute > 0) return { ...s, startMinute: newMinute };
      return s;
    }));
  }, [activePeriod]);

  /** Delete a substitution (restore off-player to full, remove on-player) */
  const handleDeleteSub = useCallback((playerOffId: string, playerOnId: string) => {
    setAllSlots(prev => {
      const updated = prev
        .filter(s => !(s.period === activePeriod && s.playerId === playerOnId && s.startMinute > 0))
        .map(s => {
          if (s.period === activePeriod && s.playerId === playerOffId && s.startMinute === 0) {
            return { ...s, endMinute: periodDuration };
          }
          return s;
        });
      return updated;
    });
  }, [activePeriod, periodDuration]);

  /** Generate plan using engine */
  const handleGenerate = async () => {
    if (!selectedFixtureId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ data: { plan: MatchPlan; slots: SlotData[] } }>(`/match-plans/${selectedFixtureId}/generate`, {});
      setPlan(res.data.plan);
      setAllSlots(res.data.slots);
      setActivePeriod(1);
    } catch (err: any) {
      setError(err.message || 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  /** Save current slots to server */
  const handleSave = async () => {
    if (!selectedFixtureId) return;
    setSaving(true);
    setError(null);
    try {
      // Send all slots grouped by period
      const slotsToSave: SlotInput[] = allSlots.map(s => ({
        period: s.period,
        playerId: s.playerId,
        position: s.position,
        isGk: s.isGk,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      }));
      const res = await api.put<{ data: SlotData[] }>(`/match-plans/${selectedFixtureId}/slots`, { slots: slotsToSave });
      setAllSlots(res.data);
      setLastSavedSlots(JSON.stringify(res.data));
      // Update status to draft if not already
      if (plan?.status === 'not_started') {
        await api.put(`/match-plans/${selectedFixtureId}/status`, { status: 'draft' });
        setPlan(prev => prev ? { ...prev, status: 'draft' } : prev);
      }
      // Auto-create a version snapshot so this draft is always recoverable
      const timestamp = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await api.post(`/match-plans/${selectedFixtureId}/versions`, { name: `Draft — ${timestamp}` });
      fetchVersions();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /** Mark plan as ready */
  const handleMarkReady = async () => {
    if (!selectedFixtureId) return;
    await handleSave();
    try {
      await api.put(`/match-plans/${selectedFixtureId}/status`, { status: 'ready' });
      setPlan(prev => prev ? { ...prev, status: 'ready' } : prev);
    } catch {}
  };

  // Get selected fixture info
  const selectedFixture = matchFixtures.find(f => f.id === selectedFixtureId);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Match Planning</h2>
        <p className="text-sm text-muted-foreground">Build your team visually, period by period.</p>
      </div>

      {/* Fixture selector */}
      {matchFixtures.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No upcoming fixtures.</div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {matchFixtures.map(fixture => (
              <button
                key={fixture.id}
                onClick={() => { setSelectedFixtureId(fixture.id); setActivePeriod(1); setSelectedSlotId(null); setSelectedPoolPlayer(null); }}
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

          {/* Error */}
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading plan...</div>
          ) : plan ? (
            <>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleGenerate} disabled={loading} variant="outline" size="sm">
                  <Wand2 className="h-4 w-4" /> Generate Team
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm">
                  <Save className="h-4 w-4" /> {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Draft'}
                </Button>
                <Button onClick={handleMarkReady} disabled={saving} variant="default" size="sm">
                  <Check className="h-4 w-4" /> Mark Ready
                </Button>
                {plan.status !== 'not_started' && (
                  <Badge variant={plan.status === 'ready' ? 'success' : 'secondary'} className="self-center">
                    {plan.status}
                  </Badge>
                )}
              </div>

              {/* Period tabs */}
              <div className="flex border-b">
                {Array.from({ length: totalPeriods }, (_, i) => i + 1).map(period => {
                  const periodHasSlots = allSlots.some(s => s.period === period);
                  return (
                    <button
                      key={period}
                      onClick={() => { setActivePeriod(period); setSelectedSlotId(null); setSelectedPoolPlayer(null); }}
                      className={`flex-1 py-3 text-center text-sm font-medium min-h-[44px] transition-colors relative ${
                        activePeriod === period ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      Q{period}
                      {periodHasSlots && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />}
                    </button>
                  );
                })}
              </div>

              {/* Period actions + formation selector */}
              <div className="flex items-center gap-2 flex-wrap">
                {activePeriod > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => handleCopyPeriod(activePeriod - 1)}>
                    <Copy className="h-3.5 w-3.5" /> Copy Q{activePeriod - 1}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleClearPeriod}>
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] text-muted-foreground">Formation:</span>
                  <select
                    value={formation}
                    onChange={(e) => handleFormationChange(e.target.value)}
                    className="text-xs border rounded px-2 py-1 bg-background h-7"
                  >
                    {(plan?.outfieldSlots === 4 ? ['1-2-1', '2-1-1', '1-1-2', '2-2'] :
                      plan?.outfieldSlots === 6 ? ['2-3-1', '1-4-1', '1-3-2', '3-2-1', '2-2-2'] :
                      plan?.outfieldSlots === 8 ? ['2-3-3', '3-2-3', '2-4-2', '3-3-2'] :
                      plan?.outfieldSlots === 10 ? ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'] :
                      ['2-3-1']).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* View toggle: Pitch | Playing Time | Overview */}
              <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
                <button
                  onClick={() => setViewMode('pitch')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'pitch' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Pitch
                </button>
                <button
                  onClick={() => setViewMode('time')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'time' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Playing Time
                </button>
                <button
                  onClick={() => setViewMode('overview')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'overview' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Full Match
                </button>
              </div>

              {/* Availability warning: players in plan now unavailable */}
              {unavailableInPlan.length > 0 && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  <span className="font-medium">⚠ Availability changed:</span>{' '}
                  {unavailableInPlan.map(pid => {
                    const p = (players ?? []).find(pl => pl.id === pid);
                    return p ? `${p.firstName} ${p.lastName}` : pid;
                  }).join(', ')}{' '}
                  {unavailableInPlan.length === 1 ? 'is' : 'are'} now marked unavailable but still in the plan. Please review.
                </div>
              )}

              {/* Show unavailable toggle */}
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={showUnavailable}
                  onChange={(e) => setShowUnavailable(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                Show unavailable players
              </label>

              {viewMode === 'time' ? (
                /* Playing Time Table view */
                <Card>
                  <CardContent className="p-4">
                    <PlayingTimeTable
                      slots={allSlots}
                      players={availablePlayers}
                      periods={totalPeriods}
                      periodDuration={periodDuration}
                      matchDuration={matchDuration}
                      outfieldSlots={plan?.outfieldSlots ?? 6}
                    />
                  </CardContent>
                </Card>
              ) : viewMode === 'overview' ? (
                /* Full Match Overview — all periods on one page */
                <div className="space-y-4 print:space-y-2">
                  {/* Match header for screenshot/print */}
                  <div className="text-center py-2 border-b print:border-0">
                    <p className="text-lg font-bold">{selectedFixture?.homeAway === 'home' ? 'vs' : '@'} {selectedFixture?.opponent}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFixture && new Date(selectedFixture.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {selectedFixture?.kickOffTime && ` — KO ${selectedFixture.kickOffTime}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Formation: {formation} | {totalPeriods} × {periodDuration} min</p>
                  </div>

                  {/* All periods as compact pitches */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:gap-2">
                    {Array.from({ length: totalPeriods }, (_, i) => i + 1).map(period => {
                      const pSlots = allSlots.filter(s => s.period === period);
                      const pFormation = periodFormations[String(period)] ?? defaultFormation;
                      const formSlots = getFormationSlots(pFormation);
                      const pPitchSlots: PitchSlot[] = formSlots.map(fs => {
                        const posSlots = pSlots.filter(s => {
                          if (fs.isGk && s.isGk) return true;
                          return s.position === fs.position && !s.isGk;
                        }).sort((a, b) => a.startMinute - b.startMinute);

                        if (posSlots.length === 0) return fs;

                        const segments = posSlots.map(s => {
                          const p = availablePlayers.find(pl => pl.id === s.playerId) || (players ?? []).find(pl => pl.id === s.playerId);
                          return { playerId: s.playerId, playerName: p ? `${p.firstName} ${p.lastName}` : '?', startMinute: s.startMinute, endMinute: s.endMinute, isGk: s.isGk };
                        });
                        const firstP = availablePlayers.find(p => p.id === posSlots[0].playerId) || (players ?? []).find(p => p.id === posSlots[0].playerId);
                        return {
                          ...fs,
                          playerId: posSlots[0].playerId,
                          playerName: firstP ? `${firstP.firstName} ${firstP.lastName}` : '?',
                          segments: segments.length > 1 ? segments : undefined,
                        };
                      });

                      // Subs for this period (for the text list below pitch)
                      const subs = pSlots
                        .filter(s => s.endMinute < periodDuration && s.startMinute === 0)
                        .map(offSlot => {
                          const onSlot = pSlots.find(s => s.position === offSlot.position && s.startMinute === offSlot.endMinute);
                          if (!onSlot) return null;
                          const offP = (players ?? []).find(p => p.id === offSlot.playerId);
                          const onP = (players ?? []).find(p => p.id === onSlot.playerId);
                          return { minute: offSlot.endMinute, off: offP?.firstName ?? '?', on: onP?.firstName ?? '?' };
                        })
                        .filter(Boolean) as { minute: number; off: string; on: string }[];

                      return (
                        <div key={period} className="space-y-1">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold">Q{period} <span className="font-normal text-muted-foreground">{pFormation}</span></span>
                            <button
                              onClick={() => { setActivePeriod(period); setViewMode('pitch'); }}
                              className="text-[10px] text-primary hover:underline print:hidden"
                            >
                              Edit
                            </button>
                          </div>
                          <PitchView
                            formation={pFormation}
                            slots={pPitchSlots}
                            availablePlayers={availablePlayers}
                            periodDuration={periodDuration}
                            compact
                          />
                          {subs.length > 0 && (
                            <div className="space-y-0.5 px-1">
                              {subs.map((sub, i) => (
                                <div key={i} className="text-[10px] text-muted-foreground">
                                  {sub.minute}' {sub.off} → {sub.on}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Playing time summary below */}
                  <Card className="print:shadow-none print:border-0">
                    <CardContent className="p-4">
                      <PlayingTimeTable
                        slots={allSlots}
                        players={availablePlayers}
                        periods={totalPeriods}
                        periodDuration={periodDuration}
                        matchDuration={matchDuration}
                        outfieldSlots={plan?.outfieldSlots ?? 6}
                      />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                /* Pitch view workspace */
                <>
                  {/* Main workspace: Pitch + Pool */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
                    {/* Pitch */}
                    <div>
                      <PitchView
                        formation={formation}
                        slots={pitchSlots}
                        availablePlayers={availablePlayers}
                        selectedSlotId={selectedSlotId}
                        selectedPoolPlayerId={selectedPoolPlayer}
                        onSlotTap={handleSlotTap}
                        periodDuration={periodDuration}
                      />

                      {/* Selection hint */}
                      {(selectedSlotId || selectedPoolPlayer) && (
                        <div className="mt-2 text-xs text-center text-muted-foreground bg-blue-50 rounded-md p-2">
                          {selectedPoolPlayer && 'Now tap a position on the pitch to place this player'}
                          {selectedSlotId && !selectedPoolPlayer && 'Tap another position to swap, or tap a player in the pool to replace'}
                        </div>
                      )}

                      {/* Substitution panel */}
                      <div className="mt-3">
                        <SubstitutionPanel
                          period={activePeriod}
                          periodDuration={periodDuration}
                          slots={periodSlots}
                          availablePlayers={availablePlayers}
                          onAddSub={handleAddSub}
                          onEditSubMinute={handleEditSubMinute}
                          onDeleteSub={handleDeleteSub}
                        />
                      </div>
                    </div>

                    {/* Sidebar: Pool + Intelligence */}
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-sm">Available Players</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <PlayerPool
                            entries={poolEntries}
                            targetMinutes={targetMinutes}
                            selectedPlayerId={selectedPoolPlayer}
                            onPlayerTap={handlePoolPlayerTap}
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-sm">Plan Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <IntelligencePanel data={intelligence} />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-sm">Saved Plans</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <SavedPlansPanel
                            fixtureId={selectedFixtureId!}
                            versions={versions}
                            onVersionsChange={fetchVersions}
                            onRestore={handleRestoreVersion}
                            hasUnsavedChanges={hasUnsavedChanges}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
