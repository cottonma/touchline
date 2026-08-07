import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PlayerForSelection } from '@/services/team-selection.service';

interface SlotData {
  period: number;
  playerId: string;
  position: string;
  isGk: boolean;
  startMinute: number;
  endMinute: number;
}

interface PlayingTimeTableProps {
  slots: SlotData[];
  players: PlayerForSelection[];
  periods: number;
  periodDuration: number;
  matchDuration: number;
  outfieldSlots: number;
}

/**
 * Playing Time Table — shows each player's minutes per quarter.
 * Derives all figures from the same slot data as the pitch view.
 * Distinguishes GK minutes from outfield minutes.
 */
export function PlayingTimeTable({ slots, players, periods, periodDuration, matchDuration, outfieldSlots }: PlayingTimeTableProps) {
  const targetMinutes = players.length > 0 ? Math.round(matchDuration * outfieldSlots / players.length) : 0;

  const rows = useMemo(() => {
    return players
      .map(player => {
        const playerSlots = slots.filter(s => s.playerId === player.id);
        const quarterMinutes: { outfield: number; gk: number }[] = [];

        for (let p = 1; p <= periods; p++) {
          const periodSlots = playerSlots.filter(s => s.period === p);
          let outfield = 0;
          let gk = 0;
          for (const s of periodSlots) {
            const mins = s.endMinute - s.startMinute;
            if (s.isGk) gk += mins;
            else outfield += mins;
          }
          quarterMinutes.push({ outfield, gk });
        }

        const totalOutfield = quarterMinutes.reduce((sum, q) => sum + q.outfield, 0);
        const totalGk = quarterMinutes.reduce((sum, q) => sum + q.gk, 0);
        const total = totalOutfield + totalGk;
        const diff = totalOutfield - targetMinutes; // fairness uses outfield only

        return {
          player,
          quarterMinutes,
          totalOutfield,
          totalGk,
          total,
          diff,
        };
      })
      .sort((a, b) => a.player.lastName.localeCompare(b.player.lastName));
  }, [slots, players, periods, targetMinutes]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium text-xs">Player</th>
            {Array.from({ length: periods }, (_, i) => (
              <th key={i} className="pb-2 px-1 font-medium text-xs text-center w-12">Q{i + 1}</th>
            ))}
            <th className="pb-2 px-1 font-medium text-xs text-center w-12">OF</th>
            <th className="pb-2 px-1 font-medium text-xs text-center w-12">GK</th>
            <th className="pb-2 px-1 font-medium text-xs text-center w-14">Total</th>
            <th className="pb-2 px-1 font-medium text-xs text-center w-12">+/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, quarterMinutes, totalOutfield, totalGk, total, diff }) => (
            <tr key={player.id} className="border-b last:border-0">
              <td className="py-1.5 pr-3 text-xs font-medium truncate max-w-[120px]">
                {player.firstName} {player.lastName}
              </td>
              {quarterMinutes.map((q, idx) => {
                const mins = q.outfield + q.gk;
                return (
                  <td key={idx} className="py-1.5 px-1 text-center text-xs tabular-nums">
                    {mins > 0 ? (
                      <span className={q.gk > 0 ? 'text-amber-700' : ''}>
                        {mins}
                        {q.gk > 0 && q.outfield > 0 && <span className="text-[9px] text-muted-foreground">*</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
              <td className="py-1.5 px-1 text-center text-xs tabular-nums">{totalOutfield || '-'}</td>
              <td className="py-1.5 px-1 text-center text-xs tabular-nums text-amber-700">{totalGk || '-'}</td>
              <td className="py-1.5 px-1 text-center text-xs font-bold tabular-nums">{total}</td>
              <td className={cn(
                'py-1.5 px-1 text-center text-xs font-medium tabular-nums',
                diff > 5 ? 'text-amber-600' : diff < -5 ? 'text-red-600' : 'text-emerald-600'
              )}>
                {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
        <span>OF = Outfield mins</span>
        <span className="text-amber-700">GK = Goalkeeper mins</span>
        <span>Target: ~{targetMinutes}m per player</span>
      </div>
    </div>
  );
}
