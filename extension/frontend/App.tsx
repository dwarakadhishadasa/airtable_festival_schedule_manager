
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useBase, useRecords, useGlobalConfig } from '@airtable/blocks/ui';
import { AppConfig, AirtableRecord, GroupedData, NameMapping, TeamMember, ViewMode } from './types';
import { generateAndDownloadPdf } from './services/pdfService';
import { adaptSDKRecord } from './services/recordAdapter';
import ScheduleTable from './components/ScheduleTable';
import ServiceListTable from './components/ServiceListTable';
import TeamAssignmentTable from './components/TeamAssignmentTable';
import SettingsPanel from './components/SettingsPanel';
import ReportModal from './components/ReportModal';
import SetupGuide from './components/SetupGuide';
import {
  Settings as SettingsIcon, Download,
  Calendar, ListChecks, ChevronRight, Users, FileText, Zap, HelpCircle
} from 'lucide-react';

// Table names expected in the connected base
const TABLE_ACTIVITIES = 'Activities';
const TABLE_SERVICES   = 'Services';
const TABLE_TEAM       = 'Team Members';

// GlobalConfig keys
const GC = {
  PDF_TITLE:         'pdfTitle',
  SERVICE_PDF_TITLE: 'servicePdfTitle',
  TEAM_PDF_TITLE:    'teamPdfTitle',
  HEADER_IMAGE:      'headerImageBase64',
} as const;

const App: React.FC = () => {
  // Gate rendering until Tailwind CDN has finished loading so the first paint is styled.
  // index.tsx already injected the <script> tag at module load time; here we just wait
  // for its onload event (or mark ready immediately if it already fired).
  const [tailwindReady, setTailwindReady] = useState(() => {
    // If Tailwind was somehow already available (e.g. hot-reload), skip the wait.
    return typeof (window as any).tailwind !== 'undefined';
  });

  useEffect(() => {
    if (tailwindReady) return;
    // If Tailwind loaded between the useState initialiser and this effect firing, mark ready now.
    if (typeof (window as any).tailwind !== 'undefined') { setTailwindReady(true); return; }
    const script = document.querySelector('#tailwind-cdn') as HTMLScriptElement | null;
    if (!script) { setTailwindReady(true); return; } // no script tag — render anyway
    script.addEventListener('load', () => setTailwindReady(true), { once: true });
  }, []);

  // --- Airtable SDK hooks ---
  const base          = useBase();
  const globalConfig  = useGlobalConfig();

  // Resolve tables — getTableByNameIfExists returns null if not found
  const activitiesTable = base.getTableByNameIfExists(TABLE_ACTIVITIES);
  const servicesTable   = base.getTableByNameIfExists(TABLE_SERVICES);
  const teamTable       = base.getTableByNameIfExists(TABLE_TEAM);

  // useRecords is reactive: re-renders automatically when Airtable data changes.
  // It accepts null and returns [] when the table doesn't exist.
  const rawActivityRecords = useRecords(activitiesTable);
  const rawServiceRecords  = useRecords(servicesTable);
  const rawTeamRecords     = useRecords(teamTable);

  // --- Config from GlobalConfig ---
  const baseName = base.name.toUpperCase();

  const config: AppConfig = {
    pdfTitle:        (globalConfig.get(GC.PDF_TITLE)         as string) || `${baseName} - SCHEDULE`,
    servicePdfTitle: (globalConfig.get(GC.SERVICE_PDF_TITLE)  as string) || `${baseName} - SERVICE LIST`,
    teamPdfTitle:    (globalConfig.get(GC.TEAM_PDF_TITLE)     as string) || `${baseName} - MEMBER-WISE SERVICES`,
  };

  const headerImageBase64 = (globalConfig.get(GC.HEADER_IMAGE) as string) || null;

  // --- Adapt SDK records to the existing AirtableRecord shape ---
  const scheduleRecords: AirtableRecord[] = useMemo(
    () => (rawActivityRecords ?? []).map(adaptSDKRecord),
    [rawActivityRecords]
  );

  const serviceRecords: AirtableRecord[] = useMemo(
    () => (rawServiceRecords ?? []).map(adaptSDKRecord),
    [rawServiceRecords]
  );

  const allTeamRecords: AirtableRecord[] = useMemo(
    () => (rawTeamRecords ?? []).map(adaptSDKRecord),
    [rawTeamRecords]
  );

  // Build TeamMember objects for the team assignment view
  const teamMembers: TeamMember[] = useMemo(() => allTeamRecords.map(r => ({
    id: r.id,
    name: r.fields.Name || 'Unknown',
    type: r.fields.Type || 'FTM',
    coordinatorServiceIds: r.fields.Coordinator || [],
    teamMemberServiceIds:  r.fields['Team Member'] || [],
    standbyServiceIds:     r.fields.Standby || [],
  })), [allTeamRecords]);

  // Build NameMapping: recordId → displayName
  const nameMapping: NameMapping = useMemo(() => {
    const mapping: NameMapping = {};
    teamMembers.forEach(m => { mapping[m.id] = m.name; });
    return mapping;
  }, [teamMembers]);

  // --- UI state ---
  const [viewMode, setViewMode]           = useState<ViewMode>('schedule');
  const [teamSearchTerm, setTeamSearchTerm]   = useState('');
  const [teamTypeFilter, setTeamTypeFilter]   = useState('FTM');
  const [teamStatusFilter, setTeamStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [isSettingsOpen, setIsSettingsOpen]   = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen]         = useState(false);
  const [status, setStatus]               = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  // Data loads reactively via useRecords — no manual loading state needed
  const isMisconfigured = !activitiesTable || !servicesTable || !teamTable;

  // --- Derived data ---
  const serviceMap = useMemo(() =>
    serviceRecords.reduce((acc, r) => { acc[r.id] = r; return acc; }, {} as Record<string, AirtableRecord>),
    [serviceRecords]
  );

  const filteredTeamMembers = useMemo(() => teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(teamSearchTerm.toLowerCase());
    const matchesType   = teamTypeFilter === 'All' || member.type === teamTypeFilter;
    const checkIds      = (ids?: string[]) => ids && ids.some(id => !!serviceMap[id]);
    const hasAssignment = checkIds(member.coordinatorServiceIds) || checkIds(member.teamMemberServiceIds) || checkIds(member.standbyServiceIds);
    const matchesStatus = teamStatusFilter === 'all' || (teamStatusFilter === 'assigned' && hasAssignment) || (teamStatusFilter === 'unassigned' && !hasAssignment);
    return matchesSearch && matchesType && matchesStatus;
  }).sort((a, b) => a.name.localeCompare(b.name)), [teamMembers, teamSearchTerm, teamTypeFilter, teamStatusFilter, serviceMap]);

  const teamUniqueTypes = useMemo(() => {
    const types = new Set(teamMembers.map(m => m.type).filter(Boolean));
    return ['All', ...Array.from(types).sort()];
  }, [teamMembers]);

  const groupData = (data: AirtableRecord[]): GroupedData => {
    const grouped = data.reduce((acc, record) => {
      const date     = record.fields.Date     || 'Unspecified Date';
      const category = record.fields.Category || 'General';
      if (!acc[date]) acc[date] = {};
      if (!acc[date][category]) acc[date][category] = [];
      acc[date][category].push(record);
      return acc;
    }, {} as GroupedData);
    Object.keys(grouped).forEach(date => {
      Object.keys(grouped[date]).forEach(cat => {
        grouped[date][cat].sort((a, b) => (a.fields.From || '').localeCompare(b.fields.From || ''));
      });
    });
    return grouped;
  };

  // --- Save config to GlobalConfig ---
  const handleSaveConfig = useCallback(async (newConfig: AppConfig) => {
    await globalConfig.setPathsAsync([
      { path: [GC.PDF_TITLE],         value: newConfig.pdfTitle },
      { path: [GC.SERVICE_PDF_TITLE], value: newConfig.servicePdfTitle },
      { path: [GC.TEAM_PDF_TITLE],    value: newConfig.teamPdfTitle },
    ]);
  }, [globalConfig]);

  const handleSaveHeaderImage = useCallback(async (base64: string) => {
    await globalConfig.setAsync(GC.HEADER_IMAGE, base64);
    setStatus('Header image saved');
    setTimeout(() => setStatus(null), 2000);
  }, [globalConfig]);

  // --- PDF Generation ---
  const handleDownloadPdf = () => {
    try {
      setStatus('Generating PDF...');
      const title = viewMode === 'schedule' ? config.pdfTitle : viewMode === 'services' ? config.servicePdfTitle : config.teamPdfTitle;
      generateAndDownloadPdf(
        { viewMode, schedule: scheduleRecords, services: serviceRecords, teamMembers: viewMode === 'team' ? filteredTeamMembers : teamMembers, serviceRecords, nameMapping },
        config,
        headerImageBase64,
        `${title}.pdf`
      );
      setStatus('PDF Downloaded');
      setTimeout(() => setStatus(null), 2000);
    } catch (err: any) {
      setError('PDF Error: ' + err.message);
      setStatus(null);
    }
  };

  const handleGenerateFullReport = async (
    options: { includeSchedule: boolean; includeServices: boolean; includeTeam: boolean },
    images: File[]
  ) => {
    try {
      setStatus('Processing Images...');
      const processedImages = await Promise.all(images.map(async file => ({
        name: file.name.replace(/\.[^/.]+$/, ''),
        data: await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
      })));
      setStatus('Generating Full Report...');
      const fileName = options.includeSchedule ? config.pdfTitle : options.includeServices ? config.servicePdfTitle : config.teamPdfTitle;
      generateAndDownloadPdf(
        { viewMode: 'full', schedule: scheduleRecords, services: serviceRecords, teamMembers: filteredTeamMembers, serviceRecords, nameMapping, reportOptions: options, attachedImages: processedImages },
        config,
        headerImageBase64,
        `${fileName}.pdf`
      );
      setStatus('Report Downloaded');
      setTimeout(() => setStatus(null), 2000);
      setIsReportModalOpen(false);
    } catch (err: any) {
      setError('PDF Error: ' + err.message);
      setStatus(null);
    }
  };

  // --- Loading / Misconfiguration guards (all hooks have been called above) ---
  if (!tailwindReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#64748b', fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  if (isMisconfigured) {
    return (
      <SetupGuide
        tableStatus={{
          activitiesFound: !!activitiesTable,
          servicesFound:   !!servicesTable,
          teamFound:       !!teamTable,
        }}
      />
    );
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">Festival Management</span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{viewMode.toUpperCase()}</span>
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none mb-2">
              {viewMode === 'schedule' ? config.pdfTitle : viewMode === 'services' ? config.servicePdfTitle : config.teamPdfTitle}
            </h1>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold uppercase tracking-widest">
                <Zap className="w-3 h-3" /> Live
              </span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-slate-400 text-xs font-medium">{base.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHelpOpen(true)}
              title="Schema reference"
              className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl shadow-sm hover:border-slate-300 transition-all active:scale-95"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-sm">Schema</span>
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95">
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

        {/* View tabs */}
        <div className="flex flex-wrap gap-2 mb-8 p-1 bg-slate-200/50 rounded-2xl w-fit">
          <button onClick={() => setViewMode('schedule')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${viewMode === 'schedule' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <Calendar className="w-4 h-4" /> Schedule
          </button>
          <button onClick={() => setViewMode('services')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${viewMode === 'services' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <ListChecks className="w-4 h-4" /> Service List
          </button>
          <button onClick={() => setViewMode('team')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${viewMode === 'team' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <Users className="w-4 h-4" /> Team View
          </button>
        </div>

        {/* Action buttons */}
        <div className="sticky top-6 z-30 mb-10 flex gap-3">
          <button onClick={handleDownloadPdf} className="flex-1 flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-[0.98]">
            <Download className="w-5 h-5 text-amber-500" /> Download PDF
          </button>
          <button onClick={() => setIsReportModalOpen(true)} className="flex-1 flex items-center justify-center gap-3 bg-amber-500 text-white px-6 py-4 rounded-xl font-bold shadow-md hover:bg-amber-600 transition-all active:scale-[0.98]">
            <FileText className="w-5 h-5 text-white" /> Full Report
          </button>
        </div>

        {/* Main content */}
        <main className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden mb-12">
          {viewMode === 'schedule' && (
            <ScheduleTable
              id="schedule-capture"
              data={groupData(scheduleRecords)}
              title={config.pdfTitle}
              headerImageBase64={headerImageBase64}
            />
          )}
          {viewMode === 'services' && (
            <ServiceListTable
              id="service-capture"
              data={groupData(serviceRecords)}
              title={config.servicePdfTitle}
              nameMapping={nameMapping}
            />
          )}
          {viewMode === 'team' && (
            <TeamAssignmentTable
              filteredMembers={filteredTeamMembers}
              serviceRecords={serviceRecords}
              title={config.teamPdfTitle}
              nameMapping={nameMapping}
              searchTerm={teamSearchTerm}
              onSearchChange={setTeamSearchTerm}
              typeFilter={teamTypeFilter}
              onTypeChange={setTeamTypeFilter}
              statusFilter={teamStatusFilter}
              onStatusChange={setTeamStatusFilter}
              uniqueTypes={teamUniqueTypes}
            />
          )}
        </main>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        config={config}
        onSave={handleSaveConfig}
        onSaveHeaderImage={handleSaveHeaderImage}
        headerImageBase64={headerImageBase64}
        baseName={base.name}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        isGenerating={!!status && status.includes('Generating')}
        onGenerate={handleGenerateFullReport}
        onClose={() => setIsReportModalOpen(false)}
      />

      {isHelpOpen && (
        <SetupGuide
          asModal
          tableStatus={{
            activitiesFound: !!activitiesTable,
            servicesFound:   !!servicesTable,
            teamFound:       !!teamTable,
          }}
          onClose={() => setIsHelpOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
