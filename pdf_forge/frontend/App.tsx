
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useBase, useGlobalConfig } from '@airtable/blocks/ui';
import { Record as AirtableSDKRecord } from '@airtable/blocks/models';
import { TabConfig } from './types';
import { downloadTabPdf, downloadFullReport } from './services/pdfService';
import TabContent from './components/TabContent';
import SettingsPanel from './components/SettingsPanel';
import ReportModal from './components/ReportModal';
import SetupGuide from './components/SetupGuide';
import { Settings as SettingsIcon, Download, FileText, Zap, Plus } from 'lucide-react';

const GC_TABS         = 'tabs';
const GC_HEADER_IMAGE = 'headerImageBase64';

const App: React.FC = () => {
  // ── Wait for Tailwind CDN ──────────────────────────────────────────────────
  const [tailwindReady, setTailwindReady] = useState(() =>
    typeof (window as any).tailwind !== 'undefined'
  );

  useEffect(() => {
    if (tailwindReady) return;
    if (typeof (window as any).tailwind !== 'undefined') { setTailwindReady(true); return; }
    const script = document.querySelector('#tailwind-cdn') as HTMLScriptElement | null;
    if (!script) { setTailwindReady(true); return; }
    script.addEventListener('load', () => setTailwindReady(true), { once: true });
  }, []);

  // ── Airtable SDK ──────────────────────────────────────────────────────────
  const base         = useBase();
  const globalConfig = useGlobalConfig();

  const tabsRaw = globalConfig.get(GC_TABS) as string | null;
  const tabs: TabConfig[] = useMemo(() => {
    if (!tabsRaw) return [];
    try { return JSON.parse(tabsRaw) as TabConfig[]; } catch { return []; }
  }, [tabsRaw]);

  const headerImageBase64 = (globalConfig.get(GC_HEADER_IMAGE) as string) || null;

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTabId, setActiveTabId]         = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen]   = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [status, setStatus]                   = useState<string | null>(null);
  const [error, setError]                     = useState<string | null>(null);

  // Keep activeTabId pointing at a valid tab
  useEffect(() => {
    if (tabs.length === 0) { setActiveTabId(null); return; }
    if (!activeTabId || !tabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  // ── Records registry (tab.id → {primary, detail?}) ─────────────────────
  const recordsRegistry = useRef<Map<string, { primary: AirtableSDKRecord[]; detail?: AirtableSDKRecord[] }>>(new Map());

  const handleRecordsUpdate = useCallback((
    tabId: string,
    primary: AirtableSDKRecord[],
    detail?: AirtableSDKRecord[],
  ) => {
    recordsRegistry.current.set(tabId, { primary, detail });
  }, []);

  // ── GlobalConfig writes ───────────────────────────────────────────────────
  const handleSaveTabs = useCallback(async (newTabs: TabConfig[]) => {
    await globalConfig.setAsync(GC_TABS, JSON.stringify(newTabs));
  }, [globalConfig]);

  const handleSaveHeaderImage = useCallback(async (base64: string) => {
    await globalConfig.setAsync(GC_HEADER_IMAGE, base64);
    setStatus('Header image saved');
    setTimeout(() => setStatus(null), 2000);
  }, [globalConfig]);

  // ── PDF generation ────────────────────────────────────────────────────────
  const handleDownloadPdf = () => {
    if (!activeTabId) return;
    try {
      setStatus('Generating PDF...');
      const tab  = tabs.find(t => t.id === activeTabId);
      const data = recordsRegistry.current.get(activeTabId);
      if (!tab || !data) { setError('Data not loaded yet — try again in a moment.'); setStatus(null); return; }
      downloadTabPdf(tab, data.primary, data.detail, headerImageBase64);
      setStatus('PDF Downloaded');
      setTimeout(() => setStatus(null), 2000);
    } catch (err: any) {
      setError('PDF Error: ' + err.message);
      setStatus(null);
    }
  };

  const handleFullReport = async (selectedTabIds: string[], images: File[]) => {
    try {
      setStatus('Processing images...');
      const processedImages = await Promise.all(
        images.map(async file => ({
          name: file.name.replace(/\.[^/.]+$/, ''),
          data: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
        }))
      );

      setStatus('Generating Full Report...');
      const parts = selectedTabIds
        .map(id => {
          const tab  = tabs.find(t => t.id === id);
          const data = recordsRegistry.current.get(id);
          return tab && data ? { tab, primary: data.primary, detail: data.detail } : null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      downloadFullReport(parts, processedImages, headerImageBase64);
      setStatus('Report Downloaded');
      setTimeout(() => setStatus(null), 2000);
      setIsReportModalOpen(false);
    } catch (err: any) {
      setError('PDF Error: ' + err.message);
      setStatus(null);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!tailwindReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#64748b', fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  if (tabs.length === 0) {
    return (
      <>
        <SetupGuide onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsPanel
          isOpen={isSettingsOpen}
          tabs={tabs}
          onSaveTabs={handleSaveTabs}
          onSaveHeaderImage={handleSaveHeaderImage}
          headerImageBase64={headerImageBase64}
          onClose={() => setIsSettingsOpen(false)}
        />
      </>
    );
  }

  const activeTab = tabs.find(t => t.id === activeTabId);

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">
                {base.name}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none mb-2">
              {activeTab?.label ?? ''}
            </h1>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold uppercase tracking-widest">
              <Zap className="w-3 h-3" /> Live
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95"
            >
              <SettingsIcon className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-sm">Settings</span>
            </button>
          </div>
        </header>

        {/* Status / Error banners */}
        {status && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-bold text-center">
            {status}
          </div>
        )}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-bold flex justify-between items-center">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2 mb-8 p-1 bg-slate-200/50 rounded-2xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                tab.id === activeTabId
                  ? 'bg-white shadow-lg text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Add view"
            className="px-3 py-3 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="sticky top-6 z-30 mb-10 flex gap-3">
          <button
            onClick={handleDownloadPdf}
            disabled={!activeTabId}
            className="flex-1 flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="w-5 h-5 text-amber-500" /> Download PDF
          </button>
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-3 bg-amber-500 text-white px-6 py-4 rounded-xl font-bold shadow-md hover:bg-amber-600 transition-all active:scale-[0.98]"
          >
            <FileText className="w-5 h-5" /> Full Report
          </button>
        </div>

        {/* Tab content — all mounted, active one visible */}
        <main className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden mb-12">
          {tabs.map(tab => (
            <TabContent
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              headerImageBase64={headerImageBase64}
              onRecordsUpdate={handleRecordsUpdate}
            />
          ))}
        </main>

      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        tabs={tabs}
        onSaveTabs={handleSaveTabs}
        onSaveHeaderImage={handleSaveHeaderImage}
        headerImageBase64={headerImageBase64}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        tabs={tabs}
        onGenerate={handleFullReport}
        isGenerating={!!status && status.includes('Generating')}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
};

export default App;
