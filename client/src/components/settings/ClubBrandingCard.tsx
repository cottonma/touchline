import { useState, useEffect, useRef } from 'react';
import { Palette, Upload, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

/**
 * Club Branding — upload a crest and pick a primary colour. These are used on
 * the shareable Player Cards. Crest is stored as a data URL on the club so the
 * card image download works without any external hosting.
 */
export function ClubBrandingCard() {
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState('');
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null);
  const [colour, setColour] = useState('#2323b5');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const active = localStorage.getItem('touchline_active_club');
    const load = (c: any) => {
      if (!c) return;
      setClubId(c.id);
      setClubName(c.name || '');
      setBadgeUrl(c.badgeUrl ?? null);
      if (c.kitColourHome) setColour(c.kitColourHome);
    };
    if (active) {
      api.get<{ data: any }>(`/clubs/${active}`).then((res) => load(res.data)).catch(() => {});
    } else {
      // Fall back to the admin clubs list if no active club is set
      api.get<any[]>('/auth/clubs').then((clubs) => load(clubs[0])).catch(() => {});
    }
  }, []);

  const onPickFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    // Downscale to keep the stored data URL small (max ~256px, PNG)
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        // PNG preserves transparency for crests. This is comfortably under the limit at 200px.
        let dataUrl = canvas.toDataURL('image/png');
        // Safety: if somehow still very large, fall back to a JPEG (white bg) to shrink further.
        if (dataUrl.length > 900_000) {
          const jpg = document.createElement('canvas');
          jpg.width = w; jpg.height = h;
          const jctx = jpg.getContext('2d');
          if (jctx) {
            jctx.fillStyle = '#ffffff';
            jctx.fillRect(0, 0, w, h);
            jctx.drawImage(img, 0, 0, w, h);
            dataUrl = jpg.toDataURL('image/jpeg', 0.85);
          }
        }
        setBadgeUrl(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!clubId) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/clubs/${clubId}`, { badgeUrl, kitColourHome: colour });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Club Branding</CardTitle>
        </div>
        <CardDescription>Your crest and colour appear on the shareable Player Cards</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Crest */}
        <div className="space-y-2">
          <Label>Club crest</Label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden">
              {badgeUrl ? (
                <img src={badgeUrl} alt="Club crest" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-[10px] text-muted-foreground text-center px-1">No crest</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> {badgeUrl ? 'Replace crest' : 'Upload crest'}
              </Button>
              {badgeUrl && (
                <button className="text-xs text-muted-foreground text-left" onClick={() => setBadgeUrl(null)}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">A PNG with a transparent background looks best. Large images are scaled down automatically.</p>
        </div>

        {/* Colour */}
        <div className="space-y-2">
          <Label>Primary colour</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-10 w-14 rounded border cursor-pointer bg-transparent"
            />
            <span className="text-sm font-mono">{colour}</span>
            <div className="flex-1 h-8 rounded-md" style={{ background: `linear-gradient(90deg, ${colour}, ${colour}dd)` }} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={save} disabled={saving || !clubId}>
          {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? 'Saving...' : 'Save branding'}
        </Button>
        {clubName && <p className="text-xs text-muted-foreground">Branding for {clubName}</p>}
      </CardContent>
    </Card>
  );
}
