
import React, { useState } from 'react';
import { AppConfig } from '../types';
import { Settings, X, Image as ImageIcon, CheckCircle, AlertCircle, Upload, Loader2 } from 'lucide-react';

interface SettingsPanelProps {
  isOpen: boolean;
  config: AppConfig;
  onSave: (config: AppConfig) => Promise<void>;
  onSaveHeaderImage: (base64: string) => Promise<void>;
  headerImageBase64: string | null;
  baseName: string;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  config,
  onSave,
  onSaveHeaderImage,
  headerImageBase64,
  baseName,
  onClose,
}) => {
  const [local, setLocal] = useState<AppConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Keep local state in sync when config changes externally
  React.useEffect(() => {
    if (isOpen) setLocal(config);
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(local);
    setIsSaving(false);
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsImageLoading(true);
    setImageError(null);
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      // Check the base64 string length — this is what gets stored in GlobalConfig.
      // Airtable GlobalConfig has a 150 kB total limit across all keys.
      // 110 kB base64 ≈ 82 kB original file, leaving a ~40 kB buffer.
      const base64SizeKB = base64.length / 1024;
      if (base64SizeKB > 110) {
        setImageError(`Image too large (${Math.round(base64SizeKB)}kB encoded). Please compress it to under 80kB and try again.`);
        setIsImageLoading(false);
        return;
      }
      await onSaveHeaderImage(base64);
      setIsImageLoading(false);
    };
    reader.onerror = () => setIsImageLoading(false);
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">

        {/* Header */}
        <div className="px-8 py-6 bg-white border-b border-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-500" />
              Extension Settings
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Connected to: <strong className="text-slate-600">{baseName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors group">
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-900" />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">

          {/* PDF Titles */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PDF Report Titles</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Schedule</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  value={local.pdfTitle}
                  onChange={e => setLocal({ ...local, pdfTitle: e.target.value })}
                  placeholder="e.g. FESTIVAL NAME - SCHEDULE"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Service List</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  value={local.servicePdfTitle}
                  onChange={e => setLocal({ ...local, servicePdfTitle: e.target.value })}
                  placeholder="e.g. FESTIVAL NAME - SERVICE LIST"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Team Assignment</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  value={local.teamPdfTitle}
                  onChange={e => setLocal({ ...local, teamPdfTitle: e.target.value })}
                  placeholder="e.g. FESTIVAL NAME - MEMBER-WISE SERVICES"
                />
              </div>
            </div>
          </section>

          {/* PDF Header Image */}
          <section className="space-y-4 pt-6 border-t border-slate-50">
            <div className="flex items-center gap-2">
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
                Stored in Airtable GlobalConfig. Keep compressed image under 80kB — reduce dimensions or export at lower quality.
              </p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-xl active:scale-95"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
