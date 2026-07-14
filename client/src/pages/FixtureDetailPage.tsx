import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Ban, Trash2, MapPin, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFixture, useCancelFixture, useDeleteFixture } from '@/hooks/use-fixtures';
import { FixtureForm } from '@/components/fixtures/FixtureForm';

const TYPE_LABELS: Record<string, string> = {
  match: 'Match',
  training: 'Training',
  friendly: 'Friendly',
  tournament: 'Tournament',
};

const OBJECTIVE_LABELS: Record<string, string> = {
  development: 'Development',
  balanced: 'Balanced',
  competitive: 'Competitive',
};

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  scheduled: 'secondary',
  completed: 'success',
  cancelled: 'outline',
};

/**
 * Fixture detail page - shows full fixture info, links to availability, team selection, match day.
 */
export function FixtureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: fixture, isLoading, error } = useFixture(id);
  const cancelFixture = useCancelFixture();
  const deleteFixture = useDeleteFixture();
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading fixture...</div>
      </div>
    );
  }

  if (error || !fixture) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/fixtures')}>
          <ArrowLeft className="h-4 w-4" /> Back to Fixtures
        </Button>
        <div className="flex items-center justify-center py-12">
          <div className="text-destructive">Fixture not found.</div>
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
        <FixtureForm
          fixture={fixture}
          onClose={() => setIsEditing(false)}
          onSuccess={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const handleCancel = async () => {
    await cancelFixture.mutateAsync(fixture.id);
    setShowConfirmCancel(false);
  };

  const handleDelete = async () => {
    await deleteFixture.mutateAsync(fixture.id);
    navigate('/fixtures');
  };

  const isMatch = fixture.type === 'match' || fixture.type === 'friendly' || fixture.type === 'tournament';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/fixtures')}>
        <ArrowLeft className="h-4 w-4" /> Back to Fixtures
      </Button>

      {/* Fixture header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={STATUS_COLORS[fixture.status] ?? 'secondary'}>
              {fixture.status.charAt(0).toUpperCase() + fixture.status.slice(1)}
            </Badge>
            <Badge variant="secondary">
              {TYPE_LABELS[fixture.type]}
            </Badge>
          </div>
          <h2 className="text-2xl font-bold">
            {fixture.type === 'training'
              ? 'Training Session'
              : `${fixture.homeAway === 'home' ? 'vs' : '@'} ${fixture.opponent}`}
          </h2>
          <p className="text-muted-foreground mt-1">
            {formatFullDate(fixture.date)}
            {fixture.kickOffTime && ` at ${fixture.kickOffTime}`}
          </p>
        </div>

        {fixture.status === 'scheduled' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmCancel(true)}
              className="text-destructive hover:text-destructive"
            >
              <Ban className="h-4 w-4" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        )}
      </div>

      {/* Cancel confirmation */}
      {showConfirmCancel && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm font-medium">Cancel this fixture?</p>
          <p className="text-sm text-muted-foreground mt-1">
            This will mark the fixture as cancelled. You can reschedule it later.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="destructive" onClick={handleCancel} disabled={cancelFixture.isPending}>
              {cancelFixture.isPending ? 'Cancelling...' : 'Yes, cancel it'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirmCancel(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showConfirmDelete && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm font-medium">Delete this fixture permanently?</p>
          <p className="text-sm text-muted-foreground mt-1">
            This cannot be undone. All related data will be lost.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteFixture.isPending}>
              {deleteFixture.isPending ? 'Deleting...' : 'Yes, delete'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Fixture details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fixture.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{fixture.location}</span>
              </div>
            )}
            {fixture.kickOffTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{fixture.kickOffTime}</span>
              </div>
            )}
            {fixture.matchObjective && (
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Objective: {OBJECTIVE_LABELS[fixture.matchObjective]}</span>
              </div>
            )}
            {isMatch && fixture.homeAway && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Venue:</span>
                <span className="capitalize">{fixture.homeAway}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        {fixture.status === 'scheduled' && isMatch && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Week Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/availability')}
              >
                Record Availability
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/team-selection')}
              >
                Select Team
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/match-day')}
              >
                Record Match
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {fixture.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{fixture.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete option for scheduled fixtures */}
      {fixture.status !== 'completed' && (
        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete fixture permanently
          </Button>
        </div>
      )}
    </div>
  );
}

function formatFullDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
