/**
 * PitchPreview — A CSS-based pitch diagram showing a formation with position labels.
 * Renders a green rectangle with positioned dots representing players.
 */

interface PitchPreviewProps {
  formation: string;
}

/**
 * Get position labels for each row based on how many players are in the line
 * and which row it is (0 = defence, last = attack).
 */
function getPositionLabels(lineCount: number, rowIndex: number, totalRows: number): string[] {
  // rowIndex 0 = defence, last = attack
  const isDefence = rowIndex === 0;
  const isAttack = rowIndex === totalRows - 1;
  const isMidfield = !isDefence && !isAttack;

  if (isDefence) {
    if (lineCount === 1) return ['CB'];
    if (lineCount === 2) return ['LB', 'RB'];
    if (lineCount === 3) return ['LB', 'CB', 'RB'];
    if (lineCount === 4) return ['LB', 'LCB', 'RCB', 'RB'];
    if (lineCount === 5) return ['LWB', 'LCB', 'CB', 'RCB', 'RWB'];
    return Array.from({ length: lineCount }, (_, i) => `D${i + 1}`);
  }

  if (isAttack) {
    if (lineCount === 1) return ['CF'];
    if (lineCount === 2) return ['CF', 'CF'];
    if (lineCount === 3) return ['CF', 'CF', 'CF'];
    if (lineCount === 4) return ['CF', 'CF', 'CF', 'CF'];
    return Array.from({ length: lineCount }, (_, i) => 'CF');
  }

  // Midfield
  if (lineCount === 1) return ['CM'];
  if (lineCount === 2) return ['LM', 'RM'];
  if (lineCount === 3) return ['LM', 'CM', 'RM'];
  if (lineCount === 4) return ['LM', 'LCM', 'RCM', 'RM'];
  if (lineCount === 5) return ['LM', 'LCM', 'CM', 'RCM', 'RM'];
  return Array.from({ length: lineCount }, (_, i) => `M${i + 1}`);
}

export function PitchPreview({ formation }: PitchPreviewProps) {
  // Parse "1-2-3" into [1, 2, 3]
  const lines = formation.split('-').map(Number).filter(n => !isNaN(n) && n > 0);

  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg bg-green-800/20 border border-green-700/30">
        <span className="text-sm text-muted-foreground">Enter a formation to see preview</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 rounded-lg bg-green-800 border border-green-700 overflow-hidden">
      {/* Pitch markings */}
      <div className="absolute inset-0">
        {/* Centre line */}
        <div className="absolute top-1/2 left-4 right-4 h-px bg-white/30" />
        {/* Centre circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/20" />
        {/* Penalty areas */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-10 border-b border-l border-r border-white/20 rounded-b" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-10 border-t border-l border-r border-white/20 rounded-t" />
      </div>

      {/* Players */}
      <div className="absolute inset-4 flex flex-col justify-between">
        {/* Attack rows at the top, defence at the bottom, GK at very bottom */}
        {[...lines].reverse().map((count, reversedIdx) => {
          // reversedIdx 0 = attack (top), last = defence (bottom)
          const originalIdx = lines.length - 1 - reversedIdx;
          const labels = getPositionLabels(count, originalIdx, lines.length);

          return (
            <div key={reversedIdx} className="flex justify-center items-center gap-1">
              {Array.from({ length: count }).map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  className="w-8 h-8 rounded-full bg-white border-2 border-white/80 shadow-md flex items-center justify-center"
                  style={{
                    marginLeft: count > 1 ? `${Math.max(6, 48 / count)}px` : '0',
                    marginRight: count > 1 ? `${Math.max(6, 48 / count)}px` : '0',
                  }}
                >
                  <span className="text-[8px] font-bold text-green-800 leading-none">
                    {labels[dotIdx] || ''}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        {/* GK */}
        <div className="flex justify-center items-center">
          <div className="w-8 h-8 rounded-full bg-yellow-400 border-2 border-yellow-500 shadow-md flex items-center justify-center">
            <span className="text-[8px] font-bold text-green-800 leading-none">GK</span>
          </div>
        </div>
      </div>

      {/* Formation label */}
      <div className="absolute bottom-1 right-2 text-xs text-white/60 font-mono">
        {formation}
      </div>
    </div>
  );
}
