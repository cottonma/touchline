import { useState } from 'react';
import { FileText, Printer, Clock, Users, Trophy, Shield, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePlayingTimeReport, useAttendanceReport, useSeasonResultsReport, useGkRotationReport, useDevelopmentReport } from '@/hooks/use-reports';

type ReportType = 'playing-time' | 'attendance' | 'season-results' | 'gk-rotation' | 'development';

const REPORT_OPTIONS: { type: ReportType; label: string; icon: typeof FileText; description: string }[] = [
  { type: 'playing-time', label: 'Playing Time', icon: Clock, description: 'Outfield and GK minutes per player' },
  { type: 'attendance', label: 'Attendance', icon: Users, description: 'Match and training attendance rates' },
  { type: 'season-results', label: 'Season Results', icon: Trophy, description: 'W/D/L record and match results' },
  { type: 'gk-rotation', label: 'GK Rotation', icon: Shield, description: 'Goalkeeper duty distribution' },
  { type: 'development', label: 'Development', icon: Target, description: 'Goal progress across the squad' },
];

/**
 * Reports page - select and view season reports. Print/PDF via browser print.
 */
export function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground">Generate season reports and player summaries.</p>
        </div>
        {selectedReport && (
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
        )}
      </div>

      {/* Report selector */}
      {!selectedReport ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setSelectedReport(opt.type)}
              className="flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
            >
              <opt.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-sm text-muted-foreground">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)}>
            ← Back to reports
          </Button>
          <ReportView type={selectedReport} />
        </>
      )}
    </div>
  );
}

function ReportView({ type }: { type: ReportType }) {
  switch (type) {
    case 'playing-time': return <PlayingTimeReportView />;
    case 'attendance': return <AttendanceReportView />;
    case 'season-results': return <SeasonResultsView />;
    case 'gk-rotation': return <GkRotationView />;
    case 'development': return <DevelopmentView />;
  }
}

function PlayingTimeReportView() {
  const { data, isLoading } = usePlayingTimeReport();
  if (isLoading || !data) return <Loading />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">Player</th>
              <th className="pb-2 text-right">Outfield</th>
              <th className="pb-2 text-right">GK</th>
              <th className="pb-2 text-right">Total</th>
              <th className="pb-2 text-right">Apps</th>
            </tr></thead>
            <tbody>
              {data.players.map((p) => (
                <tr key={p.name} className="border-b last:border-0">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2 text-right">{p.outfieldMinutes}m</td>
                  <td className="py-2 text-right">{p.gkMinutes > 0 ? `${p.gkMinutes}m` : '-'}</td>
                  <td className="py-2 text-right font-medium">{p.totalMinutes}m</td>
                  <td className="py-2 text-right">{p.appearances}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
          Total match minutes: {data.totals.totalMatchMinutes} · Average per player: {data.totals.averagePerPlayer}
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceReportView() {
  const { data, isLoading } = useAttendanceReport();
  if (isLoading || !data) return <Loading />;

  return (
    <Card>
      <CardHeader><CardTitle>{data.title}</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">Player</th>
              <th className="pb-2 text-center">Matches</th>
              <th className="pb-2 text-center">Match %</th>
              <th className="pb-2 text-center">Training</th>
              <th className="pb-2 text-center">Training %</th>
            </tr></thead>
            <tbody>
              {data.players.map((p) => (
                <tr key={p.name} className="border-b last:border-0">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2 text-center">{p.matchesPlayed}/{p.matchesAvailable}</td>
                  <td className="py-2 text-center">{p.matchAttendanceRate}%</td>
                  <td className="py-2 text-center">{p.trainingAttended}/{p.trainingSessions}</td>
                  <td className="py-2 text-center">{p.trainingAttendanceRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SeasonResultsView() {
  const { data, isLoading } = useSeasonResultsReport();
  if (isLoading || !data) return <Loading />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{data.title}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div><p className="text-2xl font-bold">{data.summary.played}</p><p className="text-xs text-muted-foreground">Played</p></div>
            <div><p className="text-2xl font-bold text-green-600">{data.summary.won}</p><p className="text-xs text-muted-foreground">Won</p></div>
            <div><p className="text-2xl font-bold">{data.summary.drawn}</p><p className="text-xs text-muted-foreground">Drawn</p></div>
            <div><p className="text-2xl font-bold text-red-600">{data.summary.lost}</p><p className="text-xs text-muted-foreground">Lost</p></div>
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center text-sm">
            <div><p className="font-bold">{data.summary.goalsFor}-{data.summary.goalsAgainst}</p><p className="text-xs text-muted-foreground">Goals</p></div>
            <div><p className="font-bold">{data.summary.cleanSheets}</p><p className="text-xs text-muted-foreground">Clean Sheets</p></div>
            <div><p className="font-bold">{data.summary.winPercentage}%</p><p className="text-xs text-muted-foreground">Win Rate</p></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Results</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-20 text-muted-foreground">{new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                <span className="flex-1">{r.opponent}</span>
                <span className="font-bold">{r.goalsFor}-{r.goalsAgainst}</span>
                <Badge variant={r.result === 'win' ? 'success' : r.result === 'loss' ? 'destructive' : 'secondary'} className="text-xs w-6 justify-center">
                  {r.result?.[0]?.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GkRotationView() {
  const { data, isLoading } = useGkRotationReport();
  if (isLoading || !data) return <Loading />;

  return (
    <Card>
      <CardHeader><CardTitle>{data.title}</CardTitle></CardHeader>
      <CardContent>
        {data.volunteers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No GK duty recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Volunteer</th>
                <th className="pb-2 text-right">Matches</th>
                <th className="pb-2 text-right">Periods</th>
                <th className="pb-2 text-right">Minutes</th>
              </tr></thead>
              <tbody>
                {data.volunteers.map((v) => (
                  <tr key={v.name} className="border-b last:border-0">
                    <td className="py-2 font-medium">{v.name}</td>
                    <td className="py-2 text-right">{v.matchesInGoal}</td>
                    <td className="py-2 text-right">{v.periodsInGoal}</td>
                    <td className="py-2 text-right">{v.totalGkMinutes}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DevelopmentView() {
  const { data, isLoading } = useDevelopmentReport();
  if (isLoading || !data) return <Loading />;

  return (
    <Card>
      <CardHeader><CardTitle>{data.title}</CardTitle></CardHeader>
      <CardContent>
        {data.players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No development goals assigned yet.</p>
        ) : (
          <div className="space-y-4">
            {data.players.map((p) => (
              <div key={p.name} className="border-b last:border-0 pb-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{p.name}</p>
                  <div className="flex gap-1">
                    {p.achieved > 0 && <Badge variant="success" className="text-xs">{p.achieved} achieved</Badge>}
                    {p.improving > 0 && <Badge variant="warning" className="text-xs">{p.improving} improving</Badge>}
                    {p.workingOnIt > 0 && <Badge variant="secondary" className="text-xs">{p.workingOnIt} active</Badge>}
                  </div>
                </div>
                <div className="mt-1 space-y-0.5">
                  {p.goals.map((g, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {g.title} ({g.status.replace('_', ' ')})</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Loading() {
  return <div className="text-muted-foreground py-8 text-center">Generating report...</div>;
}
