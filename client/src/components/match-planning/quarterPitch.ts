import { getFormationSlots, type PitchSlot } from './PitchView';

/**
 * Build a pitch rendering (formation + positioned slots with segments) for a
 * single period from its saved match-plan slots. Unlike the planning page,
 * this derives the FORMATION from the actual slots on the pitch, so extra
 * "Power Play" players (outfielders beyond the base formation) are shown too.
 */

export interface RawSlot {
  period: number;
  playerId: string;
  position: string;
  isGk: boolean;
  startMinute: number;
  endMinute: number;
}
interface PlayerLite { id: string; firstName: string; lastName: string }

const ZONE_OF: Record<string, 'def' | 'mid' | 'att'> = {
  CB: 'def', LB: 'def', RB: 'def', LCB: 'def', RCB: 'def', LWB: 'def', RWB: 'def',
  CM: 'mid', LM: 'mid', RM: 'mid', LCM: 'mid', RCM: 'mid', CDM: 'mid', CAM: 'mid',
  CF: 'att', ST: 'att', LW: 'att', RW: 'att',
};

/**
 * Collapse a period's raw slots into one entry per (position, player-set),
 * grouping multiple time-segments on the same position into a segments array.
 */
export function buildQuarterPitch(
  periodSlots: RawSlot[],
  players: PlayerLite[],
): { formation: string; pitchSlots: PitchSlot[] } {
  const name = (id: string) => { const p = players.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : '?'; };

  const outfield = periodSlots.filter((s) => !s.isGk);

  // Group outfield slots into pitch markers. Slots sharing a position label are
  // the SAME marker only if their times don't overlap (i.e. a substitution);
  // if two players hold the same label at the same time (e.g. a Power Play
  // extra CM alongside an existing CM), they become SEPARATE markers.
  const overlaps = (a: RawSlot, b: RawSlot) => a.startMinute < b.endMinute && b.startMinute < a.endMinute;
  const markers: { position: string; slots: RawSlot[] }[] = [];
  for (const s of outfield) {
    const target = markers.find(
      (m) => m.position === s.position && !m.slots.some((x) => overlaps(x, s)),
    );
    if (target) target.slots.push(s);
    else markers.push({ position: s.position, slots: [s] });
  }

  // Count markers per zone → formation string (e.g. "2-4-1").
  const zoneCounts = { def: 0, mid: 0, att: 0 };
  for (const m of markers) {
    const z = ZONE_OF[m.position] ?? 'mid';
    zoneCounts[z]++;
  }

  const formation = [zoneCounts.def || 0, zoneCounts.mid || 0, zoneCounts.att || 0]
    .filter((n) => n > 0)
    .join('-') || '1-1-1';

  // Generate formation slots, then assign our actual positions onto them by zone.
  const formSlots = getFormationSlots(formation);

  // Build the list of real pitch positions grouped by zone, preserving label.
  const realByZone: Record<'def' | 'mid' | 'att', { position: string; slots: RawSlot[] }[]> = { def: [], mid: [], att: [] };
  for (const m of markers) {
    const z = ZONE_OF[m.position] ?? 'mid';
    realByZone[z].push({ position: m.position, slots: m.slots });
  }

  // Walk the generated formation slots and fill them from the real zone buckets.
  const zoneCursor = { def: 0, mid: 0, att: 0 };
  const pitchSlots: PitchSlot[] = formSlots.map((fs) => {
    if (fs.isGk) {
      const gk = periodSlots.find((s) => s.isGk);
      if (!gk) return fs;
      return {
        ...fs,
        playerId: gk.playerId,
        playerName: name(gk.playerId),
        isGk: true,
      };
    }
    const z = (ZONE_OF[fs.position] ?? 'mid') as 'def' | 'mid' | 'att';
    const bucket = realByZone[z];
    const real = bucket[zoneCursor[z]++];
    if (!real) return fs;

    const segments = real.slots
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((s) => ({ playerId: s.playerId, playerName: name(s.playerId), startMinute: s.startMinute, endMinute: s.endMinute, isGk: false }));

    return {
      ...fs,
      position: real.position, // show the real position label (LB, CM, CF…)
      playerId: real.slots[0].playerId,
      playerName: name(real.slots[0].playerId),
      segments: segments.length > 1 ? segments : undefined,
    };
  });

  return { formation, pitchSlots };
}
