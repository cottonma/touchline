import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, UserX, UserCheck, Shirt, ClipboardCheck, Trophy, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlayer, useDeactivatePlayer, useReactivatePlayer, usePlayerStats } from '@/hooks/use-players';
import { usePlayerDevelopment, useCreateGoal, useUpdateGoalStatus } from '@/hooks/use-development';
import { PlayerForm } from '@/components/players/PlayerForm';

const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeeper',
  CB: 'Centre Back',
  LB: 'Left Back',
  RB: 'Right Back',
  CM: 'Central Midfield',
  LM: 'Left Midfield',
  RM: 'Right Midfield',
  CF: 'Centre Forward',
};

const FOOT_LABELS: Record<string, string> = {
  left: 'Left',
  right: 'Right',
  both: 'Both',
};

/**
 * Player detail/profile page.
 * Shows full player info, stats summary, development goals, playing time history.
 * Hub for everything about a single player.
 */
export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: player, isLoading, error } = usePlayer(id);
  const { data: devGoals } = usePlayerDevelopment(id);
  const { data: stats } = usePlayerStats(id);
  const deactivate = useDeactivatePlayer();
  const reactivate = useReactivatePlayer();
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDeactivate, setShowConfirmDeactivate] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading player...</div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/players')}>
          <ArrowLeft className="h-4 w-4" /> Back to Squad
        </Button>
        <div className="flex items-center justify-center py-12">
          <div className="text-destructive">Player not found.</div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setIsEditing(false)}>
          <ArrowLeft className="h-4 w-4" /> Cancel Edit
        </Button>
        <PlayerForm
          player={player}
          onClose={() => setIsEditing(false)}
          onSuccess={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const handleDeactivate = async () => {
    await deactivate.mutateAsync(player.id);
    setShowConfirmDeactivate(false);
    navigate('/players');
  };

  const handleReactivate = async () => {
    await reactivate.mutateAsync(player.id);
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/players')}>
        <ArrowLeft className="h-4 w-4" /> Back to Squad
      </Button>

      {/* Player header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {player.shirtNumber ?? <Shirt className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">
                {player.firstName} {player.lastName}
              </h2>
              {!player.isActive && <Badge variant="outline">Inactive</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default">
                {POSITION_LABELS[player.primaryPosition] ?? player.primaryPosition}
              </Badge>
              {player.secondaryPosition && (
                <Badge variant="secondary">
                  {POSITION_LABELS[player.secondaryPosition]}
                </Badge>
              )}
              {player.isGkVolunteer && <Badge variant="warning">GK Volunteer</Badge>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          {player.isActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmDeactivate(true)}
              className="text-destructive hover:text-destructive"
            >
              <UserX className="h-4 w-4" />
              <span className="hidden sm:inline">Deactivate</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReactivate}
              disabled={reactivate.isPending}
            >
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Reactivate</span>
            </Button>
          )}
        </div>
      </div>

      {/* Deactivation confirmation */}
      {showConfirmDeactivate && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm font-medium">
            Deactivate {player.firstName} {player.lastName}?
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            This will remove them from the active squad. All historical data will be preserved.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="destructive" onClick={handleDeactivate} disabled={deactivate.isPending}>
              {deactivate.isPending ? 'Deactivating...' : 'Yes, deactivate'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirmDeactivate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Player details grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Player Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Preferred Foot" value={player.preferredFoot ? FOOT_LABELS[player.preferredFoot] : 'Not specified'} />
            <DetailRow label="Date of Birth" value={player.dateOfBirth ? formatDate(player.dateOfBirth) : 'Not specified'} />
            <DetailRow label="Shirt Number" value={player.shirtNumber?.toString() ?? 'Not assigned'} />
          </CardContent>
        </Card>

        {/* Parent/Guardian */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parent / Guardian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Name" value={player.parentName ?? 'Not provided'} />
            <DetailRow label="Phone" value={player.parentPhone ?? 'Not provided'} />
            <DetailRow label="Email" value={player.parentEmail ?? 'Not provided'} />
          </CardContent>
        </Card>

        {/* Medical */}
        {player.medicalNotes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Medical Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{player.medicalNotes}</p>
            </CardContent>
          </Card>
        )}

        {/* Season Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Season Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats ? (
              <>
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Training: {stats.trainingSessionsAttended}/{stats.totalTrainingSessions} sessions attended
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Matches: {stats.matchesPlayed} played
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Outfield: {stats.totalOutfieldMinutes} min | GK: {stats.totalGkMinutes} min
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Statistics will appear here once matches have been recorded.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Development Goals */}
        <DevelopmentGoalsCard playerId={player.id} devGoals={devGoals} />
      </div>
    </div>
  );
}

function DevelopmentGoalsCard({ playerId, devGoals }: { playerId: string; devGoals: { goals: { id: string; title: string; category: string; status: string; description?: string | null }[]; observations: unknown[] } | undefined }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('technical');
  const createGoal = useCreateGoal();
  const updateStatus = useUpdateGoalStatus();

  const handleAddGoal = async () => {
    if (!newTitle.trim()) return;
    await createGoal.mutateAsync({
      playerId,
      data: { category: newCategory, positionGroup: 'all', title: newTitle.trim() },
    });
    setNewTitle('');
    setShowAddForm(false);
  };

  const handleStatusChange = (goalId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'working_on_it' ? 'improving' : currentStatus === 'improving' ? 'achieved' : 'working_on_it';
    updateStatus.mutate({ goalId, status: nextStatus });
  };

  const STATUS_LABELS: Record<string, string> = {
    working_on_it: 'Learning',
    improving: 'Growing',
    achieved: 'Got it!',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Development Goals</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Goal'}
        </Button>
      </CardHeader>
      <CardContent>
        {/* Add goal form */}
        {showAddForm && (
          <div className="mb-4 space-y-2 rounded-md border p-3 bg-muted/30">
            <input
              type="text"
              placeholder="Goal title (e.g. Improve first touch)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="technical">Technical</option>
                <option value="tactical">Tactical</option>
                <option value="physical">Physical</option>
                <option value="psychological">Psychological</option>
              </select>
              <Button size="sm" onClick={handleAddGoal} disabled={createGoal.isPending || !newTitle.trim()}>
                {createGoal.isPending ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        )}

        {/* Goals list */}
        {devGoals && devGoals.goals && devGoals.goals.length > 0 ? (
          <div className="space-y-3">
            {devGoals.goals.map((goal) => (
              <div key={goal.id} className="flex items-start gap-3 border-b last:border-0 pb-2 last:pb-0">
                <button
                  onClick={() => handleStatusChange(goal.id, goal.status)}
                  className="mt-0.5 shrink-0"
                  title={`Click to change status (currently: ${STATUS_LABELS[goal.status]})`}
                >
                  <Badge
                    variant={goal.status === 'achieved' ? 'success' : goal.status === 'improving' ? 'warning' : 'secondary'}
                    className="text-[10px] cursor-pointer hover:opacity-80"
                  >
                    {goal.status === 'achieved' ? '✓' : goal.status === 'improving' ? '↑' : '•'}
                  </Badge>
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${goal.status === 'achieved' ? 'line-through text-muted-foreground' : ''}`}>{goal.title}</p>
                  {goal.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="capitalize">{goal.category}</span> · {STATUS_LABELS[goal.status]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No development goals yet. Click "Add Goal" to create one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
