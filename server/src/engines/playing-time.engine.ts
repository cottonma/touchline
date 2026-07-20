/**
 * Equal Playing Time Engine — Minute-Level Balancing with Rolling Subs
 * 
 * Core algorithm that generates balanced substitution plans ensuring:
 * - Equal outfield minutes for all available players within each match (±tolerance)
 * - No player sits out more than maxConsecutiveBenchPeriods FULL consecutive periods
 *   (a player who plays even 1 minute of a period is not "benched" for that period)
 * - GK volunteers rotate, playing full outfield in non-GK periods (Option A)
 * - GK is never substituted mid-period while in goal
 * - Mid-period substitutions (rolling subs) balance playing time to within tolerance
 * 
 * Algorithm overview:
 * 1. Assign GK to periods, calculate GK reward outfield slots
 * 2. Calculate target minutes per pure outfield player
 * 3. Base assignment: round-robin whole-period slots
 * 4. Fine-tune with mid-period subs where imbalance exceeds tolerance
 */

export interface PlayerForSelection {
  id: string;
  firstName: string;
  lastName: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  isGkVolunteer: boolean;
}

export interface EngineConfig {
  matchDurationMinutes: number;
  periods: number;
  outfieldSlots: number; // e.g. 6 for 7v7
  toleranceMinutes: number;
  maxConsecutiveBenchPeriods: number;
  gkRewardFullOutfield: boolean;
  formation: string | null; // e.g. "2-3-1" — numbers are defence to attack lines
  minSubMinutes: number; // minimum minutes a player must get when subbed on/off mid-period
}

export interface PeriodPlayer {
  playerId: string;
  position: string;
  isGk: boolean;
  startMinute: number; // minute within the period this player comes on (0 = start)
  endMinute: number;   // minute within the period this player goes off (periodDuration = end)
}

export interface PeriodPlan {
  period: number;
  startMinute: number;
  endMinute: number;
  onPitch: PeriodPlayer[];
  offPitch: string[]; // player IDs fully benched for this period
  gkPlayerId: string;
}

export interface PlayerTimeSummary {
  playerId: string;
  playerName: string;
  outfieldMinutes: number;
  gkMinutes: number;
  totalMinutes: number;
  periodsPlayed: number;
  periodsOnBench: number;
  periodsInGoal: number;
}

export interface GkAssignment {
  playerId: string;
  periods: number[]; // which periods they're in goal
}

export interface SubstitutionEvent {
  minute: number;        // match minute when the sub happens
  periodMinute: number;  // minute within the period
  period: number;
  playerOffId: string;
  playerOnId: string;
}

export interface SubstitutionPlan {
  periods: PeriodPlan[];
  substitutions: SubstitutionEvent[];
  summary: PlayerTimeSummary[];
  gkAssignments: GkAssignment[];
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Generate a balanced substitution plan for a match using minute-level balancing.
 */
export function generateSubstitutionPlan(
  availablePlayers: PlayerForSelection[],
  gkAssignments: GkAssignment[],
  config: EngineConfig,
): SubstitutionPlan {
  const { matchDurationMinutes, periods, outfieldSlots, toleranceMinutes, maxConsecutiveBenchPeriods, gkRewardFullOutfield, formation } = config;
  const periodDuration = matchDurationMinutes / periods;
  const totalPlayers = availablePlayers.length;

  // Generate formation position slots (e.g. ["LB", "RB", "LM", "CM", "RM", "CF"])
  const formationSlots = formation ? getFormationPositionSlots(formation) : null;

  // Validation
  const validationErrors: string[] = [];
  if (totalPlayers < outfieldSlots + 1) {
    validationErrors.push(`Need at least ${outfieldSlots + 1} players for ${outfieldSlots + 1}-a-side. Only ${totalPlayers} available.`);
    return { periods: [], substitutions: [], summary: [], gkAssignments, isValid: false, validationErrors };
  }

  if (gkAssignments.length === 0) {
    validationErrors.push('At least one GK assignment is required.');
    return { periods: [], substitutions: [], summary: [], gkAssignments, isValid: false, validationErrors };
  }

  // Build GK period map: period -> gkPlayerId
  const gkPeriodsMap = new Map<number, string>();
  for (const gk of gkAssignments) {
    for (const p of gk.periods) {
      gkPeriodsMap.set(p, gk.playerId);
    }
  }

  // Validate all periods have a GK
  for (let p = 1; p <= periods; p++) {
    if (!gkPeriodsMap.has(p)) {
      validationErrors.push(`Period ${p} has no goalkeeper assigned.`);
    }
  }
  if (validationErrors.length > 0) {
    return { periods: [], substitutions: [], summary: [], gkAssignments, isValid: false, validationErrors };
  }

  // Determine GK player IDs
  const gkPlayerIds = new Set(gkAssignments.map((g) => g.playerId));

  // Players that are never GK (pure outfield players)
  const pureOutfieldPlayers = availablePlayers.filter((p) => !gkPlayerIds.has(p.id));
  const numPureOutfield = pureOutfieldPlayers.length;

  // For each period, calculate available outfield slots for pure outfield players
  const slotsPerPeriod: number[] = [];
  const gkPlayersOnOutfieldPerPeriod: string[][] = [];

  for (let periodNum = 1; periodNum <= periods; periodNum++) {
    const gkPlayersOnOutfield = gkRewardFullOutfield
      ? gkAssignments
          .filter((g) => !g.periods.includes(periodNum))
          .map((g) => g.playerId)
      : [];

    gkPlayersOnOutfieldPerPeriod.push(gkPlayersOnOutfield);

    const reservedSlots = gkPlayersOnOutfield.length;
    const availableSlotsForRotation = outfieldSlots - reservedSlots;
    slotsPerPeriod.push(availableSlotsForRotation);
  }

  // Total outfield-minutes available for pure outfield players
  const totalAvailableMinutes = slotsPerPeriod.reduce((sum, slots) => sum + slots * periodDuration, 0);

  // Target minutes per pure outfield player
  const targetMinutes = numPureOutfield > 0 ? totalAvailableMinutes / numPureOutfield : 0;

  // --- Phase 1: Base assignment (whole-period slots) ---
  // Track accumulated minutes per player
  const playerMinutes: Map<string, number> = new Map();
  for (const p of pureOutfieldPlayers) {
    playerMinutes.set(p.id, 0);
  }

  // For each period, assign which players play the full period
  // periodAssignments[periodIdx] = list of player IDs playing full period as outfield
  const periodFullAssignments: string[][] = [];

  for (let periodIdx = 0; periodIdx < periods; periodIdx++) {
    const slots = slotsPerPeriod[periodIdx];

    // Sort players by accumulated minutes (ascending), then by index for stability
    const sorted = [...pureOutfieldPlayers].sort((a, b) => {
      const diff = (playerMinutes.get(a.id) ?? 0) - (playerMinutes.get(b.id) ?? 0);
      if (diff !== 0) return diff;
      return pureOutfieldPlayers.indexOf(a) - pureOutfieldPlayers.indexOf(b);
    });

    // Take the `slots` players with the fewest minutes
    const assigned = sorted.slice(0, slots).map((p) => p.id);
    periodFullAssignments.push(assigned);

    // Update accumulated minutes
    for (const pid of assigned) {
      playerMinutes.set(pid, (playerMinutes.get(pid) ?? 0) + periodDuration);
    }
  }

  // --- Phase 2: Check if imbalance exceeds tolerance, apply mid-period subs ---
  const substitutionEvents: SubstitutionEvent[] = [];

  // Track partial play: playerPartialPlay[periodIdx] = Map<playerId, {start, end}> 
  // for players who only play PART of a period
  const playerPartialPlay: Map<string, { start: number; end: number }>[] = [];
  for (let i = 0; i < periods; i++) {
    playerPartialPlay.push(new Map());
  }

  // Check if mid-period subs are needed
  const minMinutes = Math.min(...Array.from(playerMinutes.values()));
  const maxMinutes = Math.max(...Array.from(playerMinutes.values()));
  const imbalance = maxMinutes - minMinutes;

  if (imbalance > toleranceMinutes && numPureOutfield > 0) {
    // Apply mid-period substitutions to balance playing time.
    // The sub point within the period is calculated dynamically to bring both
    // the over-time player and under-time player as close to target as possible.

    let iterations = 0;
    const maxIterations = numPureOutfield * periods * 2; // safety limit

    while (iterations < maxIterations) {
      // Recalculate effective minutes (base + partials)
      const effectiveMinutes = new Map<string, number>();
      for (const p of pureOutfieldPlayers) {
        let total = 0;
        for (let periodIdx = 0; periodIdx < periods; periodIdx++) {
          const partial = playerPartialPlay[periodIdx].get(p.id);
          if (partial) {
            total += partial.end - partial.start;
          } else if (periodFullAssignments[periodIdx].includes(p.id)) {
            total += periodDuration;
          }
        }
        effectiveMinutes.set(p.id, total);
      }

      const currentMin = Math.min(...Array.from(effectiveMinutes.values()));
      const currentMax = Math.max(...Array.from(effectiveMinutes.values()));

      if (currentMax - currentMin <= toleranceMinutes) break;

      // Find players above and below target
      const overPlayers = pureOutfieldPlayers
        .filter((p) => (effectiveMinutes.get(p.id) ?? 0) > targetMinutes + toleranceMinutes / 2)
        .sort((a, b) => (effectiveMinutes.get(b.id) ?? 0) - (effectiveMinutes.get(a.id) ?? 0));
      const underPlayers = pureOutfieldPlayers
        .filter((p) => (effectiveMinutes.get(p.id) ?? 0) < targetMinutes - toleranceMinutes / 2)
        .sort((a, b) => (effectiveMinutes.get(a.id) ?? 0) - (effectiveMinutes.get(b.id) ?? 0));

      // Fallback: if the above/below-target filter gives nothing, use min/max
      if (overPlayers.length === 0 || underPlayers.length === 0) {
        const maxPlayers = pureOutfieldPlayers
          .filter((p) => (effectiveMinutes.get(p.id) ?? 0) >= currentMax)
          .sort((a, b) => (effectiveMinutes.get(b.id) ?? 0) - (effectiveMinutes.get(a.id) ?? 0));
        const minPlayers = pureOutfieldPlayers
          .filter((p) => (effectiveMinutes.get(p.id) ?? 0) <= currentMin)
          .sort((a, b) => (effectiveMinutes.get(a.id) ?? 0) - (effectiveMinutes.get(b.id) ?? 0));
        if (maxPlayers.length === 0 || minPlayers.length === 0) break;
        overPlayers.length = 0;
        overPlayers.push(...maxPlayers);
        underPlayers.length = 0;
        underPlayers.push(...minPlayers);
      }

      let swapped = false;

      // Try to find a period where overPlayer is playing full and underPlayer is off
      for (const overPlayer of overPlayers) {
        if (swapped) break;
        for (const underPlayer of underPlayers) {
          if (swapped) break;
          if (overPlayer.id === underPlayer.id) continue;

          const overMins = effectiveMinutes.get(overPlayer.id) ?? 0;
          const underMins = effectiveMinutes.get(underPlayer.id) ?? 0;

          for (let periodIdx = 0; periodIdx < periods; periodIdx++) {
            // overPlayer must be playing full period in this slot
            if (!periodFullAssignments[periodIdx].includes(overPlayer.id)) continue;
            // overPlayer must not already have a partial in this period
            if (playerPartialPlay[periodIdx].has(overPlayer.id)) continue;
            // underPlayer must NOT be playing full period in this slot
            if (periodFullAssignments[periodIdx].includes(underPlayer.id)) continue;
            // underPlayer must not already have a partial in this period
            if (playerPartialPlay[periodIdx].has(underPlayer.id)) continue;

            // Calculate the optimal sub point to bring both toward target.
            // After the sub: overPlayer gets `subPoint` minutes (plays 0..subPoint)
            //                underPlayer gets `periodDuration - subPoint` minutes (plays subPoint..end)
            // overPlayer new total = overMins - periodDuration + subPoint
            // underPlayer new total = underMins + (periodDuration - subPoint)
            // Ideal: both equal target
            //   overMins - periodDuration + subPoint = target  →  subPoint = target - overMins + periodDuration
            //   underMins + periodDuration - subPoint = target →  subPoint = underMins + periodDuration - target
            // Average the two for best balance:
            const idealSubPoint1 = targetMinutes - overMins + periodDuration;
            const idealSubPoint2 = underMins + periodDuration - targetMinutes;
            let subPoint = Math.round((idealSubPoint1 + idealSubPoint2) / 2);

            // Clamp to valid range: both players must get at least minSubMinutes
            // overPlayer plays [0, subPoint] so needs subPoint >= minSubMinutes
            // underPlayer plays [subPoint, periodDuration] so needs (periodDuration - subPoint) >= minSubMinutes
            const minSub = config.minSubMinutes;
            subPoint = Math.max(minSub, Math.min(periodDuration - minSub, subPoint));

            // If the period is too short for a valid sub with minimum time, skip
            if (periodDuration < minSub * 2) continue;

            // Verify this sub actually improves the situation
            const overNewTotal = overMins - periodDuration + subPoint;
            const underNewTotal = underMins + (periodDuration - subPoint);
            const currentSpread = overMins - underMins;
            const newSpread = Math.abs(overNewTotal - underNewTotal);
            if (newSpread >= currentSpread) {
              // This sub doesn't help, try next period
              continue;
            }

            // Apply mid-period sub: overPlayer plays [0, subPoint], underPlayer plays [subPoint, periodDuration]
            // Remove overPlayer from full assignment
            const idx = periodFullAssignments[periodIdx].indexOf(overPlayer.id);
            periodFullAssignments[periodIdx].splice(idx, 1);

            // Add partials
            playerPartialPlay[periodIdx].set(overPlayer.id, { start: 0, end: subPoint });
            playerPartialPlay[periodIdx].set(underPlayer.id, { start: subPoint, end: periodDuration });

            // Record the substitution event
            const matchMinute = periodIdx * periodDuration + subPoint;
            substitutionEvents.push({
              minute: matchMinute,
              periodMinute: subPoint,
              period: periodIdx + 1,
              playerOffId: overPlayer.id,
              playerOnId: underPlayer.id,
            });

            swapped = true;
            break;
          }
        }
      }

      if (!swapped) break; // No more swaps possible
      iterations++;
    }
  }

  // --- Phase 3: Build period plans ---
  const periodPlans: PeriodPlan[] = [];

  for (let periodIdx = 0; periodIdx < periods; periodIdx++) {
    const periodNum = periodIdx + 1;
    const gkPlayerId = gkPeriodsMap.get(periodNum)!;
    const gkPlayersOnOutfield = gkPlayersOnOutfieldPerPeriod[periodIdx];

    const onPitch: PeriodPlayer[] = [];
    const offPitch: string[] = [];

    // GK on pitch (full period)
    onPitch.push({
      playerId: gkPlayerId,
      position: 'GK',
      isGk: true,
      startMinute: 0,
      endMinute: periodDuration,
    });

    // GK reward players on outfield (full period)
    for (const gkOutId of gkPlayersOnOutfield) {
      const player = availablePlayers.find((p) => p.id === gkOutId)!;
      onPitch.push({
        playerId: gkOutId,
        position: player.primaryPosition === 'GK' ? 'CB' : player.primaryPosition,
        isGk: false,
        startMinute: 0,
        endMinute: periodDuration,
      });
    }

    // Pure outfield players - full period — assign formation positions
    const fullPeriodPlayerIds = periodFullAssignments[periodIdx];
    // Include players who START the period (both full-period and partial-leaving)
    const partialLeavingPlayerIds = [...playerPartialPlay[periodIdx].entries()]
      .filter(([_, timing]) => timing.start === 0)
      .map(([pid]) => pid);
    // For formation assignment, only include the players who form the starting XI
    // (i.e. exactly `outfieldSlots` players). GK reward + full + partial-leaving who start.
    // Incoming subs inherit the position of the player they replace (handled later).
    const startingOutfieldThisPeriod = [...gkPlayersOnOutfield, ...fullPeriodPlayerIds, ...partialLeavingPlayerIds]
      .slice(0, outfieldSlots); // cap to formation slot count
    const assignedPositions = formationSlots
      ? assignFormationPositions(startingOutfieldThisPeriod, availablePlayers, formationSlots)
      : null;

    for (const pid of fullPeriodPlayerIds) {
      const player = availablePlayers.find((p) => p.id === pid)!;
      const position = assignedPositions?.get(pid) ?? player.primaryPosition;
      onPitch.push({
        playerId: pid,
        position,
        isGk: false,
        startMinute: 0,
        endMinute: periodDuration,
      });
    }

    // Update GK reward player positions from formation assignment
    if (assignedPositions) {
      for (const entry of onPitch) {
        if (!entry.isGk && gkPlayersOnOutfield.includes(entry.playerId) && assignedPositions.has(entry.playerId)) {
          entry.position = assignedPositions.get(entry.playerId)!;
        }
      }
    }

    // Pure outfield players - partial period
    // For incoming players (start > 0), they should inherit the FORMATION position of the player
    // they are replacing. For outgoing players (start === 0), use their formation-assigned position.
    const subPositionMap = new Map<string, string>(); // playerOnId -> formation position they should play
    for (const sub of substitutionEvents) {
      if (sub.period === periodNum) {
        // The outgoing player's formation-assigned position
        const outgoingFormationPos = assignedPositions?.get(sub.playerOffId);
        if (outgoingFormationPos) {
          subPositionMap.set(sub.playerOnId, outgoingFormationPos);
        }
      }
    }

    for (const [pid, timing] of playerPartialPlay[periodIdx]) {
      const player = availablePlayers.find((p) => p.id === pid)!;
      let position: string;
      if (timing.start === 0) {
        // Outgoing player — use their formation-assigned position
        position = assignedPositions?.get(pid) ?? player.primaryPosition;
      } else {
        // Incoming player — inherit the formation position of the player they replace
        position = subPositionMap.get(pid) ?? player.primaryPosition;
      }
      onPitch.push({
        playerId: pid,
        position,
        isGk: false,
        startMinute: timing.start,
        endMinute: timing.end,
      });
    }

    // Off-pitch: players not in any assignment for this period
    for (const player of pureOutfieldPlayers) {
      const isFullPeriod = periodFullAssignments[periodIdx].includes(player.id);
      const isPartial = playerPartialPlay[periodIdx].has(player.id);
      if (!isFullPeriod && !isPartial) {
        offPitch.push(player.id);
      }
    }

    periodPlans.push({
      period: periodNum,
      startMinute: periodIdx * periodDuration,
      endMinute: periodNum * periodDuration,
      onPitch,
      offPitch,
      gkPlayerId,
    });
  }

  // --- Phase 4: Calculate player time summaries ---
  const summary: PlayerTimeSummary[] = availablePlayers.map((player) => {
    const gkAssignment = gkAssignments.find((g) => g.playerId === player.id);
    const periodsInGoal = gkAssignment?.periods.length ?? 0;
    const gkMinutes = periodsInGoal * periodDuration;

    let outfieldMinutes = 0;
    let periodsOnBench = 0;
    let periodsPlayedOutfield = 0;

    if (gkPlayerIds.has(player.id)) {
      // GK player: outfield in non-GK periods (reward)
      for (let periodIdx = 0; periodIdx < periods; periodIdx++) {
        const periodNum = periodIdx + 1;
        if (gkAssignment?.periods.includes(periodNum)) continue; // in goal
        if (gkRewardFullOutfield && gkPlayersOnOutfieldPerPeriod[periodIdx].includes(player.id)) {
          outfieldMinutes += periodDuration;
          periodsPlayedOutfield++;
        }
      }
    } else {
      // Pure outfield player
      for (let periodIdx = 0; periodIdx < periods; periodIdx++) {
        const partial = playerPartialPlay[periodIdx].get(player.id);
        if (partial) {
          outfieldMinutes += partial.end - partial.start;
          periodsPlayedOutfield++; // they played part of this period
        } else if (periodFullAssignments[periodIdx].includes(player.id)) {
          outfieldMinutes += periodDuration;
          periodsPlayedOutfield++;
        } else {
          periodsOnBench++;
        }
      }
    }

    const totalMinutes = outfieldMinutes + gkMinutes;

    return {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      outfieldMinutes: Math.round(outfieldMinutes * 10) / 10, // round to 1 decimal
      gkMinutes,
      totalMinutes: Math.round(totalMinutes * 10) / 10,
      periodsPlayed: periodsPlayedOutfield + periodsInGoal,
      periodsOnBench,
      periodsInGoal,
    };
  });

  // --- Phase 5: Validate constraints ---

  // Check playing time tolerance for pure outfield players
  const outfieldOnlyPlayers = summary.filter((s) => s.gkMinutes === 0);
  if (outfieldOnlyPlayers.length > 0) {
    const minTime = Math.min(...outfieldOnlyPlayers.map((s) => s.outfieldMinutes));
    const maxTime = Math.max(...outfieldOnlyPlayers.map((s) => s.outfieldMinutes));
    if (maxTime - minTime > toleranceMinutes) {
      validationErrors.push(
        `Playing time difference of ${maxTime - minTime} minutes exceeds tolerance of ±${toleranceMinutes} minutes.`
      );
    }
  }

  // Check consecutive bench rule
  // A player is "benched" for a period only if they play 0 minutes in that period
  for (const player of availablePlayers) {
    if (gkPlayerIds.has(player.id)) continue; // GK players handled differently

    let maxConsec = 0;
    let currentConsec = 0;
    for (let periodIdx = 0; periodIdx < periods; periodIdx++) {
      const isFullPeriod = periodFullAssignments[periodIdx].includes(player.id);
      const isPartial = playerPartialPlay[periodIdx].has(player.id);
      if (!isFullPeriod && !isPartial) {
        currentConsec++;
        maxConsec = Math.max(maxConsec, currentConsec);
      } else {
        currentConsec = 0;
      }
    }
    if (maxConsec > maxConsecutiveBenchPeriods) {
      validationErrors.push(
        `${player.firstName} ${player.lastName} sits out ${maxConsec} consecutive periods (max: ${maxConsecutiveBenchPeriods}).`
      );
    }
  }

  return {
    periods: periodPlans,
    substitutions: substitutionEvents,
    summary,
    gkAssignments,
    isValid: validationErrors.length === 0,
    validationErrors,
  };
}

/**
 * Get position slot labels from a formation string.
 * Formation "2-3-1" means 2 defenders, 3 midfielders, 1 attacker.
 * Returns an array of specific position labels like ["LB", "RB", "LM", "CM", "RM", "ST"].
 */
function getFormationPositionSlots(formation: string): string[] {
  const lines = formation.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
  const slots: string[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const count = lines[lineIdx];
    const isDefence = lineIdx === 0;
    const isAttack = lineIdx === lines.length - 1;

    if (isDefence) {
      if (count === 1) slots.push('CB');
      else if (count === 2) slots.push('LB', 'RB');
      else if (count === 3) slots.push('LB', 'CB', 'RB');
      else if (count === 4) slots.push('LB', 'LCB', 'RCB', 'RB');
      else if (count === 5) slots.push('LWB', 'LCB', 'CB', 'RCB', 'RWB');
      else for (let i = 0; i < count; i++) slots.push(`D${i + 1}`);
    } else if (isAttack) {
      if (count === 1) slots.push('CF');
      else if (count === 2) slots.push('CF', 'CF');
      else if (count === 3) slots.push('CF', 'CF', 'CF');
      else for (let i = 0; i < count; i++) slots.push('CF');
    } else {
      // Midfield
      if (count === 1) slots.push('CM');
      else if (count === 2) slots.push('LM', 'RM');
      else if (count === 3) slots.push('LM', 'CM', 'RM');
      else if (count === 4) slots.push('LM', 'LCM', 'RCM', 'RM');
      else if (count === 5) slots.push('LM', 'LCM', 'CM', 'RCM', 'RM');
      else for (let i = 0; i < count; i++) slots.push(`M${i + 1}`);
    }
  }

  return slots;
}

/**
 * Map player primary positions to formation slot categories for best-fit matching.
 */
const POSITION_CATEGORY: Record<string, string> = {
  GK: 'defence',
  CB: 'defence',
  LB: 'defence',
  RB: 'defence',
  CM: 'midfield',
  LM: 'midfield',
  RM: 'midfield',
  CF: 'attack',
};

const SLOT_CATEGORY: Record<string, string> = {};
// Defence slots
['CB', 'LB', 'RB', 'LCB', 'RCB', 'LWB', 'RWB'].forEach(s => SLOT_CATEGORY[s] = 'defence');
// Midfield slots
['CM', 'LM', 'RM', 'LCM', 'RCM'].forEach(s => SLOT_CATEGORY[s] = 'midfield');
// Attack slots
['CF'].forEach(s => SLOT_CATEGORY[s] = 'attack');

/**
 * Assign formation positions to players based on their primary, secondary, and tertiary positions.
 * Uses a SLOT-FIRST approach: each formation slot finds the best available player for it.
 * This guarantees every slot in the formation is filled exactly once (LB, RB, LM, CM, RM, CF).
 */
function assignFormationPositions(
  playerIds: string[],
  allPlayers: PlayerForSelection[],
  formationSlots: string[],
): Map<string, string> {
  const assignments = new Map<string, string>();
  const unassignedPlayers = new Set(playerIds);
  const unfilledSlots = [...formationSlots];

  // Score how well a player fits a slot (higher = better fit)
  // In grassroots, positions on the same line are essentially interchangeable:
  // CB/LB/RB are all "defenders", CM/LM/RM are all "midfielders"
  function fitScore(playerId: string, slot: string): number {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return 0;
    if (player.primaryPosition === slot) return 100;
    if (player.secondaryPosition === slot) return 90;
    if (player.tertiaryPosition === slot) return 80;
    // Same line as primary (e.g. CB player → LB/RB slot) — treat as strong fit
    const playerCat = POSITION_CATEGORY[player.primaryPosition] ?? 'midfield';
    const slotCat = SLOT_CATEGORY[slot] ?? 'midfield';
    if (playerCat === slotCat) return 70;
    // Same line as secondary/tertiary
    if (player.secondaryPosition) {
      const secCat = POSITION_CATEGORY[player.secondaryPosition] ?? 'midfield';
      if (secCat === slotCat) return 60;
    }
    if (player.tertiaryPosition) {
      const terCat = POSITION_CATEGORY[player.tertiaryPosition] ?? 'midfield';
      if (terCat === slotCat) return 50;
    }
    return 10; // No match at all — different zone entirely
  }

  // Greedy assignment: for each slot, pick the best-fitting unassigned player
  // Do multiple passes — first assign slots where there's a clear best fit (primary match),
  // then fill remaining with best available
  
  // Pass 1: assign slots that have a player with an exact primary match
  for (let i = unfilledSlots.length - 1; i >= 0; i--) {
    const slot = unfilledSlots[i];
    const primaryMatch = [...unassignedPlayers].find(pid => {
      const player = allPlayers.find(p => p.id === pid);
      return player?.primaryPosition === slot;
    });
    if (primaryMatch) {
      assignments.set(primaryMatch, slot);
      unassignedPlayers.delete(primaryMatch);
      unfilledSlots.splice(i, 1);
    }
  }

  // Pass 2: assign slots that have a player with a secondary match
  for (let i = unfilledSlots.length - 1; i >= 0; i--) {
    const slot = unfilledSlots[i];
    const secMatch = [...unassignedPlayers].find(pid => {
      const player = allPlayers.find(p => p.id === pid);
      return player?.secondaryPosition === slot;
    });
    if (secMatch) {
      assignments.set(secMatch, slot);
      unassignedPlayers.delete(secMatch);
      unfilledSlots.splice(i, 1);
    }
  }

  // Pass 3: assign slots that have a player with a tertiary match
  for (let i = unfilledSlots.length - 1; i >= 0; i--) {
    const slot = unfilledSlots[i];
    const terMatch = [...unassignedPlayers].find(pid => {
      const player = allPlayers.find(p => p.id === pid);
      return player?.tertiaryPosition === slot;
    });
    if (terMatch) {
      assignments.set(terMatch, slot);
      unassignedPlayers.delete(terMatch);
      unfilledSlots.splice(i, 1);
    }
  }

  // Pass 4: assign remaining slots to best available player by category/score
  for (let i = unfilledSlots.length - 1; i >= 0; i--) {
    const slot = unfilledSlots[i];
    if (unassignedPlayers.size === 0) break;
    
    let bestPlayer: string | null = null;
    let bestScore = -1;
    for (const pid of unassignedPlayers) {
      const score = fitScore(pid, slot);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = pid;
      }
    }
    if (bestPlayer) {
      assignments.set(bestPlayer, slot);
      unassignedPlayers.delete(bestPlayer);
      unfilledSlots.splice(i, 1);
    }
  }

  // Any remaining unassigned players get whatever slot is left
  for (const pid of unassignedPlayers) {
    if (unfilledSlots.length > 0) {
      assignments.set(pid, unfilledSlots.shift()!);
    }
  }

  return assignments;
}

/**
 * Determine GK assignments based on rotation history.
 * Selects the volunteer(s) who have done GK duty least recently.
 */
export function suggestGkAssignments(
  volunteers: PlayerForSelection[],
  gkHistory: Map<string, number>,
  periods: number,
  maxGkPeriodsPerMatch: number,
): GkAssignment[] {
  if (volunteers.length === 0) return [];

  // Sort by least GK duty
  const sorted = [...volunteers].sort((a, b) => {
    const aHistory = gkHistory.get(a.id) ?? 0;
    const bHistory = gkHistory.get(b.id) ?? 0;
    return aHistory - bHistory;
  });

  // Determine how many GKs we need
  const periodsPerGk = Math.min(maxGkPeriodsPerMatch, periods);
  const gksNeeded = Math.ceil(periods / periodsPerGk);

  const assignments: GkAssignment[] = [];
  let periodIndex = 1;

  for (let i = 0; i < gksNeeded && i < sorted.length; i++) {
    const gkPeriods: number[] = [];
    for (let p = 0; p < periodsPerGk && periodIndex <= periods; p++) {
      gkPeriods.push(periodIndex);
      periodIndex++;
    }
    assignments.push({
      playerId: sorted[i].id,
      periods: gkPeriods,
    });
  }

  return assignments;
}
