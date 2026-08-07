import { cn } from '@/lib/utils';
import type { PlayerForSelection } from '@/services/team-selection.service';

/**
 * Formation position coordinates on a pitch (percentage-based).
 * Each position is { x, y } where 0,0 is top-left of the pitch area.
 * GK is always at the bottom (defending).
 */
const FORMATION_COORDS: Record<string, { x: number; y: number }[]> = {
  // Defence line positions
  '1-def': [{ x: 50, y: 75 }],
  '2-def': [{ x: 30, y: 75 }, { x: 70, y: 75 }],
  '3-def': [{ x: 20, y: 75 }, { x: 50, y: 75 }, { x: 80, y: 75 }],
  '4-def': [{ x: 15, y: 75 }, { x: 38, y: 75 }, { x: 62, y: 75 }, { x: 85, y: 75 }],
  // Midfield line positions
  '1-mid': [{ x: 50, y: 50 }],
  '2-mid': [{ x: 30, y: 50 }, { x: 70, y: 50 }],
  '3-mid': [{ x: 20, y: 50 }, { x: 50, y: 50 }, { x: 80, y: 50 }],
  '4-mid': [{ x: 15, y: 50 }, { x: 38, y: 50 }, { x: 62, y: 50 }, { x: 85, y: 50 }],
  '5-mid': [{ x: 12, y: 50 }, { x: 30, y: 50 }, { x: 50, y: 50 }, { x: 70, y: 50 }, { x: 88, y: 50 }],
  // Attack line positions
  '1-att': [{ x: 50, y: 25 }],
  '2-att': [{ x: 35, y: 25 }, { x: 65, y: 25 }],
  '3-att': [{ x: 20, y: 25 }, { x: 50, y: 25 }, { x: 80, y: 25 }],
};

export interface PitchSlot {
  id: string;          // slot identifier e.g. "GK", "LB-0", "CM-1"
  position: string;    // position label e.g. "LB", "CM", "CF"
  x: number;           // percentage x position on pitch
  y: number;           // percentage y position on pitch
  playerId?: string;   // assigned player
  playerName?: string; // display name
  isGk?: boolean;
}

export interface PitchViewProps {
  formation: string;           // e.g. "2-3-1"
  slots: PitchSlot[];          // current slot assignments
  availablePlayers?: PlayerForSelection[];
  selectedSlotId?: string | null;
  selectedPoolPlayerId?: string | null;
  onSlotTap?: (slotId: string) => void;
  onSlotDrop?: (slotId: string, playerId: string) => void;
  compact?: boolean;           // smaller version for period tabs
  className?: string;
}

/**
 * Parse a formation string like "2-3-1" into positioned slots.
 */
export function getFormationSlots(formation: string): PitchSlot[] {
  const lines = formation.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
  const slots: PitchSlot[] = [];

  // GK always present
  slots.push({ id: 'GK', position: 'GK', x: 50, y: 90, isGk: true });

  // Position labels per line
  const DEF_LABELS: Record<number, string[]> = {
    1: ['CB'], 2: ['LB', 'RB'], 3: ['LB', 'CB', 'RB'], 4: ['LB', 'LCB', 'RCB', 'RB'],
  };
  const MID_LABELS: Record<number, string[]> = {
    1: ['CM'], 2: ['LM', 'RM'], 3: ['LM', 'CM', 'RM'], 4: ['LM', 'LCM', 'RCM', 'RM'], 5: ['LM', 'LCM', 'CM', 'RCM', 'RM'],
  };
  const ATT_LABELS: Record<number, string[]> = {
    1: ['CF'], 2: ['CF', 'CF'], 3: ['CF', 'CF', 'CF'],
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const count = lines[lineIdx];
    const isDefence = lineIdx === 0;
    const isAttack = lineIdx === lines.length - 1;

    let lineType: string;
    let labels: string[];
    let coords: { x: number; y: number }[];

    if (isDefence) {
      lineType = 'def';
      labels = DEF_LABELS[count] ?? Array.from({ length: count }, (_, i) => `D${i + 1}`);
      coords = FORMATION_COORDS[`${count}-def`] ?? generateEvenCoords(count, 75);
    } else if (isAttack) {
      lineType = 'att';
      labels = ATT_LABELS[count] ?? Array.from({ length: count }, (_, i) => `F${i + 1}`);
      coords = FORMATION_COORDS[`${count}-att`] ?? generateEvenCoords(count, 25);
    } else {
      lineType = 'mid';
      labels = MID_LABELS[count] ?? Array.from({ length: count }, (_, i) => `M${i + 1}`);
      coords = FORMATION_COORDS[`${count}-mid`] ?? generateEvenCoords(count, 50);
    }

    for (let i = 0; i < count; i++) {
      slots.push({
        id: `${labels[i]}-${lineIdx}-${i}`,
        position: labels[i],
        x: coords[i]?.x ?? 50,
        y: coords[i]?.y ?? 50,
      });
    }
  }

  return slots;
}

function generateEvenCoords(count: number, y: number): { x: number; y: number }[] {
  const spacing = 80 / (count + 1);
  return Array.from({ length: count }, (_, i) => ({ x: 10 + spacing * (i + 1), y }));
}

/**
 * Position fit for colour coding.
 */
const POS_CATEGORY: Record<string, string> = {
  GK: 'gk', CB: 'def', LB: 'def', RB: 'def', LCB: 'def', RCB: 'def',
  CM: 'mid', LM: 'mid', RM: 'mid', LCM: 'mid', RCM: 'mid',
  CF: 'att',
};

function getSlotFitClass(slot: PitchSlot, player?: PlayerForSelection): string {
  if (!player || !slot.playerId) return '';
  if (slot.isGk) return player.isGkVolunteer ? 'ring-emerald-400' : 'ring-red-400';

  const positions = [player.primaryPosition, player.secondaryPosition, player.tertiaryPosition].filter(Boolean) as string[];
  // Exact match
  if (positions.includes(slot.position)) return 'ring-emerald-400';
  // Same line
  const slotCat = POS_CATEGORY[slot.position];
  if (slotCat && positions.some(p => POS_CATEGORY[p] === slotCat)) return 'ring-emerald-400';
  // Adjacent
  const ZONE_ORDER: Record<string, number> = { def: 0, mid: 1, att: 2 };
  const slotZone = ZONE_ORDER[slotCat] ?? -1;
  for (const pos of positions) {
    const pZone = ZONE_ORDER[POS_CATEGORY[pos]] ?? -1;
    if (Math.abs(slotZone - pZone) === 1) return 'ring-yellow-400';
  }
  return 'ring-red-400';
}

/**
 * PitchView — renders a football pitch with formation positions.
 * Slots can be empty (droppable) or filled (showing player name + position badge).
 */
export function PitchView({
  formation,
  slots,
  availablePlayers,
  selectedSlotId,
  selectedPoolPlayerId,
  onSlotTap,
  compact = false,
  className,
}: PitchViewProps) {
  const formationSlots = getFormationSlots(formation);

  // Merge slot data with formation coordinates
  const mergedSlots = formationSlots.map(fs => {
    const assigned = slots.find(s => s.id === fs.id);
    return { ...fs, ...assigned };
  });

  return (
    <div className={cn(
      'relative w-full bg-emerald-700 rounded-lg overflow-hidden',
      compact ? 'aspect-[3/4]' : 'aspect-[3/4] md:aspect-[4/5]',
      className
    )}>
      {/* Pitch markings */}
      <div className="absolute inset-0">
        {/* Centre circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] aspect-square rounded-full border border-white/20" />
        {/* Centre line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
        {/* Penalty area top */}
        <div className="absolute top-0 left-[25%] right-[25%] h-[18%] border-b border-l border-r border-white/20" />
        {/* Penalty area bottom */}
        <div className="absolute bottom-0 left-[25%] right-[25%] h-[18%] border-t border-l border-r border-white/20" />
        {/* Goal area top */}
        <div className="absolute top-0 left-[35%] right-[35%] h-[8%] border-b border-l border-r border-white/15" />
        {/* Goal area bottom */}
        <div className="absolute bottom-0 left-[35%] right-[35%] h-[8%] border-t border-l border-r border-white/15" />
      </div>

      {/* Position slots */}
      {mergedSlots.map((slot) => {
        const player = availablePlayers?.find(p => p.id === slot.playerId);
        const isSelected = selectedSlotId === slot.id;
        const isDropTarget = selectedPoolPlayerId && !slot.playerId;
        const fitClass = slot.playerId ? getSlotFitClass(slot, player) : '';

        return (
          <button
            key={slot.id}
            onClick={() => onSlotTap?.(slot.id)}
            className={cn(
              'absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all',
              compact ? 'w-10 h-10' : 'w-14 h-14 md:w-16 md:h-16',
              slot.playerId
                ? `bg-white/95 rounded-full shadow-md ring-2 ${fitClass}`
                : 'bg-white/30 border-2 border-dashed border-white/60 rounded-full',
              isSelected && 'ring-4 ring-blue-400 scale-110',
              isDropTarget && 'ring-2 ring-blue-300 bg-white/50 animate-pulse',
            )}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            {slot.playerId ? (
              <>
                <span className={cn(
                  'font-bold text-emerald-800 leading-tight',
                  compact ? 'text-[8px]' : 'text-[10px] md:text-xs'
                )}>
                  {slot.playerName?.split(' ')[0] ?? '?'}
                </span>
                <span className={cn(
                  'text-emerald-600 font-medium',
                  compact ? 'text-[7px]' : 'text-[8px] md:text-[10px]'
                )}>
                  {slot.position}
                </span>
              </>
            ) : (
              <span className={cn(
                'text-white font-bold',
                compact ? 'text-[8px]' : 'text-[10px] md:text-xs'
              )}>
                {slot.position}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
