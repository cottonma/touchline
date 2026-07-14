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
  format: string;
  matchDurationMinutes: number;
  periods: number;
  maxSquadSize: number;
  formation: string | null;
}

export function TeamSetupCard() {
  const [season, setSeason] = useState<Season | null>(null);
  const [format, setFormat] = useState('7v7');
  const [matchDuration, setMatchDuration] = useState(48);
  const [periods, setPeriods] = useState(4);
  const [maxSquadSize, setMaxSquadSize] = useState(12);
  const [formation, setFormation] = useState('');
  const [customFormation, setCustomFormation] = useState('');
  const [saved, setSaved] = useState(false);
  const [formationError, setFormationError] = useState('');

  // Fetch active season on mount
  useEffect(() => {
    api.get<{ data: Season[] }>('/seasons').then(res => {
      const active = res.data.find((s: Season & { isActive: boolean }) => (s as Season & { isActive: boolean }).isActive);
      if (active) {
        setSeason(active);
        setFormat(active.format);
        setMatchDuration(active.matchDurationMinutes);
        setPeriods(active.periods);
        setMaxSquadSize(active.maxSquadSize);
        setFormation(active.formation || '');
        setCustomFormation(active.formation || '');
      }
    });
  }, []);

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
