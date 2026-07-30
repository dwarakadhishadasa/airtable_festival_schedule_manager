
import React, { useState } from 'react';
import { useBase } from '@airtable/blocks/ui';
import { TabConfig, TableInfo } from '../types';
import { Settings, X, Image as ImageIcon, CheckCircle, AlertCircle, Upload, Loader2, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import TabConfigEditor from './TabConfigEditor';

interface SettingsPanelProps {
  isOpen: boolean;
  tabs: TabConfig[];
  onSaveTabs: (tabs: TabConfig[]) => Promise<void>;
  onSaveHeaderImage: (base64: string) => Promise<void>;
  headerImageBase64: string | null;
  onClose: () => void;
}

type EditorState =
  | { mode: 'list' }
  | { mode: 'edit'; tab: TabConfig }
  | { mode: 'new' };

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen, tabs, onSaveTabs, onSaveHeaderImage, headerImageBase64, onClose,
}) => {
  const base = useBase();
  const [editorState, setEditorState] = useState<EditorState>({ mode: 'list' });
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset to list view whenever the panel opens
  React.useEffect(() => {
    if (isOpen) setEditorState({ mode: 'list' });
  }, [isOpen]);

  if (!isOpen) return null;

  // Build TableInfo for TabConfigEditor (pure data, no SDK refs)
  const availableTables: TableInfo[] = base.tables.map(t => ({
    name: t.name,
    fields: t.fields.map(f => ({ name: f.name })),
    views: t.views.map(v => ({ name: v.name })),
  }));

  // ── Tab CRUD ──────────────────────────────────────────────────────────────

  const handleSaveTab = async (saved: TabConfig) => {
    const newTabs =
      editorState.mode === 'edit'
        ? tabs.map(t => (t.id === saved.id ? saved : t))
        : [...tabs, saved];
    setIsSaving(true);
    await onSaveTabs(newTabs);
    setIsSaving(false);
    setEditorState({ mode: 'list' });
  };

  const handleDeleteTab = async (tabId: string) => {
    await onSaveTabs(tabs.filter(t => t.id !== tabId));
  };

  const handleMoveTab = async (idx: number, dir: -1 | 1) => {
    const next = [...tabs];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    await onSaveTabs(next);
  };

  // ── Image upload ──────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsImageLoading(true);
    setImageError(null);
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const base64SizeKB = base64.length / 1024;
      if (base64SizeKB > 110) {
        setImageError(`Image too large (${Math.round(base64SizeKB)}kB encoded). Please compress to under 80kB and try again.`);
        setIsImageLoading(false);
        return;
      }
      await onSaveHeaderImage(base64);
      setIsImageLoading(false);
    };
    reader.onerror = () => setIsImageLoading(false);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-black text-slate-900">Settings</h2>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors group">
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-900" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Tab editor (add / edit) */}
          {editorState.mode !== 'list' && (
            <TabConfigEditor
              tab={editorState.mode === 'edit' ? editorState.tab : null}
              availableTables={availableTables}
              onSave={handleSaveTab}
              onCancel={() => setEditorState({ mode: 'list' })}
            />
          )}

          {/* Views list */}
          {editorState.mode === 'list' && (
            <div className="space-y-8">

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Views</h3>
                  <button
                    onClick={() => setEditorState({ mode: 'new' })}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add View
                  </button>
                </div>

                {tabs.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 text-sm font-medium">No views yet</p>
                    <button
                      onClick={() => setEditorState({ mode: 'new' })}
                      className="mt-3 text-xs font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide"
                    >
                      + Add your first view
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tabs.map((tab, idx) => (
                      <div key={tab.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                        <div className="flex flex-col gap-0.5 text-[8px]">
                          <button
                            onClick={() => handleMoveTab(idx, -1)}
                            disabled={idx === 0}
                            className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors leading-none"
                            title="Move up"
                          >▲</button>
                          <button
                            onClick={() => handleMoveTab(idx, 1)}
                            disabled={idx === tabs.length - 1}
                            className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors leading-none"
                            title="Move down"
                          >▼</button>
                        </div>
                        <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{tab.label}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {tab.viewType === 'grouped'
                              ? `Grouped Table · ${tab.groupedConfig?.tableName ?? '—'}${tab.groupedConfig?.viewName ? ` / ${tab.groupedConfig.viewName}` : ''}`
                              : `Linked Per Item · ${tab.linkedConfig?.primaryTableName ?? '—'}${tab.linkedConfig?.primaryViewName ? ` / ${tab.linkedConfig.primaryViewName}` : ''}`}
                          </p>
                        </div>
                        <button
                          onClick={() => setEditorState({ mode: 'edit', tab })}
                          className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTab(tab.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-all text-slate-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* PDF Header Image */}
              <section className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PDF Header Image</h3>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status</span>
                    {headerImageBase64 ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold uppercase tracking-wide">
                        <CheckCircle className="w-4 h-4" /> Saved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600 text-xs font-bold uppercase tracking-wide">
                        <AlertCircle className="w-4 h-4" /> Not Set
                      </span>
                    )}
                  </div>
                  <label className="flex flex-col items-center justify-center gap-2 bg-white border border-slate-200 py-3 rounded-xl hover:border-amber-500 cursor-pointer transition-all">
                    {isImageLoading
                      ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                      : <Upload className="w-5 h-5 text-slate-400" />}
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {isImageLoading ? 'Uploading...' : 'Upload Image'}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isImageLoading} />
                  </label>
                  {imageError && <p className="text-red-500 text-[10px] font-bold mt-2 text-center">{imageError}</p>}
                  <p className="text-[10px] text-slate-400 mt-3 text-center leading-relaxed">
                    Stored in Airtable GlobalConfig. Keep compressed image under 80kB.
                  </p>
                </div>
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
