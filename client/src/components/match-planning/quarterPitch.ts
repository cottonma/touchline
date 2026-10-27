import { getFormationSlots, type PitchSlot } from './PitchView';

/**
 * Build a pitch rendering (formation + positioned slots with segments) for a
 * single period from its saved match-plan slots. The formation is derived from
 * the actual positions on the pitch so extra "Power Play" players are shown.
 *
 * IMPORTANT: positions are matched to pitch coordinates by their EXACT label
 * (LB, RM, CF…), identical to the team-selection page, so left/right/centre are
 * always preserved. Any player whose position label isn't in the generated
 * formation (e.g. a Power Play extra sharing a zone) is placed on the next free
 * coordinate in the same zone.
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

export function buildQuarterPitch(
  periodSlots: RawSlot[],
  players: PlayerLite[],
): { formation: string; pitchSlots: PitchSlot[] } {
  const name = (id: string) => { const p = players.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : '?'; };

  const outfield = periodSlots.filter((s) => !s.isGk);

  // Group outfield slots into pitch markers. Slots sharing a position label are
  // the SAME marker only when their times don't overlap (a substitution); two
  // players on the same label at the same time (a Power Play extra alongside an
  // existing player) become SEPARATE markers.
  const overlaps = (a: RawSlot, b: RawSlot) => a.startMinute < b.endMinute && b.startMinute < a.endMinute;
  const markers: { position: string; slots: RawSlot[] }[] = [];

  // Pass 1: a SINGLE player who holds more than one (non-overlapping) position
  // in the quarter — i.e. moved position mid-quarter — is ONE marker, placed at
  // the position they FINISHED in, so the formation count stays right.
  const byPlayer = new Map<string, RawSlot[]>();
  for (const s of outfield) {
    const arr = byPlayer.get(s.playerId) ?? [];
    arr.push(s);
    byPlayer.set(s.playerId, arr);
  }
  const consumed = new Set<RawSlot>();
  for (const [, arr] of byPlayer) {
    if (arr.length < 2) continue;
    const positions = new Set(arr.map((s) => s.position));
    const anyOverlap = arr.some((a, i) => arr.some((b, j) => i !== j && overlaps(a, b)));
    // Moved position: multiple distinct positions, none overlapping in time.
    if (positions.size > 1 && !anyOverlap) {
      const finishPos = [...arr].sort((a, b) => b.startMinute - a.startMinute)[0].position;
      markers.push({ position: finishPos, slots: arr });
      arr.forEach((s) => consumed.add(s));
    }
  }

  // Pass 2: remaining slots. Same position label + non-overlapping time = one
  // marker (a substitution); overlapping (a Power Play extra) = separate markers.
  // Only merge into markers created in this pass (not the "moved player" ones).
  const pass2Markers: { position: string; slots: RawSlot[] }[] = [];
  for (const s of outfield) {
    if (consumed.has(s)) continue;
    const target = pass2Markers.find((m) => m.position === s.position && !m.slots.some((x) => overlaps(x, s)));
    if (target) target.slots.push(s);
    else pass2Markers.push({ position: s.position, slots: [s] });
  }
  markers.push(...pass2Markers);

  // Formation string from marker counts per zone (e.g. "2-4-1" when a Power
  // Play midfielder is added to a 2-3-1).
  const zoneCounts = { def: 0, mid: 0, att: 0 };
  for (const m of markers) zoneCounts[ZONE_OF[m.position] ?? 'mid']++;
  const formation = [zoneCounts.def, zoneCounts.mid, zoneCounts.att].filter((n) => n > 0).join('-') || '1-1-1';

  const formSlots = getFormationSlots(formation);

  const toSegments = (slots: RawSlot[]) =>
    slots
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((s) => ({ playerId: s.playerId, playerName: name(s.playerId), startMinute: s.startMinute, endMinute: s.endMinute, isGk: false }));

  const pitchSlots: PitchSlot[] = [];
  const usedMarkers = new Set<number>();

  // 1) Match each formation coordinate to a marker with the SAME position label.
  for (const fs of formSlots) {
    if (fs.isGk) {
      const gk = periodSlots.find((s) => s.isGk);
      pitchSlots.push(gk ? { ...fs, playerId: gk.playerId, playerName: name(gk.playerId), isGk: true } : fs);
      continue;
    }
    const mi = markers.findIndex((m, i) => !usedMarkers.has(i) && m.position === fs.position);
    if (mi === -1) { pitchSlots.push(fs); continue; }
    usedMarkers.add(mi);
    const m = markers[mi];
    const segs = toSegments(m.slots);
    pitchSlots.push({
      ...fs,
      position: m.position,
      playerId: m.slots[0].playerId,
      playerName: name(m.slots[0].playerId),
      segments: segs.length > 1 ? segs : undefined,
    });
  }

  // 2) Any marker not matched by exact label (e.g. a Power Play extra labelled
  //    CM when the base formation's CM coordinate is already taken) is placed on
  //    the next free coordinate in the same zone.
  for (let i = 0; i < markers.length; i++) {
    if (usedMarkers.has(i)) continue;
    const m = markers[i];
    const zone = ZONE_OF[m.position] ?? 'mid';
    const free = pitchSlots.find((ps) => !ps.isGk && !ps.playerId && (ZONE_OF[ps.position] ?? 'mid') === zone);
    const segs = toSegments(m.slots);
    if (free) {
      free.position = m.position;
      free.playerId = m.slots[0].playerId;
      free.playerName = name(m.slots[0].playerId);
      free.segments = segs.length > 1 ? segs : undefined;
    } else {
      // No free coordinate — append a marker at a sensible spot for the zone.
      const y = zone === 'def' ? 75 : zone === 'mid' ? 50 : 25;
      pitchSlots.push({
        id: `extra-${m.position}-${i}`,
        position: m.position,
        x: 50,
        y,
        playerId: m.slots[0].playerId,
        playerName: name(m.slots[0].playerId),
        segments: segs.length > 1 ? segs : undefined,
      });
    }
  }

  return { formation, pitchSlots };
}
