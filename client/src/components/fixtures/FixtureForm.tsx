import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useCreateFixture, useUpdateFixture } from '@/hooks/use-fixtures';
import { api } from '@/lib/api';
import type { Fixture, CreateFixtureInput } from '@/services/fixture.service';

interface Season {
  id: string;
  clubId: string;
  name: string;
  startDate: string;
  endDate: string;
  format: string;
  matchDurationMinutes: number;
  periods: number;
  maxSquadSize: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SeasonsResponse {
  data: Season[];
}

interface FixtureFormProps {
  fixture?: Fixture; // If provided, we're editing
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Fixture add/edit form.
 * Adapts fields based on fixture type (match vs training).
 */
export function FixtureForm({ fixture, onClose, onSuccess }: FixtureFormProps) {
  const isEditing = !!fixture;
  const createFixture = useCreateFixture();
  const updateFixture = useUpdateFixture();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);

  const [formData, setFormData] = useState<CreateFixtureInput>({
    seasonId: fixture?.seasonId ?? '',
    type: fixture?.type ?? 'match',
    opponent: fixture?.opponent ?? undefined,
    location: fixture?.location ?? undefined,
    date: fixture?.date ?? '',
    kickOffTime: fixture?.kickOffTime ?? undefined,
    homeAway: fixture?.homeAway ?? undefined,
    matchObjective: fixture?.matchObjective ?? undefined,
    notes: fixture?.notes ?? undefined,
  });

  const [error, setError] = useState<string | null>(null);

  // Fetch available seasons on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchSeasons() {
      try {
        const response = await api.get<SeasonsResponse>('/seasons');
        if (!cancelled) {
          setSeasons(response.data);
          // Default to first active season if not editing
          if (!fixture?.seasonId && response.data.length > 0) {
            const activeSeason = response.data.find(s => s.isActive) || response.data[0];
            setFormData(prev => ({ ...prev, seasonId: activeSeason.id }));
          }
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load seasons.');
        }
      } finally {
        if (!cancelled) {
          setSeasonsLoading(false);
        }
      }
    }
    fetchSeasons();
    return () => { cancelled = true; };
  }, [fixture?.seasonId]);

  const isMatchType = formData.type === 'match' || formData.type === 'friendly' || formData.type === 'tournament';

  const handleChange = (field: keyof CreateFixtureInput, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.date) {
      setError('Date is required.');
      return;
    }

    if (isMatchType && !formData.opponent) {
      setError('Opponent is required for matches and friendlies.');
      return;
    }

    if (!formData.seasonId) {
      setError('No season available. Please create a season first.');
      return;
    }

    try {
      if (isEditing && fixture) {
        const { seasonId, ...updateData } = formData;
        await updateFixture.mutateAsync({ id: fixture.id, data: updateData });
      } else {
        // Clean undefined values
        const cleanData = Object.fromEntries(
          Object.entries(formData).filter(([_, v]) => v !== undefined && v !== '')
        ) as CreateFixtureInput;
        await createFixture.mutateAsync(cleanData);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save fixture.');
    }
  };

  const isPending = createFixture.isPending || updateFixture.isPending;
  const noSeasons = !seasonsLoading && seasons.length === 0;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">
          {isEditing ? 'Edit Fixture' : 'Add Fixture'}
        </h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-accent"
          aria-label="Close form"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* No seasons warning */}
      {noSeasons && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          No seasons available. Please set up a season before adding fixtures.
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type & Date row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select
              id="type"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
            >
              <option value="match">Match</option>
              <option value="training">Training</option>
              <option value="friendly">Friendly</option>
              <option value="tournament">Tournament</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kickOffTime">Time</Label>
            <Input
              id="kickOffTime"
              type="time"
              value={formData.kickOffTime ?? ''}
              onChange={(e) => handleChange('kickOffTime', e.target.value || undefined)}
            />
          </div>
        </div>

        {/* Match-specific fields */}
        {isMatchType && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="opponent">Opponent *</Label>
              <Input
                id="opponent"
                value={formData.opponent ?? ''}
                onChange={(e) => handleChange('opponent', e.target.value || undefined)}
                placeholder="e.g. Valley United"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homeAway">Home / Away</Label>
              <Select
                id="homeAway"
                value={formData.homeAway ?? ''}
                onChange={(e) => handleChange('homeAway', e.target.value || undefined)}
              >
                <option value="">Not specified</option>
                <option value="home">Home</option>
                <option value="away">Away</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="matchObjective">Match Objective</Label>
              <Select
                id="matchObjective"
                value={formData.matchObjective ?? ''}
                onChange={(e) => handleChange('matchObjective', e.target.value || undefined)}
              >
                <option value="">Not set</option>
                <option value="development">Development</option>
                <option value="balanced">Balanced</option>
                <option value="competitive">Competitive</option>
              </Select>
            </div>
          </div>
        )}

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location ?? ''}
            onChange={(e) => handleChange('location', e.target.value || undefined)}
            placeholder="e.g. Riverside Park, Pitch 3"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            value={formData.notes ?? ''}
            onChange={(e) => handleChange('notes', e.target.value || undefined)}
            placeholder="Any additional notes..."
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || noSeasons}>
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Fixture'}
          </Button>
        </div>
      </form>
    </div>
  );
}
