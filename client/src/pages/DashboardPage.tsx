import { useNavigate } from 'react-router-dom';
import { Calendar, Users, CheckCircle, AlertTriangle, Trophy, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/hooks/use-dashboard';
import { useEffect } from 'react';

/**
 * Dashboard - the landing page for Touchline.
 * Shows next fixture, availability status, quick actions, recent results, playing time balance.
 */
export function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const navigate = useNavigate();

  // Redirect to setup wizard if no players and setup not completed
  useEffect(() => {
    if (!isLoading && data && data.squad.activeCount === 0 && !localStorage.getItem('touchline_setup_complete')) {
      navigate('/setup', { replace: true });
    }
  }, [data, isLoading, navigate]);

  if (isLoading) {
    return <div className="text-muted-foreground py-12 text-center">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="text-muted-foreground py-12 text-center">Unable to load dashboard.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          {data.squad.activeCount > 0
            ? `${data.squad.activeCount} players · ${data.seasonStats.played} matches played`
            : 'Welcome to Touchline. Add your players to get started.'}
        </p>
      </div>

      {/* Outstanding actions */}
      {data.outstandingActions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Action needed</p>
                {data.outstandingActions.map((action, i) => (
                  <p key={i} className="text-sm text-amber-700">• {action}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Next fixture */}
        <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => data.nextFixture && navigate(`/fixtures/${data.nextFixture.id}`)}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Next Fixture</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.nextFixture ? (
              <>
                <p className="text-lg font-bold">
                  {data.nextFixture.type === 'training'
                    ? 'Training'
                    : `${data.nextFixture.homeAway === 'home' ? 'vs' : '@'} ${data.nextFixture.opponent}`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(data.nextFixture.date)}
                  {data.nextFixture.kickOffTime && ` · ${data.nextFixture.kickOffTime}`}
                </p>
                <Badge variant="secondary" className="mt-2">
                  {data.nextFixture.daysUntil === 0 ? 'Today' : data.nextFixture.daysUntil === 1 ? 'Tomorrow' : `${data.nextFixture.daysUntil} days away`}
                </Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming fixtures scheduled.</p>
            )}
          </CardContent>
        </Card>

        {/* Availability */}
        <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => navigate('/availability')}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Availability</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.nextFixture ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{data.availability.available}</p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{data.availability.unavailable}</p>
                    <p className="text-xs text-muted-foreground">Unavailable</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-400">{data.availability.unknown}</p>
                    <p className="text-xs text-muted-foreground">Unknown</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {data.availability.available}/{data.availability.total} confirmed
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No fixture to track availability for.</p>
            )}
          </CardContent>
        </Card>

        {/* Squad */}
        <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => navigate('/players')}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Squad</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.squad.activeCount}</p>
            <p className="text-sm text-muted-foreground">
              active players · {data.squad.gkVolunteers} GK volunteer{data.squad.gkVolunteers !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {/* Season stats */}
        <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => navigate('/stats')}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Season</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.seasonStats.played > 0 ? (
              <>
                <p className="text-lg font-bold">
                  W{data.seasonStats.won} D{data.seasonStats.drawn} L{data.seasonStats.lost}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.seasonStats.goalsFor}-{data.seasonStats.goalsAgainst} ({data.seasonStats.played} played)
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No matches played yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/availability')}>Record Availability</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/team-selection')}>Select Team</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/match-day')}>Record Match</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/training')}>Plan Training</Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent results */}
      {data.recentResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentResults.map((r) => (
                <div key={r.fixtureId} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-xs text-muted-foreground">
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="flex-1 truncate">{r.opponent ?? 'Unknown'}</span>
                  <span className="font-bold">{r.goalsFor}-{r.goalsAgainst}</span>
                  <Badge
                    variant={r.result === 'win' ? 'success' : r.result === 'loss' ? 'destructive' : 'secondary'}
                    className="text-xs w-6 justify-center"
                  >
                    {r.result?.[0]?.toUpperCase() ?? '-'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Playing time balance */}
      {data.playingTimeBalance.length > 0 && data.playingTimeBalance.some((p) => p.outfieldMinutes > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Playing Time Balance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.playingTimeBalance.filter((p) => p.outfieldMinutes > 0).map((p) => {
                const maxMinutes = Math.max(...data.playingTimeBalance.map((x) => x.outfieldMinutes));
                const percentage = maxMinutes > 0 ? (p.outfieldMinutes / maxMinutes) * 100 : 0;
                return (
                  <div key={p.playerName} className="flex items-center gap-3">
                    <span className="text-xs w-28 truncate">{p.playerName}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{p.outfieldMinutes}m</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return dateStr;
  }
}
