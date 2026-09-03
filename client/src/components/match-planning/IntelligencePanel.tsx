import { AlertTriangle, Check, Users, Clock, Target } from 'lucide-react';

export interface PlanIntelligence {
  availableCount: number;
  selectedCount: number;
  notAllocatedCount: number;
  highestMinutes: number;
  lowestMinutes: number;
  averageMinutes: number;
  warnings: string[];
  // Guidance for building from scratch (optional so older callers still work)
  outfieldSlots?: number;
  matchDuration?: number;
  periodDuration?: number;
  totalPeriods?: number;
  periodLabel?: string; // 'half' | 'quarter' | 'period'
  targetMinutesPerPlayer?: number;
  targetSharePct?: number;
  targetPeriods?: number;
}

interface IntelligencePanelProps {
  data: PlanIntelligence;
}

/**
 * Intelligence Panel — shows plan summary and warnings.
 * Informative, not obstructive.
 */
export function IntelligencePanel({ data }: IntelligencePanelProps) {
  const isBalanced = data.highestMinutes - data.lowestMinutes <= 5;

  const hasGuidance = data.availableCount > 0 && !!data.outfieldSlots && !!data.targetMinutesPerPlayer;
  const periodLabel = data.periodLabel ?? 'period';
  const targetPeriods = data.targetPeriods ?? 0;
  // Nicely describe the period target (e.g. "2 quarters", "1.5 halves")
  const periodTargetText = targetPeriods > 0
    ? `${Number.isInteger(targetPeriods) ? targetPeriods : targetPeriods.toFixed(1)} ${periodLabel}${targetPeriods === 1 ? '' : 's'}`
    : null;

  return (
    <div className="space-y-3">
      {/* Fair-play guidance — helps a coach starting from scratch */}
      {hasGuidance && (
        <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-800">
            <Target className="h-3.5 w-3.5" />
            Fair-play target
          </div>
          <p className="text-xs text-blue-900 leading-relaxed">
            {data.availableCount} available for {data.outfieldSlots} outfield spots over{' '}
            {data.totalPeriods} {periodLabel}{data.totalPeriods === 1 ? '' : 's'} ({data.matchDuration} min).
          </p>
          <p className="text-xs text-blue-900 leading-relaxed">
            Aim for about{' '}
            <span className="font-semibold">{data.targetMinutesPerPlayer} min each</span>
            {periodTargetText && <> (~{periodTargetText})</>}
            {typeof data.targetSharePct === 'number' && <> — {data.targetSharePct}% of the match</>}.
          </p>
        </div>
      )}

      {/* Squad summary */}
      <div className="flex items-center gap-2 text-sm">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Available:</span>
        <span className="font-medium">{data.availableCount}</span>
        <span className="text-muted-foreground ml-2">Selected:</span>
        <span className="font-medium">{data.selectedCount}</span>
      </div>

      {/* Playing time summary */}
      {data.selectedCount > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">High:</span>
          <span className="font-medium">{data.highestMinutes}m</span>
          <span className="text-muted-foreground ml-1">Low:</span>
          <span className="font-medium">{data.lowestMinutes}m</span>
          <span className="text-muted-foreground ml-1">Avg:</span>
          <span className="font-medium">{data.averageMinutes}m</span>
        </div>
      )}

      {/* Status */}
      {data.selectedCount > 0 && isBalanced && data.warnings.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-md px-3 py-1.5">
          <Check className="h-4 w-4" />
          <span>Balanced plan</span>
        </div>
      )}

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="space-y-1">
          {data.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Not allocated warning */}
      {data.notAllocatedCount > 0 && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-md px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{data.notAllocatedCount} player{data.notAllocatedCount > 1 ? 's' : ''} not allocated any minutes</span>
        </div>
      )}
    </div>
  );
}
