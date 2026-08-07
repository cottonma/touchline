import { cn } from '@/lib/utils';
import type { PlayerForSelection } from '@/services/team-selection.service';

export interface PlayerPoolEntry {
  player: PlayerForSelection;
  plannedMinutes: number;
  outfieldMinutes: number;
  gkMinutes: number;
  periodsPlayed: number;
  isAllocated: boolean;  // has at least one slot assignment
}

interface PlayerPoolProps {
  entries: PlayerPoolEntry[];
  targetMinutes: number;
  selectedPlayerId?: string | null;
  onPlayerTap: (playerId: string) => void;
  compact?: boolean;
}

const POS_SHORT: Record<string, string> = {
  GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB',
  CM: 'CM', LM: 'LM', RM: 'RM', CF: 'CF',
};

/**
 * Player Pool — shows available players alongside the pitch.
 * Displays planned minutes, position preferences, and allocation status.
 */
export function PlayerPool({ entries, targetMinutes, selectedPlayerId, onPlayerTap, compact = false }: PlayerPoolProps) {
  const sorted = [...entries].sort((a, b) => {
    // Unallocated first, then by minutes ascending
    if (a.isAllocated !== b.isAllocated) return a.isAllocated ? 1 : -1;
    return a.plannedMinutes - b.plannedMinutes;
  });

  return (
    <div className={cn('space-y-1', compact ? 'max-h-48 overflow-y-auto' : '')}>
      {sorted.map(({ player, plannedMinutes, outfieldMinutes, isAllocated }) => {
        const isSelected = selectedPlayerId === player.id;
        // Fairness diff uses outfield minutes only (GK time doesn't count)
        const diff = outfieldMinutes - targetMinutes;
        const diffLabel = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0';
        const diffColor = Math.abs(diff) <= 2 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-amber-600';

        return (
          <button
            key={player.id}
            onClick={() => onPlayerTap(player.id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all min-h-[44px]',
              isSelected
                ? 'bg-blue-100 ring-2 ring-blue-400'
                : isAllocated
                  ? 'bg-muted/50 hover:bg-muted'
                  : 'bg-red-50 border border-red-200 hover:bg-red-100',
              'active:scale-[0.98]'
            )}
          >
            {/* Player name + positions */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-sm font-medium truncate', !isAllocated && 'text-red-700')}>
                  {player.firstName} {player.lastName}
                </span>
              </div>
              <div className="flex gap-1 mt-0.5">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                  {POS_SHORT[player.primaryPosition] ?? player.primaryPosition}
                </span>
                {player.secondaryPosition && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                    {POS_SHORT[player.secondaryPosition] ?? player.secondaryPosition}
                  </span>
                )}
                {player.tertiaryPosition && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                    {POS_SHORT[player.tertiaryPosition] ?? player.tertiaryPosition}
                  </span>
                )}
              </div>
            </div>

            {/* Minutes + diff */}
            <div className="text-right flex-shrink-0">
              <span className="text-xs font-bold tabular-nums">{plannedMinutes}m</span>
              <span className={cn('block text-[10px] font-medium tabular-nums', diffColor)}>
                {diffLabel}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
