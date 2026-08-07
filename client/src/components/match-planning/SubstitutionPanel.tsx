import { useState } from 'react';
import { ArrowRightLeft, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PlayerForSelection } from '@/services/team-selection.service';

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

interface SubstitutionPanelProps {
  period: number;
  periodDuration: number;
  slots: SlotData[];             // All slots for this period
  availablePlayers: PlayerForSelection[];
  onAddSub: (playerOffId: string, playerOnId: string, minute: number, position: string, isGk: boolean) => void;
  onEditSubMinute: (playerOffId: string, playerOnId: string, newMinute: number) => void;
  onDeleteSub: (playerOffId: string, playerOnId: string) => void;
}

/**
 * Substitution Panel — shows planned within-quarter substitutions.
 * Allows adding, editing and deleting subs for the active period.
 */
export function SubstitutionPanel({ period, periodDuration, slots, availablePlayers, onAddSub, onEditSubMinute, onDeleteSub }: SubstitutionPanelProps) {
  const [adding, setAdding] = useState(false);
  const [subPlayerOff, setSubPlayerOff] = useState('');
  const [subPlayerOn, setSubPlayerOn] = useState('');
  const [subMinute, setSubMinute] = useState(Math.floor(periodDuration / 2));

  // Find substitutions: a sub exists when a player has endMinute < periodDuration (goes off)
  // and another player has the same position with startMinute > 0 (comes on)
  const substitutions = slots
    .filter(s => s.endMinute < periodDuration && s.startMinute === 0)
    .map(offSlot => {
      const onSlot = slots.find(s => s.position === offSlot.position && s.startMinute === offSlot.endMinute && s.period === period);
      if (!onSlot) return null;
      const offPlayer = availablePlayers.find(p => p.id === offSlot.playerId);
      const onPlayer = availablePlayers.find(p => p.id === onSlot.playerId);
      return {
        playerOffId: offSlot.playerId,
        playerOnId: onSlot.playerId,
        playerOffName: offPlayer ? `${offPlayer.firstName}` : offSlot.playerId,
        playerOnName: onPlayer ? `${onPlayer.firstName}` : onSlot.playerId,
        minute: offSlot.endMinute,
        position: offSlot.position,
        isGk: offSlot.isGk,
      };
    })
    .filter(Boolean) as { playerOffId: string; playerOnId: string; playerOffName: string; playerOnName: string; minute: number; position: string; isGk: boolean }[];

  // Players currently on pitch at start (full starters + partial starters)
  const startersOnPitch = slots.filter(s => s.startMinute === 0);
  // Players in the pool (not on pitch this period at all)
  const onPitchIds = new Set(slots.map(s => s.playerId));
  const benchPlayers = availablePlayers.filter(p => !onPitchIds.has(p.id));

  const handleConfirmSub = () => {
    if (!subPlayerOff || !subPlayerOn || subMinute <= 0 || subMinute >= periodDuration) return;
    const offSlot = startersOnPitch.find(s => s.playerId === subPlayerOff);
    onAddSub(subPlayerOff, subPlayerOn, subMinute, offSlot?.position ?? 'CM', offSlot?.isGk ?? false);
    setAdding(false);
    setSubPlayerOff('');
    setSubPlayerOn('');
    setSubMinute(Math.floor(periodDuration / 2));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Q{period} Planned Subs
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(!adding)}>
          <Plus className="h-3 w-3" /> Add Sub
        </Button>
      </div>

      {/* Existing substitutions */}
      {substitutions.length > 0 && (
        <div className="space-y-1">
          {substitutions.map((sub, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5 text-xs">
              <span className="font-mono text-muted-foreground w-6">{sub.minute}'</span>
              <span className="text-red-600">▼ {sub.playerOffName}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-emerald-600">▲ {sub.playerOnName}</span>
              <span className="text-muted-foreground ml-auto">{sub.position}</span>
              {/* Edit minute */}
              <input
                type="range"
                min={1}
                max={periodDuration - 1}
                value={sub.minute}
                onChange={(e) => onEditSubMinute(sub.playerOffId, sub.playerOnId, Number(e.target.value))}
                className="w-16 h-4 accent-primary"
              />
              <button onClick={() => onDeleteSub(sub.playerOffId, sub.playerOnId)} className="text-red-400 hover:text-red-600 p-1">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {substitutions.length === 0 && !adding && (
        <p className="text-[10px] text-muted-foreground">No subs planned for this quarter.</p>
      )}

      {/* Add sub form */}
      {adding && (
        <div className="border rounded-lg p-3 space-y-3 bg-card">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Player Off</label>
              <select
                value={subPlayerOff}
                onChange={(e) => setSubPlayerOff(e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5 bg-background"
              >
                <option value="">Select...</option>
                {startersOnPitch.filter(s => s.endMinute === periodDuration).map(s => {
                  const p = availablePlayers.find(pl => pl.id === s.playerId);
                  return <option key={s.playerId} value={s.playerId}>{p?.firstName} {p?.lastName} ({s.position})</option>;
                })}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Player On</label>
              <select
                value={subPlayerOn}
                onChange={(e) => setSubPlayerOn(e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5 bg-background"
              >
                <option value="">Select...</option>
                {benchPlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.primaryPosition})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Substitution Minute: {subMinute}'</label>
            <input
              type="range"
              min={1}
              max={periodDuration - 1}
              value={subMinute}
              onChange={(e) => setSubMinute(Number(e.target.value))}
              className="w-full h-8 accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1'</span>
              <span>{periodDuration - 1}'</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs" onClick={handleConfirmSub} disabled={!subPlayerOff || !subPlayerOn}>
              Confirm Sub
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
