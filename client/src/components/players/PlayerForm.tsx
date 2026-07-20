import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useCreatePlayer, useUpdatePlayer } from '@/hooks/use-players';
import type { Player, CreatePlayerInput } from '@/services/player.service';

interface PlayerFormProps {
  player?: Player; // If provided, we're editing
  onClose: () => void;
  onSuccess: () => void;
}

const POSITIONS = [
  { value: 'GK', label: 'Goalkeeper (GK)' },
  { value: 'CB', label: 'Centre Back (CB)' },
  { value: 'LB', label: 'Left Back (LB)' },
  { value: 'RB', label: 'Right Back (RB)' },
  { value: 'CM', label: 'Central Midfield (CM)' },
  { value: 'LM', label: 'Left Midfield (LM)' },
  { value: 'RM', label: 'Right Midfield (RM)' },
  { value: 'CF', label: 'Centre Forward (CF)' },
];

/**
 * Player add/edit form.
 * Appears as a card overlay on the squad page.
 */
export function PlayerForm({ player, onClose, onSuccess }: PlayerFormProps) {
  const isEditing = !!player;
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();

  const [formData, setFormData] = useState<CreatePlayerInput>({
    firstName: player?.firstName ?? '',
    lastName: player?.lastName ?? '',
    shirtNumber: player?.shirtNumber ?? undefined,
    dateOfBirth: player?.dateOfBirth ?? undefined,
    preferredFoot: player?.preferredFoot ?? undefined,
    primaryPosition: player?.primaryPosition ?? 'CB',
    secondaryPosition: player?.secondaryPosition ?? undefined,
    tertiaryPosition: player?.tertiaryPosition ?? undefined,
    isGkVolunteer: player?.isGkVolunteer ?? false,
    parentName: player?.parentName ?? undefined,
    parentEmail: player?.parentEmail ?? undefined,
    parentPhone: player?.parentPhone ?? undefined,
    medicalNotes: player?.medicalNotes ?? undefined,
  });

  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof CreatePlayerInput, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic client-side validation
    if (!formData.firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required.');
      return;
    }

    try {
      if (isEditing && player) {
        // For updates, explicitly send all fields with null for empty optionals.
        // This ensures JSON.stringify includes them (undefined gets stripped).
        const updateData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          primaryPosition: formData.primaryPosition,
          secondaryPosition: formData.secondaryPosition || null,
          tertiaryPosition: formData.tertiaryPosition || null,
          isGkVolunteer: formData.isGkVolunteer ?? false,
          shirtNumber: formData.shirtNumber ?? null,
          dateOfBirth: formData.dateOfBirth || null,
          preferredFoot: formData.preferredFoot || null,
          parentName: formData.parentName || null,
          parentEmail: formData.parentEmail || null,
          parentPhone: formData.parentPhone || null,
          medicalNotes: formData.medicalNotes || null,
        };
        await updatePlayer.mutateAsync({ id: player.id, data: updateData });
      } else {
        // Clean up undefined/empty values before sending
        const cleanData = Object.fromEntries(
          Object.entries(formData).filter(([_, v]) => v !== undefined && v !== '')
        ) as CreatePlayerInput;
        await createPlayer.mutateAsync(cleanData);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save player.');
    }
  };

  const isPending = createPlayer.isPending || updatePlayer.isPending;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">
          {isEditing ? 'Edit Player' : 'Add Player'}
        </h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-accent"
          aria-label="Close form"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="e.g. Marcus"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="e.g. Smith"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="shirtNumber">Shirt Number</Label>
            <Input
              id="shirtNumber"
              type="number"
              min={1}
              max={99}
              value={formData.shirtNumber ?? ''}
              onChange={(e) => handleChange('shirtNumber', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 7"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth ?? ''}
              onChange={(e) => handleChange('dateOfBirth', e.target.value || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredFoot">Preferred Foot</Label>
            <Select
              id="preferredFoot"
              value={formData.preferredFoot ?? ''}
              onChange={(e) => handleChange('preferredFoot', e.target.value || undefined)}
            >
              <option value="">Not specified</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="both">Both</option>
            </Select>
          </div>
        </div>

        {/* Position */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="primaryPosition">Primary Position *</Label>
            <Select
              id="primaryPosition"
              value={formData.primaryPosition}
              onChange={(e) => handleChange('primaryPosition', e.target.value)}
              required
            >
              {POSITIONS.map((pos) => (
                <option key={pos.value} value={pos.value}>{pos.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryPosition">Secondary Position</Label>
            <Select
              id="secondaryPosition"
              value={formData.secondaryPosition ?? ''}
              onChange={(e) => handleChange('secondaryPosition', e.target.value || undefined)}
            >
              <option value="">None</option>
              {POSITIONS.filter((p) => p.value !== formData.primaryPosition).map((pos) => (
                <option key={pos.value} value={pos.value}>{pos.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tertiaryPosition">Tertiary Position</Label>
            <Select
              id="tertiaryPosition"
              value={formData.tertiaryPosition ?? ''}
              onChange={(e) => handleChange('tertiaryPosition', e.target.value || undefined)}
            >
              <option value="">None</option>
              {POSITIONS.filter((p) => p.value !== formData.primaryPosition && p.value !== formData.secondaryPosition).map((pos) => (
                <option key={pos.value} value={pos.value}>{pos.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="isGkVolunteer">GK Volunteer</Label>
            <div className="flex items-center h-10">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isGkVolunteer}
                  onChange={(e) => handleChange('isGkVolunteer', e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Happy to play in goal</span>
              </label>
            </div>
          </div>
        </div>

        {/* Parent/Guardian */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Parent / Guardian</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="parentName">Name</Label>
              <Input
                id="parentName"
                value={formData.parentName ?? ''}
                onChange={(e) => handleChange('parentName', e.target.value || undefined)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentPhone">Phone</Label>
              <Input
                id="parentPhone"
                type="tel"
                value={formData.parentPhone ?? ''}
                onChange={(e) => handleChange('parentPhone', e.target.value || undefined)}
                placeholder="e.g. 07700 900 123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentEmail">Email</Label>
              <Input
                id="parentEmail"
                type="email"
                value={formData.parentEmail ?? ''}
                onChange={(e) => handleChange('parentEmail', e.target.value || undefined)}
                placeholder="e.g. parent@email.com"
              />
            </div>
          </div>
        </div>

        {/* Medical Notes */}
        <div className="space-y-2">
          <Label htmlFor="medicalNotes">Medical Notes</Label>
          <textarea
            id="medicalNotes"
            value={formData.medicalNotes ?? ''}
            onChange={(e) => handleChange('medicalNotes', e.target.value || undefined)}
            placeholder="Any allergies, conditions or notes..."
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Player'}
          </Button>
        </div>
      </form>
    </div>
  );
}
