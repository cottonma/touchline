import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, UserX, UserCheck, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlayer, useDeactivatePlayer, useReactivatePlayer } from '@/hooks/use-players';
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

        {/* Stats placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Season Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Statistics will appear here once matches have been recorded.
            </p>
          </CardContent>
        </Card>

        {/* Development Goals placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Development Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Development goals will appear here once they have been assigned.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
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
