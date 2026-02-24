
import React, { useState } from 'react';
import { X, FileText, Check, Download, Loader2, Image, Upload, Trash2 } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (options: { includeSchedule: boolean; includeServices: boolean; includeTeam: boolean }, images: File[]) => void;
  isGenerating: boolean;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onGenerate, isGenerating }) => {
  const [options, setOptions] = useState({
    includeSchedule: true,
    includeServices: true,
    includeTeam: true
  });
  
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedImages(prev => [...prev, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    onGenerate(options, selectedImages);
  };

  const isValid = Object.values(options).some(v => v);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 bg-white border-b border-slate-50 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Generate Report
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Include Sections</p>
            
            <button 
              onClick={() => handleToggle('includeSchedule')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${options.includeSchedule ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <span className={`font-bold text-sm ${options.includeSchedule ? 'text-slate-900' : 'text-slate-500'}`}>Schedule</span>
              {options.includeSchedule && <Check className="w-4 h-4 text-amber-600" />}
            </button>

            <button 
              onClick={() => handleToggle('includeServices')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${options.includeServices ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <span className={`font-bold text-sm ${options.includeServices ? 'text-slate-900' : 'text-slate-500'}`}>Service List</span>
              {options.includeServices && <Check className="w-4 h-4 text-amber-600" />}
            </button>

            <button 
              onClick={() => handleToggle('includeTeam')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${options.includeTeam ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <span className={`font-bold text-sm ${options.includeTeam ? 'text-slate-900' : 'text-slate-500'}`}>Team View</span>
              {options.includeTeam && <Check className="w-4 h-4 text-amber-600" />}
            </button>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-50">
             <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attachments</p>
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Add Photos
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
             </div>
             
             {selectedImages.length === 0 ? (
                 <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-xl">
                     <Image className="w-8 h-8 text-slate-200 mx-auto mb-1" />
                     <p className="text-[10px] text-slate-400 font-medium">No images selected</p>
                 </div>
             ) : (
                 <div className="space-y-2">
                     {selectedImages.map((file, idx) => (
                         <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                             <div className="flex items-center gap-2 overflow-hidden">
                                 <div className="w-8 h-8 bg-slate-200 rounded flex items-center justify-center shrink-0">
                                     <Image className="w-4 h-4 text-slate-400" />
                                 </div>
                                 <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">{file.name}</span>
                             </div>
                             <button onClick={() => removeImage(idx)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors">
                                 <Trash2 className="w-4 h-4" />
                             </button>
                         </div>
                     ))}
                 </div>
             )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0">
          <button 
            onClick={handleGenerate}
            disabled={!isValid || isGenerating}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : 'Download PDF Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
