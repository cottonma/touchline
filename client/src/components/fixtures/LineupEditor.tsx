import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import type { Player } from '@/services/player.service';

/**
 * Lineup editor for a COMPLETED match — primarily to record "catch-up" players:
 * grassroots rule where a team 4+ goals behind may add an extra outfield player
 * (and a 2nd at 6+ behind). Advisory, not enforced. Each extra player is a slot
 * with its own on/off minute within the quarter, so minutes stay accurate.
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

// Zone → a representative position code stored on the slot.
const ZONE_POSITION: Record<string, string> = { defence: 'CB', midfield: 'CM', attack: 'CF' };
const ZONE_LABEL: Record<string, string> = { defence: 'Defender', midfield: 'Midfielder', attack: 'Striker' };
const POSITION_ZONE: Record<string, 'defence' | 'midfield' | 'attack'> = {
  CB: 'defence', LB: 'defence', RB: 'defence', LCB: 'defence', RCB: 'defence', LWB: 'defence', RWB: 'defence',
  CM: 'midfield', LM: 'midfield', RM: 'midfield', LCM: 'midfield', RCM: 'midfield', CDM: 'midfield', CAM: 'midfield',
  CF: 'attack', ST: 'attack', LW: 'attack', RW: 'attack',
};

/** How many extra players are permitted for a given goal deficit. */
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

  const name = (id: string) => { const p = players.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : 'Unknown'; };

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

  // Our deficit at the end of a quarter = cumulative against - for, up to and including it.
  const deficitAtPeriod = (period: number) => {
    let gf = 0, ga = 0;
    for (const ps of periodScores) {
      if (ps.period <= period) { gf += ps.goalsFor; ga += ps.goalsAgainst; }
    }
    // goalsFor/goalsAgainst are stored from our team's perspective already.
    return ga - gf;
  };

  // Count current extra outfield players in a period = outfielders beyond the
  // standard count. We infer standard count from the smallest period's outfield count.
  const outfieldCountByPeriod = (period: number) =>
    slots.filter((s) => s.period === period && !s.isGk).length;
  const standardOutfield = Math.min(...periodList.map((p) => outfieldCountByPeriod(p)).filter((n) => n > 0));

  const addExtra = (period: number) => {
    setSlots((prev) => [...prev, {
      period, playerId: '', position: 'CM', isGk: false, startMinute: 0, endMinute: periodDuration,
    }]);
  };

  const updateSlot = (idx: number, patch: Partial<Slot>) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const removeSlot = (idx: number) => setSlots((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    // Validate: every slot needs a player.
    if (slots.some((s) => !s.playerId)) { setError('Every added player needs to be selected.'); return; }
    setSaving(true); setError(null);
    try {
      // Send per-period full replacement (the API replaces slots for each period present).
      await api.put(`/match-plans/${fixtureId}/slots`, {
        slots: slots.map((s) => ({
          period: s.period, playerId: s.playerId, position: s.position,
          isGk: s.isGk, startMinute: s.startMinute, endMinute: s.endMinute,
        })),
      });
      await api.post(`/match-plans/${fixtureId}/recalculate`, {});
      onSaved();
      onClose();
    } catch (e) {
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
        <p>
          Catch-up rule: 4+ goals behind allows 1 extra outfield player, 6+ behind allows a 2nd.
          Add the extra player to the quarter they came on, and set the minute. This is guidance —
          add what actually happened on the day.
        </p>
      </div>

      {periodList.map((period) => {
        const deficit = deficitAtPeriod(period);
        const allowed = allowedExtras(deficit);
        const periodSlots = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.period === period);
        const outfield = periodSlots.filter(({ s }) => !s.isGk).length;
        const currentExtras = isFinite(standardOutfield) ? Math.max(0, outfield - standardOutfield) : 0;
        const extraSlots = periodSlots.filter(({ s }) => isExtra(s, standardOutfield, periodSlots.map((x) => x.s)));

        return (
          <div key={period} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Quarter {period}</h4>
              <span className="text-[11px] text-muted-foreground">
                {deficit > 0 ? `${deficit} behind` : deficit < 0 ? `${-deficit} ahead` : 'level'} · {allowed} extra allowed
              </span>
            </div>

            {/* Existing lineup (read-only summary) */}
            <div className="flex flex-wrap gap-1">
              {periodSlots.map(({ s, i }) => (
                <span key={i} className={`text-[10px] rounded px-1.5 py-0.5 ${s.isGk ? 'bg-yellow-100 text-yellow-800' : 'bg-muted'}`}>
                  {s.position} {name(s.playerId).split(' ')[0]}
                </span>
              ))}
            </div>

            {/* Extra-player editors */}
            {extraSlots.map(({ s, i }) => (
              <div key={i} className="flex flex-wrap items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-md p-2">
                <span className="text-[10px] font-semibold text-emerald-800 uppercase">Extra player</span>
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
                <button onClick={() => removeSlot(i)} className="text-red-500 p-1" aria-label="Remove extra player"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}

            {currentExtras < 2 && (
              <Button
                variant="outline" size="sm"
                onClick={() => addExtra(period)}
                className={allowed > currentExtras ? '' : 'opacity-70'}
              >
                <Plus className="h-3.5 w-3.5" /> Add catch-up player
                {allowed <= currentExtras && <span className="ml-1 text-[10px] text-muted-foreground">(beyond rule)</span>}
              </Button>
            )}
          </div>
        );
      })}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save & recalculate'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Identify "extra" outfield slots in a period: the ones beyond the standard
 * outfield count, chosen as the most-recently-added (those with the latest
 * start minute, or appended). We treat any outfield slot that starts after 0
 * OR exceeds the standard count as editable extras. To keep it simple and
 * robust, mark outfield slots without an id (newly added this session) and any
 * surplus beyond the standard count.
 */
function isExtra(slot: Slot, standardOutfield: number, periodSlots: Slot[]): boolean {
  if (slot.isGk) return false;
  if (!slot.id) return true; // newly added in this editing session
  if (!isFinite(standardOutfield)) return false;
  const outfield = periodSlots.filter((s) => !s.isGk);
  // The surplus count beyond standard; mark that many of the highest-startMinute slots as extra.
  const surplus = outfield.length - standardOutfield;
  if (surplus <= 0) return false;
  const ranked = [...outfield].sort((a, b) => b.startMinute - a.startMinute);
  const extras = ranked.slice(0, surplus);
  return extras.includes(slot);
}
