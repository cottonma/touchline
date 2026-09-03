import { useState } from 'react';
import { Trophy, TrendingUp, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { usePlayerStats, useTeamStats, useMatchResults } from '@/hooks/use-statistics';
import type { PlayerSeasonStats } from '@/services/statistics.service';
import { formatScoreline } from '@/lib/utils';

type Tab = 'team' | 'players' | 'results';

/**
 * Statistics page - player and team stats from recorded match data.
 * Positive stats only. Leaderboards visible for coach.
 */
export function StatsPage() {
  const [tab, setTab] = useState<Tab>('team');
  const { data: playerStats, isLoading: playersLoading } = usePlayerStats();
  const { data: teamStats, isLoading: teamLoading } = useTeamStats();
  const { data: results, isLoading: resultsLoading } = useMatchResults();

  const isLoading = playersLoading || teamLoading || resultsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Statistics</h2>
        <p className="text-muted-foreground">Season statistics for your team and players.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(['team', 'players', 'results'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Loading statistics...</div>
      ) : (
        <>
          {tab === 'team' && teamStats && <TeamStatsView stats={teamStats} />}
          {tab === 'players' && playerStats && <PlayerStatsView stats={playerStats} periods={teamStats?.periods} />}
          {tab === 'results' && results && <ResultsView results={results} />}
        </>
      )}
    </div>
  );
}

function TeamStatsView({ stats }: { stats: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; cleanSheets: number; winPercentage: number } }) {
  if (stats.played === 0) {
    return <EmptyStats message="No matches recorded yet. Record your first match to see team statistics." />;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Played" value={stats.played} />
        <StatCard label="Won" value={stats.won} accent="text-green-600" />
        <StatCard label="Drawn" value={stats.drawn} />
        <StatCard label="Lost" value={stats.lost} accent="text-red-600" />
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Goals For" value={stats.goalsFor} />
        <StatCard label="Goals Against" value={stats.goalsAgainst} />
        <StatCard label="Goal Difference" value={`${stats.goalDifference >= 0 ? '+' : ''}${stats.goalDifference}`} accent={stats.goalDifference >= 0 ? 'text-green-600' : 'text-red-600'} />
        <StatCard label="Clean Sheets" value={stats.cleanSheets} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Win Rate</span>
            <span className="text-2xl font-bold">{stats.winPercentage}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stats.winPercentage}%` }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlayerStatsView({ stats, periods }: { stats: PlayerSeasonStats[]; periods?: number }) {
  const [sortBy, setSortBy] = useState<keyof PlayerSeasonStats>('goals');

  // Period wording adapts to the team's format
  const periodWord = periods === 2 ? 'Half' : periods === 4 ? 'Quarter' : 'Period';
  const csHeader = `CS ${periodWord}s`;

  const hasData = stats.some((s) => s.appearances > 0);
  if (!hasData) {
    return <EmptyStats message="No player statistics yet. Record a match to see individual stats." />;
  }

  const sorted = [...stats].filter((s) => s.appearances > 0).sort((a, b) => {
    const aVal = a[sortBy] as number;
    const bVal = b[sortBy] as number;
    return bVal - aVal;
  });

  const sortOptions: (keyof PlayerSeasonStats)[] = ['goals', 'assists', 'goalInvolvements', 'appearances', 'cleanSheets', 'motmAwards', 'totalMinutes'];

  return (
    <div className="space-y-4">
      {/* Sort selector — scrollable on mobile */}
      <div className="flex items-center gap-2 text-sm overflow-x-auto pb-1 -mx-1 px-1">
        <span className="text-muted-foreground shrink-0">Sort by:</span>
        {sortOptions.map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              sortBy === key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
            }`}
          >
            {formatSortLabel(key)}
          </button>
        ))}
      </div>

      {/* MOBILE: expandable player cards */}
      <div className="space-y-2 md:hidden">
        {sorted.map((s, idx) => (
          <PlayerStatCard key={s.playerId} s={s} rank={idx} sortBy={sortBy} periodWord={periodWord} />
        ))}
      </div>

      {/* DESKTOP: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Player</th>
              <th className="pb-2 font-medium text-center">Apps</th>
              <th className="pb-2 font-medium text-center">Goals</th>
              <th className="pb-2 font-medium text-center">Assists</th>
              <th className="pb-2 font-medium text-center" title="Goal involvements — goals plus assists">G+A</th>
              <th className="pb-2 font-medium text-center" title={`Clean sheet ${periodWord.toLowerCase()}s — full ${periodWord.toLowerCase()}s played where no goal was conceded`}>{csHeader}</th>
              <th className="pb-2 font-medium text-center">MOTM</th>
              <th className="pb-2 font-medium text-center" title={`Total ${periodWord.toLowerCase()}s a player featured in`}>{periodWord.charAt(0)}s Played</th>
              <th className="pb-2 font-medium text-right" title="Outfield minutes">Outfield</th>
              <th className="pb-2 font-medium text-right" title="Goalkeeper minutes">GK</th>
              <th className="pb-2 font-medium text-right" title="Total minutes (outfield + GK)">Total</th>
              <th className="pb-2 font-medium text-right" title="Average outfield minutes per appearance (GK time excluded)">Avg/App</th>
              <th className="pb-2 font-medium text-right" title="Outfield minutes played per goal scored (GK time excluded)">Min/Goal</th>
              <th className="pb-2 font-medium text-right" title="Outfield minutes played per assist (GK time excluded)">Min/Assist</th>
              <th className="pb-2 font-medium text-center" title="Percentage of minutes played in goal">GK %</th>
              <th className="pb-2 font-medium" title="Distinct positions played this season">Positions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, idx) => (
              <tr key={s.playerId} className="border-b last:border-0">
                <td className="py-2.5 font-medium">
                  <div className="flex items-center gap-2">
                    {idx === 0 && sortBy !== 'appearances' && sortBy !== 'totalMinutes' && (
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    {s.playerName}
                  </div>
                </td>
                <td className="py-2.5 text-center">{s.appearances}</td>
                <td className="py-2.5 text-center font-medium">{s.goals || '-'}</td>
                <td className="py-2.5 text-center">{s.assists || '-'}</td>
                <td className="py-2.5 text-center font-medium">{s.goalInvolvements || '-'}</td>
                <td className="py-2.5 text-center">{s.cleanSheets || '-'}</td>
                <td className="py-2.5 text-center">{s.motmAwards || '-'}</td>
                <td className="py-2.5 text-center text-muted-foreground">{s.periodsPlayed || '-'}</td>
                <td className="py-2.5 text-right text-muted-foreground">{s.outfieldMinutes || '-'}</td>
                <td className="py-2.5 text-right text-muted-foreground">{s.goalkeeperMinutes || '-'}</td>
                <td className="py-2.5 text-right font-medium">{s.totalMinutes || '-'}</td>
                <td className="py-2.5 text-right text-muted-foreground">{s.avgMinutesPerAppearance || '-'}</td>
                <td className="py-2.5 text-right text-muted-foreground">{s.minutesPerGoal != null ? `${s.minutesPerGoal}'` : '-'}</td>
                <td className="py-2.5 text-right text-muted-foreground">{s.minutesPerAssist != null ? `${s.minutesPerAssist}'` : '-'}</td>
                <td className="py-2.5 text-center text-muted-foreground">{s.gkSharePct > 0 ? `${s.gkSharePct}%` : '-'}</td>
                <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">{s.positionsPlayed.length > 0 ? s.positionsPlayed.join(', ') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p><span className="font-medium">G+A</span> = goal involvements (goals + assists). <span className="font-medium">{csHeader}</span> = {periodWord.toLowerCase()}s played in full with no goal conceded (GK and outfield count).</p>
        <p><span className="font-medium">Min/Goal</span> &amp; <span className="font-medium">Min/Assist</span> = outfield minutes per goal / assist (time in goal excluded). <span className="font-medium">Avg/App</span> = average outfield minutes per appearance (GK time excluded). <span className="font-medium">GK %</span> = share of minutes in goal. <span className="font-medium">Positions</span> = distinct positions played this season.</p>
      </div>
    </div>
  );
}

/** Mobile: a tappable player card showing headline stats, expanding to full detail. */
function PlayerStatCard({ s, rank, sortBy, periodWord }: { s: PlayerSeasonStats; rank: number; sortBy: keyof PlayerSeasonStats; periodWord: string }) {
  const [open, setOpen] = useState(false);

  const headlineLabel = formatSortLabel(sortBy);
  const headlineValue = (() => {
    const v = s[sortBy];
    if (typeof v === 'number') return v;
    return (v as any) ?? '-';
  })();

  const detail: { label: string; value: string | number }[] = [
    { label: 'Appearances', value: s.appearances },
    { label: 'Goals', value: s.goals },
    { label: 'Assists', value: s.assists },
    { label: 'Goal involvements', value: s.goalInvolvements },
    { label: `CS ${periodWord.toLowerCase()}s`, value: s.cleanSheets },
    { label: 'MOTM', value: s.motmAwards },
    { label: `${periodWord}s played`, value: s.periodsPlayed },
    { label: 'Outfield minutes', value: s.outfieldMinutes },
    { label: 'GK minutes', value: s.goalkeeperMinutes },
    { label: 'Total minutes', value: s.totalMinutes },
    { label: 'Avg mins / appearance', value: s.avgMinutesPerAppearance },
    { label: 'Mins per goal', value: s.minutesPerGoal != null ? `${s.minutesPerGoal}'` : '-' },
    { label: 'Mins per assist', value: s.minutesPerAssist != null ? `${s.minutesPerAssist}'` : '-' },
    { label: 'GK share', value: s.gkSharePct > 0 ? `${s.gkSharePct}%` : '-' },
    { label: 'Positions', value: s.positionsPlayed.length > 0 ? s.positionsPlayed.join(', ') : '-' },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {rank === 0 && sortBy !== 'appearances' && sortBy !== 'totalMinutes' && (
              <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
            <span className="font-semibold truncate">{s.playerName}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {s.goals}G · {s.assists}A · {s.appearances} app · {s.totalMinutes} min
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold leading-none">{headlineValue}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{headlineLabel}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t px-3 py-2 grid grid-cols-1 gap-y-1.5">
          {detail.map((d) => (
            <div key={d.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-medium text-right ml-3">{d.value === 0 ? '-' : d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsView({ results }: { results: { fixtureId: string; date: string; opponent: string | null; homeAway?: string | null; goalsFor: number; goalsAgainst: number; result: string | null }[] }) {
  if (results.length === 0) {
    return <EmptyStats message="No results recorded yet." />;
  }

  return (
    <div className="space-y-2">
      {results.map((r) => (
        <div key={r.fixtureId} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="w-20 text-xs text-muted-foreground">
            {new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </div>
          <div className="flex-1 font-medium text-sm">{r.opponent ?? 'Unknown'}</div>
          <div className="flex items-center gap-2">
            <span className="font-bold">{formatScoreline(r.goalsFor, r.goalsAgainst, r.homeAway)}</span>
            <Badge variant={r.result === 'win' ? 'success' : r.result === 'loss' ? 'destructive' : 'secondary'} className="text-xs">
              {r.result === 'win' ? 'W' : r.result === 'loss' ? 'L' : 'D'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${accent ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyStats({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed py-12 text-center">
      <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/50" />
      <p className="mt-4 text-sm text-muted-foreground max-w-sm mx-auto">{message}</p>
    </div>
  );
}

function formatSortLabel(key: keyof PlayerSeasonStats): string {
  const labels: Record<string, string> = {
    goals: 'Goals',
    assists: 'Assists',
    goalInvolvements: 'G+A',
    appearances: 'Apps',
    cleanSheets: 'CS',
    motmAwards: 'MOTM',
    totalMinutes: 'Minutes',
  };
  return labels[key] ?? key;
}
