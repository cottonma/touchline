import { useState, useEffect, useCallback } from 'react';
import { Volleyball } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PitchPreview } from './PitchPreview';
import { api } from '@/lib/api';

/**
 * Format defaults: match duration, periods, and max squad size
 */
const FORMAT_DEFAULTS: Record<string, { matchDurationMinutes: number; periods: number; maxSquadSize: number }> = {
  '5v5': { matchDurationMinutes: 40, periods: 4, maxSquadSize: 8 },
  '7v7': { matchDurationMinutes: 48, periods: 4, maxSquadSize: 12 },
  '9v9': { matchDurationMinutes: 60, periods: 2, maxSquadSize: 14 },
  '11v11': { matchDurationMinutes: 70, periods: 2, maxSquadSize: 16 },
};

/**
 * Formation presets by format
 */
const FORMATION_PRESETS: Record<string, string[]> = {
  '5v5': ['1-2-1', '2-1-1', '1-1-2', '2-2'],
  '7v7': ['1-2-3', '2-3-1', '1-3-2', '2-2-2', '3-2-1'],
  '9v9': ['2-3-3', '3-2-3', '2-4-2', '3-3-2'],
  '11v11': ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'],
};

/**
 * Outfield player count per format
 */
const OUTFIELD_COUNT: Record<string, number> = {
  '5v5': 4,
  '7v7': 6,
  '9v9': 8,
  '11v11': 10,
};

interface Season {
  id: string;
  clubId: string;
  format: string;
  matchDurationMinutes: number;
  periods: number;
  maxSquadSize: number;
  formation: string | null;
}

export function TeamSetupCard() {
  const [season, setSeason] = useState<Season | null>(null);
  const [allSeasons, setAllSeasons] = useState<(Season & { isActive: boolean; name?: string })[]>([]);
  const [clubId, setClubId] = useState('');
  const [clubName, setClubName] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [format, setFormat] = useState('7v7');
  const [matchDuration, setMatchDuration] = useState(48);
  const [periods, setPeriods] = useState(4);
  const [maxSquadSize, setMaxSquadSize] = useState(12);
  const [formation, setFormation] = useState('');
  const [customFormation, setCustomFormation] = useState('');
  const [saved, setSaved] = useState(false);
  const [formationError, setFormationError] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);

  // Fetch active season on mount
  useEffect(() => {
    api.get<{ data: (Season & { isActive: boolean; name?: string })[] }>('/seasons').then(res => {
      setAllSeasons(res.data);
      const active = res.data.find(s => s.isActive);
      if (active) {
        loadSeason(active);
        // Fetch club name
        if (active.clubId) {
          api.get<any[]>('/auth/clubs').then(clubs => {
            const club = clubs.find((c: any) => c.id === active.clubId);
            if (club) setClubName(club.name || '');
          }).catch(() => {});
        }
      }
    });
  }, []);

  const loadSeason = (s: Season & { isActive?: boolean; name?: string }) => {
    setSeason(s);
    setClubId(s.clubId || '');
    setFormat(s.format);
    setMatchDuration(s.matchDurationMinutes);
    setPeriods(s.periods);
    setMaxSquadSize(s.maxSquadSize);
    setFormation(s.formation || '');
    setCustomFormation(s.formation || '');
    setSeasonName((s as any).name || '');
  };

  // Save club name
  const saveClubName = useCallback(async () => {
    if (!clubId || !clubName.trim()) return;
    try {
      await api.patch(`/clubs/${clubId}`, { name: clubName.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }, [clubId, clubName]);

  // Auto-save function
  const autoSave = useCallback(async (updates: Partial<Season>) => {
    if (!season) return;
    try {
      const res = await api.patch<{ data: Season }>(`/seasons/${season.id}`, updates);
      setSeason(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently fail for now
    }
  }, [season]);

  // Save season name
  const saveSeasonName = useCallback(async () => {
    if (!season || !seasonName.trim()) return;
    await autoSave({ name: seasonName.trim() } as any);
  }, [season, seasonName, autoSave]);

  // Create a new season
  const handleNewSeason = async () => {
    setCreatingNew(true);
    try {
      const defaults = FORMAT_DEFAULTS[format];
      const res = await api.post<{ data: Season & { name?: string } }>('/seasons', {
        format,
        matchDurationMinutes: defaults.matchDurationMinutes,
        periods: defaults.periods,
        maxSquadSize: defaults.maxSquadSize,
        formation: null,
      });
      loadSeason(res.data);
      // Refresh season list
      const seasonsRes = await api.get<{ data: (Season & { isActive: boolean; name?: string })[] }>('/seasons');
      setAllSeasons(seasonsRes.data);
    } catch {
      // ignore
    } finally {
      setCreatingNew(false);
    }
  };

  // Handle format change
  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat);
    const defaults = FORMAT_DEFAULTS[newFormat];
    if (defaults) {
      setMatchDuration(defaults.matchDurationMinutes);
      setPeriods(defaults.periods);
      setMaxSquadSize(defaults.maxSquadSize);
      // Clear formation since presets changed
      setFormation('');
      setCustomFormation('');
      setFormationError('');
      autoSave({
        format: newFormat,
        matchDurationMinutes: defaults.matchDurationMinutes,
        periods: defaults.periods,
        maxSquadSize: defaults.maxSquadSize,
        formation: null,
      });
    }
  };

  // Handle duration change
  const handleDurationChange = (value: number) => {
    setMatchDuration(value);
    autoSave({ matchDurationMinutes: value });
  };

  // Handle periods change
  const handlePeriodsChange = (value: number) => {
    setPeriods(value);
    autoSave({ periods: value });
  };

  // Validate formation
  const validateFormation = (f: string): boolean => {
    if (!f) return true;
    const parts = f.split('-').map(Number);
    if (parts.some(n => isNaN(n) || n < 1)) return false;
    const sum = parts.reduce((a, b) => a + b, 0);
    const expected = OUTFIELD_COUNT[format];
    if (expected && sum !== expected) {
      setFormationError(`Numbers must sum to ${expected} (outfield players for ${format})`);
      return false;
    }
    setFormationError('');
    return true;
  };

  // Handle preset formation click
  const handlePresetClick = (preset: string) => {
    setFormation(preset);
    setCustomFormation(preset);
    setFormationError('');
    autoSave({ formation: preset });
  };

  // Handle custom formation input
  const handleCustomFormationChange = (value: string) => {
    setCustomFormation(value);
    // Only validate and save if it looks complete (contains numbers and dashes)
    if (value && /^[\d]+([-][\d]+)*$/.test(value)) {
      if (validateFormation(value)) {
        setFormation(value);
        autoSave({ formation: value });
      }
    } else if (!value) {
      setFormation('');
      setFormationError('');
      autoSave({ formation: null });
    }
  };

  const presets = FORMATION_PRESETS[format] || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Volleyball className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Team Setup</CardTitle>
          {saved && (
            <span className="ml-auto text-xs text-green-600 font-medium animate-in fade-in">
              Saved ✓
            </span>
          )}
        </div>
        <CardDescription>
          Define how your team plays — format, match structure, and formation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Season selector + New Season */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Current Season</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSeason}
              disabled={creatingNew}
            >
              {creatingNew ? 'Creating...' : '+ New Season'}
            </Button>
          </div>
          <Input
            value={seasonName}
            onChange={(e) => setSeasonName(e.target.value)}
            onBlur={saveSeasonName}
            placeholder="e.g. 2026/2027 Season"
          />
          <p className="text-xs text-muted-foreground">
            Name this season. New fixtures will be linked to the active season.
          </p>
        </div>

        {/* Club/Team Name */}
        <div className="space-y-2">
          <Label>Team Name</Label>
          <Input
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            onBlur={() => { if (clubName.trim() && clubId) saveClubName(); }}
            placeholder="e.g. Leeds City Juniors Knights"
          />
          <p className="text-xs text-muted-foreground">The name shown throughout the app</p>
        </div>

        {/* Format Selector */}
        <div className="space-y-2">
          <Label>Match Format</Label>
          <Select
            value={format}
            onChange={(e) => handleFormatChange(e.target.value)}
          >
            <option value="5v5">5v5</option>
            <option value="7v7">7v7</option>
            <option value="9v9">9v9</option>
            <option value="11v11">11v11</option>
          </Select>
        </div>

        {/* Duration & Periods */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Match Duration (min)</Label>
            <Input
              type="number"
              min={10}
              max={120}
              value={matchDuration}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Periods (halves/quarters)</Label>
            <Input
              type="number"
              min={1}
              max={6}
              value={periods}
              onChange={(e) => handlePeriodsChange(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Squad Size</Label>
            <Input
              type="number"
              min={5}
              max={30}
              value={maxSquadSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaxSquadSize(v);
                autoSave({ maxSquadSize: v });
              }}
            />
          </div>
        </div>

        {/* Formation Selector */}
        <div className="space-y-3">
          <Label>Formation</Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  formation === preset
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-input hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <Input
              placeholder={`Custom formation (e.g. ${format === '5v5' ? '1-2-1' : '2-3-1'})`}
              value={customFormation}
              onChange={(e) => handleCustomFormationChange(e.target.value)}
            />
            {formationError && (
              <p className="text-xs text-red-500">{formationError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Numbers represent outfield lines (defence → attack). Must sum to {OUTFIELD_COUNT[format] || '?'}.
            </p>
          </div>
        </div>

        {/* Pitch Preview */}
        {formation && (
          <div className="space-y-2">
            <Label>Preview</Label>
            <PitchPreview formation={formation} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
