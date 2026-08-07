import { useState } from 'react';
import { Save, RotateCcw, Trash2, Star, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface PlanVersion {
  id: string;
  name: string;
  formation: string | null;
  generatedBy: string | null;
  isFinal: boolean;
  createdAt: string;
}

interface SavedPlansPanelProps {
  fixtureId: string;
  versions: PlanVersion[];
  onVersionsChange: () => void;
  onRestore: (versionId: string) => void;
  hasUnsavedChanges: boolean;
}

/**
 * Saved Plans Panel — list, save, restore, delete plan versions.
 */
export function SavedPlansPanel({ fixtureId, versions, onVersionsChange, onRestore, hasUnsavedChanges }: SavedPlansPanelProps) {
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await api.post(`/match-plans/${fixtureId}/versions`, { name: saveName.trim() });
      setSaveName('');
      setShowSaveForm(false);
      onVersionsChange();
    } catch {}
    setSaving(false);
  };

  const handleRestore = async (versionId: string) => {
    if (hasUnsavedChanges && confirmRestore !== versionId) {
      setConfirmRestore(versionId);
      return;
    }
    onRestore(versionId);
    setConfirmRestore(null);
  };

  const handleMarkFinal = async (versionId: string) => {
    try {
      await api.put(`/match-plans/${fixtureId}/versions/${versionId}/final`, {});
      onVersionsChange();
    } catch {}
  };

  const handleDelete = async (versionId: string) => {
    try {
      await api.delete(`/match-plans/${fixtureId}/versions/${versionId}`);
      onVersionsChange();
    } catch {}
  };

  return (
    <div className="space-y-3">
      {/* Save button */}
      {!showSaveForm ? (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowSaveForm(true)}>
          <Save className="h-3.5 w-3.5" /> Save Version
        </Button>
      ) : (
        <div className="flex gap-2">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="e.g. Friday Evening Draft"
            className="text-xs h-8"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving || !saveName.trim()}>
            {saving ? '...' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowSaveForm(false)}>
            ✕
          </Button>
        </div>
      )}

      {/* Versions list */}
      {versions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No saved versions yet.</p>
      ) : (
        <div className="space-y-2">
          {versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(version => (
            <div key={version.id} className="border rounded-md p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {version.isFinal && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                  <span className="text-xs font-medium">{version.name}</span>
                </div>
                {version.isFinal && <Badge variant="success" className="text-[9px]">Final</Badge>}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(version.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {version.generatedBy && <Badge variant="secondary" className="text-[9px]">{version.generatedBy}</Badge>}
              </div>

              {/* Confirm restore warning */}
              {confirmRestore === version.id && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                  <p className="font-medium">You have unsaved changes.</p>
                  <div className="flex gap-2 mt-1.5">
                    <Button size="sm" className="h-6 text-[10px]" onClick={() => { handleSave(); handleRestore(version.id); }}>
                      Save & Restore
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setConfirmRestore(null); onRestore(version.id); }}>
                      Restore Without Saving
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setConfirmRestore(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {confirmRestore !== version.id && (
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleRestore(version.id)}>
                    <RotateCcw className="h-3 w-3" /> Restore
                  </Button>
                  {!version.isFinal && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleMarkFinal(version.id)}>
                      <Star className="h-3 w-3" /> Final
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500 hover:text-red-700" onClick={() => handleDelete(version.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
