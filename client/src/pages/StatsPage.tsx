import { useState } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { usePlayerStats, useTeamStats, useMatchResults } from '@/hooks/use-statistics';
import type { PlayerSeasonStats } from '@/services/statistics.service';

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
          {tab === 'players' && playerStats && <PlayerStatsView stats={playerStats} />}
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

function PlayerStatsView({ stats }: { stats: PlayerSeasonStats[] }) {
  const [sortBy, setSortBy] = useState<keyof PlayerSeasonStats>('goals');

  const hasData = stats.some((s) => s.appearances > 0);
  if (!hasData) {
    return <EmptyStats message="No player statistics yet. Record a match to see individual stats." />;
  }

  const sorted = [...stats].filter((s) => s.appearances > 0).sort((a, b) => {
    const aVal = a[sortBy] as number;
    const bVal = b[sortBy] as number;
    return bVal - aVal;
  });

  return (
    <div className="space-y-4">
      {/* Sort selector */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sort by:</span>
        {(['goals', 'assists', 'appearances', 'cleanSheets', 'motmAwards', 'totalMinutes'] as (keyof PlayerSeasonStats)[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              sortBy === key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
            }`}
          >
            {formatSortLabel(key)}
          </button>
        ))}
      </div>

      {/* Stats table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Player</th>
              <th className="pb-2 font-medium text-center">Apps</th>
              <th className="pb-2 font-medium text-center">Goals</th>
              <th className="pb-2 font-medium text-center">Assists</th>
              <th className="pb-2 font-medium text-center">CS</th>
              <th className="pb-2 font-medium text-center">MOTM</th>
              <th className="pb-2 font-medium text-right">Minutes</th>
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
                <td className="py-2.5 text-center">{s.cleanSheets || '-'}</td>
                <td className="py-2.5 text-center">{s.motmAwards || '-'}</td>
                <td className="py-2.5 text-right text-muted-foreground">
                  {s.outfieldMinutes > 0 && <span>{s.outfieldMinutes}</span>}
                  {s.goalkeeperMinutes > 0 && (
                    <span className="text-xs"> +{s.goalkeeperMinutes} GK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsView({ results }: { results: { fixtureId: string; date: string; opponent: string | null; goalsFor: number; goalsAgainst: number; result: string | null }[] }) {
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
            <span className="font-bold">{r.goalsFor}-{r.goalsAgainst}</span>
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
    appearances: 'Apps',
    cleanSheets: 'CS',
    motmAwards: 'MOTM',
    totalMinutes: 'Minutes',
  };
  return labels[key] ?? key;
}
