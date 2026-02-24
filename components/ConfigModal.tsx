
import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { Settings, X, Cloud, Send, Loader2, Image as ImageIcon, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { fetchAirtableBases } from '../services/airtableService';
import { initHeaderImage, isHeaderImageCached, saveHeaderImageToCache, clearHeaderImageCache, HEADER_IMAGE_URL } from '../services/pdfService';

interface ConfigModalProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ config, onSave, isOpen, onClose }) => {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const [bases, setBases] = useState<{id: string, name: string}[]>([]);
  const [loadingBases, setLoadingBases] = useState(false);
  const [baseError, setBaseError] = useState<string | null>(null);
  
  // Image State
  const [isImageCached, setIsImageCached] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Load bases and check image when modal opens
  useEffect(() => {
    if (isOpen) {
      if (config.airtableApiKey) loadBases(config.airtableApiKey);
      checkImageStatus();
    }
  }, [isOpen, config.airtableApiKey]);

  const checkImageStatus = () => {
    setIsImageCached(isHeaderImageCached());
  };

  const loadBases = async (apiKey: string) => {
    setLoadingBases(true);
    setBaseError(null);
    try {
      const basesList = await fetchAirtableBases(apiKey);
      setBases(basesList);
    } catch (err) {
      setBaseError("Failed to load bases");
    } finally {
      setLoadingBases(false);
    }
  };
  
  const handleTryAutoFetch = async () => {
    setIsImageLoading(true);
    clearHeaderImageCache();
    await initHeaderImage(); // This now tries direct + proxy
    checkImageStatus();
    setIsImageLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsImageLoading(true);
      try {
        await saveHeaderImageToCache(e.target.files[0]);
        checkImageStatus();
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        setIsImageLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 bg-white border-b border-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-500" />
              Settings
            </h2>
            <p className="text-xs text-slate-400 font-medium">Configure application settings</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors group">
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-900" />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          <section className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-4 h-4 text-slate-400" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Airtable Source</h3>
             </div>
             <div className="grid grid-cols-1 gap-4">
               <div>
                 <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Select Base</label>
                 <div className="relative">
                   <select
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all appearance-none font-medium text-slate-700"
                     value={localConfig.airtableBaseId}
                     onChange={(e) => setLocalConfig({ ...localConfig, airtableBaseId: e.target.value })}
                     disabled={loadingBases}
                   >
                     <option value="" disabled>Select a festival base...</option>
                     {bases.map(base => (
                       <option key={base.id} value={base.id}>{base.name}</option>
                     ))}
                   </select>
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                     {loadingBases ? (
                       <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                     ) : (
                       <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                     )}
                   </div>
                 </div>
                 {baseError && <p className="text-red-500 text-xs mt-2 font-medium">{baseError}</p>}
                 <p className="text-[10px] text-slate-400 mt-2 font-medium leading-relaxed">
                   API Key and Table configurations are managed via environment variables.
                 </p>
               </div>
             </div>
          </section>

          {/* Header Image Section */}
          <section className="space-y-4 pt-6 border-t border-slate-50">
             <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PDF Header Image</h3>
             </div>
             
             <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status</span>
                    {isImageCached ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold uppercase tracking-wide">
                            <CheckCircle className="w-4 h-4" /> Cached Ready
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-amber-600 text-xs font-bold uppercase tracking-wide">
                            <AlertCircle className="w-4 h-4" /> Missing
                        </span>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={handleTryAutoFetch} 
                        disabled={isImageLoading}
                        className="flex flex-col items-center justify-center gap-2 bg-white border border-slate-200 py-3 rounded-xl hover:border-amber-500 hover:text-amber-600 transition-all text-slate-500"
                    >
                        {isImageLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
                        <span className="text-[10px] font-bold uppercase tracking-wide">Auto-Fetch</span>
                    </button>
                    <label className="flex flex-col items-center justify-center gap-2 bg-white border border-slate-200 py-3 rounded-xl hover:border-amber-500 hover:text-amber-600 transition-all text-slate-500 cursor-pointer">
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Upload File</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 text-center leading-relaxed">
                   The configured URL is the default server asset. <br/>Use <b>Auto-Fetch</b> to try caching it via proxy, or <b>Upload File</b> if that fails.
                </p>
             </div>
          </section>

          <section className="space-y-4 pt-6 border-t border-slate-50">
             <div className="flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-slate-400" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Gateway</h3>
             </div>
             <div className="grid grid-cols-1 gap-3">
               <input
                 placeholder="AiSensy API Key"
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-amber-500/20"
                 value={localConfig.aisensyApiKey}
                 onChange={(e) => setLocalConfig({ ...localConfig, aisensyApiKey: e.target.value })}
               />
               <input
                 placeholder="Campaign Name"
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-amber-500/20"
                 value={localConfig.aisensyCampaignName}
                 onChange={(e) => setLocalConfig({ ...localConfig, aisensyCampaignName: e.target.value })}
               />
               <input
                 placeholder="Recipient Phone (e.g. 9198...)"
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-amber-500/20"
                 value={localConfig.whatsappRecipient}
                 onChange={(e) => setLocalConfig({ ...localConfig, whatsappRecipient: e.target.value })}
               />
             </div>
          </section>
        </div>

        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-900 transition-colors">Cancel</button>
          <button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-xl active:scale-95">Update Config</button>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
