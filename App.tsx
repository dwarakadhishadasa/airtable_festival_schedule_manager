
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppConfig, AirtableRecord, GroupedData, NameMapping, TeamMember, ViewMode } from './types';
import { fetchAirtableData, fetchTeamMembersMapping, fetchAirtableBaseName } from './services/airtableService';
import { generatePdfBlob, downloadPdf, initHeaderImage } from './services/pdfService';
import { sendToWhatsapp } from './services/whatsappService';
import ScheduleTable from './components/ScheduleTable';
import ServiceListTable from './components/ServiceListTable';
import TeamAssignmentTable from './components/TeamAssignmentTable';
import ConfigModal from './components/ConfigModal';
import ReportModal from './components/ReportModal';
import { 
  RefreshCw, 
  Share2, 
  Settings as SettingsIcon, 
  Loader2, 
  Download, 
  Calendar,
  ListChecks,
  ChevronRight,
  Clock,
  Users,
  FileText
} from 'lucide-react';

const STORAGE_KEY = 'fest_sched_config_v5';
const CACHE_KEY_SCHEDULE = 'fest_cache_schedule';
const CACHE_KEY_SERVICES = 'fest_cache_services';
const CACHE_KEY_TEAM = 'fest_cache_team';
const CACHE_KEY_MAPPING = 'fest_cache_mapping';
const CACHE_KEY_TIMESTAMP = 'fest_cache_timestamp';

// "Environment Variables" / Constants
const ENV = {
  AIRTABLE_API_KEY: 'patTDvAfU8USz8jWc.2559c0322ae4d1448acc4da0c58eaa76b69124964a1616c287796808482f2f3c',
  TABLE_ACTIVITIES: 'Activities',
  TABLE_SERVICES: 'Services',
  TABLE_TEAM: 'Team Members',
  PDF_TITLE_SCHEDULE: 'SCHEDULE',
  PDF_TITLE_SERVICES: 'SERVICE LIST',
  PDF_TITLE_TEAM: 'DEVOTEE WISE SERVICES'
};

const INITIAL_CONFIG: AppConfig = {
  airtableApiKey: ENV.AIRTABLE_API_KEY,
  airtableBaseId: 'appajEHWNkCC1dyls',
  airtableTableName: ENV.TABLE_ACTIVITIES,
  serviceTableName: ENV.TABLE_SERVICES,
  teamMembersTableName: ENV.TABLE_TEAM,
  aisensyApiKey: '',
  aisensyCampaignName: '',
  whatsappRecipient: '',
  pdfTitle: ENV.PDF_TITLE_SCHEDULE,
  servicePdfTitle: ENV.PDF_TITLE_SERVICES,
  teamPdfTitle: ENV.PDF_TITLE_TEAM
};

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const base = saved ? JSON.parse(saved) : INITIAL_CONFIG;
    return {
      ...base,
      airtableApiKey: ENV.AIRTABLE_API_KEY,
      airtableTableName: ENV.TABLE_ACTIVITIES,
      serviceTableName: ENV.TABLE_SERVICES,
      teamMembersTableName: ENV.TABLE_TEAM,
      pdfTitle: base.pdfTitle || ENV.PDF_TITLE_SCHEDULE,
      servicePdfTitle: base.servicePdfTitle || ENV.PDF_TITLE_SERVICES,
      teamPdfTitle: base.teamPdfTitle || ENV.PDF_TITLE_TEAM,
    };
  });

  const [viewMode, setViewMode] = useState<ViewMode>('schedule');
  
  const [scheduleRecords, setScheduleRecords] = useState<AirtableRecord[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY_SCHEDULE);
    return cached ? JSON.parse(cached) : [];
  });
  
  const [serviceRecords, setServiceRecords] = useState<AirtableRecord[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY_SERVICES);
    return cached ? JSON.parse(cached) : [];
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY_TEAM);
    return cached ? JSON.parse(cached) : [];
  });

  const [nameMapping, setNameMapping] = useState<NameMapping>(() => {
    const cached = localStorage.getItem(CACHE_KEY_MAPPING);
    return cached ? JSON.parse(cached) : {};
  });

  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    return localStorage.getItem(CACHE_KEY_TIMESTAMP);
  });

  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [teamTypeFilter, setTeamTypeFilter] = useState('FTM');
  const [teamStatusFilter, setTeamStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const [isLoading, setIsLoading] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    initHeaderImage();
  }, []);

  const serviceMap = useMemo(() => serviceRecords.reduce((acc, r) => {
    acc[r.id] = r;
    return acc;
  }, {} as Record<string, AirtableRecord>), [serviceRecords]);

  const filteredTeamMembers = useMemo(() => {
    return teamMembers.filter(member => {
      const matchesSearch = member.name.toLowerCase().includes(teamSearchTerm.toLowerCase());
      const matchesType = teamTypeFilter === 'All' || member.type === teamTypeFilter;
      
      const checkIds = (ids?: string[]) => ids && ids.some(id => !!serviceMap[id]);
      const hasAssignment = checkIds(member.coordinatorServiceIds) || 
                            checkIds(member.teamMemberServiceIds) || 
                            checkIds(member.standbyServiceIds);
      
      const matchesStatus = teamStatusFilter === 'all' || 
                           (teamStatusFilter === 'assigned' && hasAssignment) || 
                           (teamStatusFilter === 'unassigned' && !hasAssignment);

      return matchesSearch && matchesType && matchesStatus;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [teamMembers, teamSearchTerm, teamTypeFilter, teamStatusFilter, serviceMap]);

  const teamUniqueTypes = useMemo(() => {
    const types = new Set(teamMembers.map(m => m.type).filter(Boolean));
    return ['All', ...Array.from(types).sort()];
  }, [teamMembers]);

  const groupData = (data: AirtableRecord[]): GroupedData => {
    const grouped = data.reduce((acc, record) => {
      const date = record.fields.Date || 'Unspecified Date';
      if (!acc[date]) acc[date] = {};
      const category = record.fields.Category || 'General';
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

  const loadData = useCallback(async (force = false) => {
    if (!config.airtableApiKey || !config.airtableBaseId) {
      setIsConfigOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const baseName = await fetchAirtableBaseName(config);
      if (baseName) {
        const prefix = baseName.toUpperCase();
        const expectedScheduleTitle = `${prefix} - SCHEDULE`;
        const expectedServiceTitle = `${prefix} - SERVICE LIST`;
        const expectedTeamTitle = `${prefix} - DEVOTEE WISE SERVICES`;

        if (
          config.pdfTitle !== expectedScheduleTitle ||
          config.servicePdfTitle !== expectedServiceTitle ||
          config.teamPdfTitle !== expectedTeamTitle
        ) {
          const newConfig = {
             ...config,
             pdfTitle: expectedScheduleTitle,
             servicePdfTitle: expectedServiceTitle,
             teamPdfTitle: expectedTeamTitle
          };
          setConfig(newConfig);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
        }
      }

      const teamRes = await fetchAirtableData(config, config.teamMembersTableName || ENV.TABLE_TEAM);
      const members: TeamMember[] = teamRes.records.map(r => {
        const rawType = r.fields.Type;
        const typeStr = Array.isArray(rawType) ? rawType[0] : (rawType || 'FTM');
        
        return {
          id: r.id,
          name: r.fields.Name || 'Unknown',
          type: typeStr,
          coordinatorServiceIds: r.fields.Coordinator || [],
          teamMemberServiceIds: r.fields["Team Member"] || [],
          standbyServiceIds: r.fields.Standby || []
        };
      });
      setTeamMembers(members);
      localStorage.setItem(CACHE_KEY_TEAM, JSON.stringify(members));

      const mapping: NameMapping = {};
      members.forEach(m => mapping[m.id] = m.name);
      setNameMapping(mapping);
      localStorage.setItem(CACHE_KEY_MAPPING, JSON.stringify(mapping));

      if (config.airtableTableName) {
        const schedRes = await fetchAirtableData(config, config.airtableTableName);
        setScheduleRecords(schedRes.records);
        localStorage.setItem(CACHE_KEY_SCHEDULE, JSON.stringify(schedRes.records));
      }

      if (config.serviceTableName) {
        const servRes = await fetchAirtableData(config, config.serviceTableName);
        setServiceRecords(servRes.records);
        localStorage.setItem(CACHE_KEY_SERVICES, JSON.stringify(servRes.records));
      }

      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem(CACHE_KEY_TIMESTAMP, now);
      setStatus('Cloud Data Refreshed');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  useEffect(() => {
    const hasAnyData = scheduleRecords.length > 0 || serviceRecords.length > 0 || teamMembers.length > 0;
    if (!hasAnyData && config.airtableApiKey && config.airtableBaseId) {
      loadData(false);
    }
  }, [config.airtableApiKey, config.airtableBaseId, loadData]);

  const handleSaveConfig = (newConfig: AppConfig) => {
    const mergedConfig = {
      ...newConfig,
      airtableApiKey: ENV.AIRTABLE_API_KEY,
      airtableTableName: ENV.TABLE_ACTIVITIES,
      serviceTableName: ENV.TABLE_SERVICES,
      teamMembersTableName: ENV.TABLE_TEAM,
    };
    setConfig(mergedConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedConfig));
    setStatus('Configuration Updated');
    setTimeout(() => setStatus(null), 2000);
    
    if (newConfig.airtableBaseId !== config.airtableBaseId) {
      setTimeout(() => loadData(true), 100);
    }
  };

  const generatePdf = async () => {
    const options = {
        viewMode,
        schedule: scheduleRecords,
        services: serviceRecords,
        teamMembers: viewMode === 'team' ? filteredTeamMembers : teamMembers, 
        serviceRecords: serviceRecords,
        nameMapping
    };
    return await generatePdfBlob(options, config);
  };

  const handleDownloadPdf = async () => {
    try {
      setStatus('Generating PDF...');
      const blob = await generatePdf();
      const title = viewMode === 'schedule' ? config.pdfTitle : viewMode === 'services' ? config.servicePdfTitle : config.teamPdfTitle;
      downloadPdf(blob, `${title}.pdf`);
      setStatus('PDF Downloaded');
      setTimeout(() => setStatus(null), 2000);
    } catch (err: any) {
      setError('PDF Error: ' + err.message);
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleGenerateFullReport = async (options: { includeSchedule: boolean; includeServices: boolean; includeTeam: boolean }, images: File[]) => {
    try {
      setStatus('Processing Images...');
      // Convert images to base64 with file names (extension stripped)
      const processedImages = await Promise.all(images.map(async (file) => ({
        name: file.name.replace(/\.[^/.]+$/, ""),
        data: await convertFileToBase64(file)
      })));
      
      setStatus('Generating Full Report...');
      const pdfOptions = {
          viewMode: 'full' as ViewMode,
          schedule: scheduleRecords,
          services: serviceRecords,
          teamMembers: filteredTeamMembers,
          serviceRecords: serviceRecords,
          nameMapping,
          reportOptions: options,
          attachedImages: processedImages
      };
      
      let fileName = 'Festival_Report';
      if (options.includeSchedule) {
          fileName = config.pdfTitle;
      } else if (options.includeServices) {
          fileName = config.servicePdfTitle;
      } else if (options.includeTeam) {
          fileName = config.teamPdfTitle;
      }

      const blob = await generatePdfBlob(pdfOptions, config);
      downloadPdf(blob, `${fileName}.pdf`);
      setStatus('Report Downloaded');
      setTimeout(() => setStatus(null), 2000);
      setIsReportModalOpen(false);
    } catch (err: any) {
      setError('PDF Error: ' + err.message);
      setStatus(null);
    }
  };

  const handleSendToWhatsapp = async () => {
    if (!config.aisensyApiKey) {
      setIsConfigOpen(true);
      return;
    }
    setError(null);
    try {
      setStatus('Preparing PDF for Send...');
      const blob = await generatePdf();
      const title = viewMode === 'schedule' ? config.pdfTitle : viewMode === 'services' ? config.servicePdfTitle : config.teamPdfTitle;
      downloadPdf(blob, `${title}.pdf`);
      setStatus('WhatsApp logic requires a public URL host');
      setTimeout(() => setStatus(null), 5000);
    } catch (err: any) {
      setError('WhatsApp Error: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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
            <div className="flex items-center gap-4">
              <p className="text-slate-500 font-medium flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4" />
                Airtable Cloud Sync
              </p>
              {lastSynced && (
                <p className="text-slate-400 font-medium flex items-center gap-1.5 text-xs">
                  <Clock className="w-3 h-3" />
                  Synced: {lastSynced}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex gap-3 no-print">
            <button onClick={() => loadData(true)} disabled={isLoading} className="group flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl shadow-sm hover:border-slate-300 transition-all active:scale-95 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : 'text-slate-400'}`} />
              <span className="font-semibold text-sm">Refresh</span>
            </button>
            <button onClick={() => setIsConfigOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95">
              <SettingsIcon className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-sm">Settings</span>
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-8 no-print p-1 bg-slate-200/50 rounded-2xl w-fit">
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

        <div className="sticky top-6 z-30 mb-10 no-print flex gap-3">
          <button onClick={handleDownloadPdf} className="flex-1 flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-[0.98]">
            <Download className="w-5 h-5 text-amber-500" /> Download PDF
          </button>
          <button onClick={() => setIsReportModalOpen(true)} className="flex-1 flex items-center justify-center gap-3 bg-amber-500 text-white px-6 py-4 rounded-xl font-bold shadow-md hover:bg-amber-600 transition-all active:scale-[0.98]">
            <FileText className="w-5 h-5 text-white" /> Full Report
          </button>
          <button onClick={handleSendToWhatsapp} className="flex-1 flex items-center justify-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98]">
            <Share2 className="w-5 h-5 text-emerald-400" /> Send WhatsApp
          </button>
        </div>

        <main className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden mb-12">
          {isLoading ? (
            <div className="h-[600px] flex flex-col items-center justify-center text-slate-400 gap-6">
              <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
              <p className="font-bold text-slate-500 tracking-widest uppercase text-xs">Syncing Cloud Database...</p>
            </div>
          ) : (
            <div className="relative">
              {viewMode === 'schedule' && (
                <ScheduleTable id="schedule-capture" data={groupData(scheduleRecords)} title={config.pdfTitle} />
              )}
              {viewMode === 'services' && (
                <ServiceListTable id="service-capture" data={groupData(serviceRecords)} title={config.servicePdfTitle} nameMapping={nameMapping} />
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
            </div>
          )}
        </main>
      </div>

      <ConfigModal isOpen={isConfigOpen} config={config} onSave={handleSaveConfig} onClose={() => setIsConfigOpen(false)} />
      <ReportModal isOpen={isReportModalOpen} isGenerating={!!status && status.includes('Generating')} onGenerate={handleGenerateFullReport} onClose={() => setIsReportModalOpen(false)} />
    </div>
  );
};

export default App;
