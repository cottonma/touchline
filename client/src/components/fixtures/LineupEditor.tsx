import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import type { Player } from '@/services/player.service';
import { PitchView } from '@/components/match-planning/PitchView';
import { buildQuarterPitch } from '@/components/match-planning/quarterPitch';

/**
 * Lineup editor for a COMPLETED match. Two jobs:
 *  1) Fix the recorded lineup — tap two positions on a quarter's pitch to SWAP
 *     the players (works for swapping the goalkeeper with an outfielder too), so
 *     the record matches what actually happened.
 *  2) Add "Power Play" players — grassroots rule: a team 4+ goals behind may add
 *     an extra outfield player (a 2nd at 6+ behind). Each is a slot with its own
 *     on/off minute, so minutes stay accurate.
 * Saving recalculates playing time from the slots.
 */

interface Slot {
  id?: string;
  period: number;
  playerId: string;
  position: string;
  isGk: boolean;
  startMinute: number;
  endMinute: number;
}
interface PeriodScore { period: number; goalsFor: number; goalsAgainst: number }

const ZONE_POSITION: Record<string, string> = { defence: 'CB', midfield: 'CM', attack: 'CF' };
const ZONE_LABEL: Record<string, string> = { defence: 'Defender', midfield: 'Midfielder', attack: 'Striker' };
const POSITION_ZONE: Record<string, 'defence' | 'midfield' | 'attack'> = {
  CB: 'defence', LB: 'defence', RB: 'defence', LCB: 'defence', RCB: 'defence', LWB: 'defence', RWB: 'defence',
  CM: 'midfield', LM: 'midfield', RM: 'midfield', LCM: 'midfield', RCM: 'midfield', CDM: 'midfield', CAM: 'midfield',
  CF: 'attack', ST: 'attack', LW: 'attack', RW: 'attack',
};

function allowedExtras(deficit: number): number {
  if (deficit >= 6) return 2;
  if (deficit >= 4) return 1;
  return 0;
}

export function LineupEditor({
  fixtureId,
  players,
  periodScores,
  periodDuration,
  onClose,
  onSaved,
}: {
  fixtureId: string;
  players: Player[];
  periodScores: PeriodScore[];
  periodDuration: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Selected pitch slot for swapping: { period, slotId } where slotId is the
  // buildQuarterPitch slot id (position-based).
  const [selected, setSelected] = useState<{ period: number; slotId: string } | null>(null);

  useEffect(() => {
    api.get<any>(`/match-plans/${fixtureId}`).then((res) => {
      const data = res?.data ?? res;
      setSlots((data?.slots ?? []).map((s: any) => ({
        id: s.id, period: s.period, playerId: s.playerId, position: s.position,
        isGk: s.isGk, startMinute: s.startMinute, endMinute: s.endMinute,
      })));
    }).catch(() => setError('Could not load the lineup.')).finally(() => setLoading(false));
  }, [fixtureId]);

  const periods = [...new Set(periodScores.map((p) => p.period))].sort((a, b) => a - b);
  const periodList = periods.length ? periods : [1, 2, 3, 4];

  const deficitAtPeriod = (period: number) => {
    let gf = 0, ga = 0;
    for (const ps of periodScores) if (ps.period <= period) { gf += ps.goalsFor; ga += ps.goalsAgainst; }
    return ga - gf;
  };

  const outfieldCountByPeriod = (period: number) => slots.filter((s) => s.period === period && !s.isGk).length;
  const standardOutfield = Math.min(...periodList.map((p) => outfieldCountByPeriod(p)).filter((n) => n > 0));

  const addExtra = (period: number) => {
    setSlots((prev) => [...prev, { period, playerId: '', position: 'CM', isGk: false, startMinute: 0, endMinute: periodDuration }]);
    setDirty(true);
  };
  const updateSlot = (idx: number, patch: Partial<Slot>) => { setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))); setDirty(true); };
  const removeSlot = (idx: number) => { setSlots((prev) => prev.filter((_, i) => i !== idx)); setDirty(true); };

  /**
   * Swap the two players occupying positionA and positionB in a period. Handles
   * GK↔outfield swaps: the player moving into goal becomes isGk (position 'GK'
   * kept as their outfield label is irrelevant for GK), and vice versa. Moves
   * ALL time-segments at each position so subs swap cleanly.
   */
  const swapPositions = (period: number, aIsGk: boolean, aPos: string, bIsGk: boolean, bPos: string) => {
    setSlots((prev) => prev.map((s) => {
      if (s.period !== period) return s;
      const atA = s.isGk === aIsGk && (aIsGk || s.position === aPos);
      const atB = s.isGk === bIsGk && (bIsGk || s.position === bPos);
      if (atA) return { ...s, isGk: bIsGk, position: bIsGk ? 'GK' : bPos };
      if (atB) return { ...s, isGk: aIsGk, position: aIsGk ? 'GK' : aPos };
      return s;
    }));
    setDirty(true);
  };

  /** Resolve a buildQuarterPitch slot id back to { isGk, position } for a period. */
  const handleSlotTap = (period: number, pitchSlotId: string, pitchSlotPos: string, pitchSlotIsGk: boolean) => {
    if (!selected || selected.period !== period) {
      setSelected({ period, slotId: pitchSlotId });
      return;
    }
    if (selected.slotId === pitchSlotId) { setSelected(null); return; }

    // Find the previously-selected slot's position/isGk from current pitch render.
    const periodSlots = slots.filter((s) => s.period === period && s.playerId);
    const { pitchSlots } = buildQuarterPitch(periodSlots, players);
    const prevPitch = pitchSlots.find((ps) => ps.id === selected.slotId);
    if (!prevPitch) { setSelected({ period, slotId: pitchSlotId }); return; }

    swapPositions(
      period,
      !!prevPitch.isGk, prevPitch.position,
      pitchSlotIsGk, pitchSlotPos,
    );
    setSelected(null);
  };

  const save = async () => {
    if (slots.some((s) => !s.playerId)) { setError('Every added player needs to be selected.'); return; }
    setSaving(true); setError(null);
    try {
      await api.put(`/match-plans/${fixtureId}/slots`, {
        slots: slots.map((s) => ({
          period: s.period, playerId: s.playerId, position: s.position,
          isGk: s.isGk, startMinute: s.startMinute, endMinute: s.endMinute,
        })),
      });
      await api.post(`/match-plans/${fixtureId}/recalculate`, {});
      onSaved();
      onClose();
    } catch {
      setError('Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading lineup…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p><strong>Fix positions:</strong> tap a player on the pitch, then tap another to swap them (including swapping a player in or out of goal).</p>
          <p><strong>Power Play:</strong> 4+ goals behind allows 1 extra outfield player, 6+ behind allows a 2nd. Add them to the quarter they came on and set the minute. Guidance only — record what actually happened.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {periodList.map((period) => {
          const deficit = deficitAtPeriod(period);
          const allowed = allowedExtras(deficit);
          const periodSlotsIdx = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.period === period);
          const outfield = periodSlotsIdx.filter(({ s }) => !s.isGk).length;
          const currentExtras = isFinite(standardOutfield) ? Math.max(0, outfield - standardOutfield) : 0;
          const extraSlots = periodSlotsIdx.filter(({ s }) => isExtra(s, standardOutfield, periodSlotsIdx.map((x) => x.s)));

          const renderable = periodSlotsIdx.map(({ s }) => s).filter((s) => s.playerId);
          const { formation, pitchSlots } = buildQuarterPitch(renderable, players);
          const selectedSlotId = selected?.period === period ? selected.slotId : null;

          return (
            <div key={period} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Quarter {period}</h4>
                <span className="text-[11px] text-muted-foreground">
                  {deficit > 0 ? `${deficit} behind` : deficit < 0 ? `${-deficit} ahead` : 'level'} · {allowed} extra allowed
                </span>
              </div>

              {/* Interactive pitch — tap two positions to swap */}
              {renderable.length > 0 && (
                <PitchView
                  formation={formation}
                  slots={pitchSlots}
                  availablePlayers={players as any[]}
                  selectedSlotId={selectedSlotId}
                  onSlotTap={(slotId) => {
                    const ps = pitchSlots.find((x) => x.id === slotId);
                    if (!ps || !ps.playerId) return; // only swap filled positions
                    handleSlotTap(period, slotId, ps.position, !!ps.isGk);
                  }}
                />
              )}
              {selectedSlotId && (
                <p className="text-[11px] text-blue-600">Tap another position to swap, or tap the same one to cancel.</p>
              )}

              {/* Power Play editors */}
              {extraSlots.map(({ s, i }) => (
                <div key={i} className="flex flex-wrap items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-md p-2">
                  <span className="text-[10px] font-semibold text-emerald-800 uppercase">Power Play</span>
                  <Select value={s.playerId} onChange={(e) => updateSlot(i, { playerId: e.target.value })} className="h-8 text-xs flex-1 min-w-[120px]">
                    <option value="">Choose player…</option>
                    {players.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                  </Select>
                  <Select value={POSITION_ZONE[s.position] ?? 'midfield'} onChange={(e) => updateSlot(i, { position: ZONE_POSITION[e.target.value] })} className="h-8 text-xs w-28">
                    {Object.keys(ZONE_LABEL).map((z) => <option key={z} value={z}>{ZONE_LABEL[z]}</option>)}
                  </Select>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">on at</span>
                    <input
                      type="number" min={0} max={periodDuration} value={s.startMinute}
                      onChange={(e) => updateSlot(i, { startMinute: Math.max(0, Math.min(periodDuration, Number(e.target.value))) })}
                      className="w-14 h-8 rounded border px-1 text-xs"
                    />
                    <span className="text-muted-foreground">′</span>
                  </div>
                  <button onClick={() => removeSlot(i)} className="text-red-500 p-1" aria-label="Remove Power Play player"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}

              {currentExtras < 2 && (
                <Button variant="outline" size="sm" onClick={() => addExtra(period)} className={allowed > currentExtras ? '' : 'opacity-70'}>
                  <Plus className="h-3.5 w-3.5" /> Add Power Play player
                  {allowed <= currentExtras && <span className="ml-1 text-[10px] text-muted-foreground">(beyond rule)</span>}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !dirty}>
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save & recalculate'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function isExtra(slot: Slot, standardOutfield: number, periodSlots: Slot[]): boolean {
  if (slot.isGk) return false;
  if (!slot.id) return true;
  if (!isFinite(standardOutfield)) return false;
  const outfield = periodSlots.filter((s) => !s.isGk);
  const surplus = outfield.length - standardOutfield;
  if (surplus <= 0) return false;
  const ranked = [...outfield].sort((a, b) => b.startMinute - a.startMinute);
  return ranked.slice(0, surplus).includes(slot);
}
