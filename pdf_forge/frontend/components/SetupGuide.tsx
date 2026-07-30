
import React from 'react';
import { Layout } from 'lucide-react';

interface SetupGuideProps {
  onOpenSettings: () => void;
}

const SetupGuide: React.FC<SetupGuideProps> = ({ onOpenSettings }) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
    <div className="max-w-md text-center">
      <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-6">
        <Layout className="w-10 h-10 text-slate-300" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">No views configured</h2>
      <p className="text-slate-500 text-sm mb-8">
        Open Settings to add your first view. You can create grouped table views or linked-per-item views pointing to any table in your base.
      </p>
      <button
        onClick={onOpenSettings}
        className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-xl active:scale-95"
      >
        Open Settings
      </button>
    </div>
  </div>
);

export default SetupGuide;
