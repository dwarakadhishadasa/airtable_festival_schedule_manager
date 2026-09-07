
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppConfig, AirtableRecord, BuiltInViewMode, GroupedData, NameMapping, SavedViewConfig, TableInfo, TabConfig, TeamMember } from './types';
import { fetchAirtableData, fetchAirtableBaseName, fetchAirtableTables } from './services/airtableService';
import { generatePdfBlob, downloadPdf, initHeaderImage, generateCustomViewPdfBlob, generateSavedViewsReportPdfBlob } from './services/pdfService';
import ScheduleTable from './components/ScheduleTable';
import ServiceListTable from './components/ServiceListTable';
import TeamAssignmentTable from './components/TeamAssignmentTable';
import ConfigModal from './components/ConfigModal';
import ReportModal from './components/ReportModal';
import ViewSettingsPanel from './components/ViewSettingsPanel';
import GenericGroupedTableView from './components/GenericGroupedTableView';
import GenericLinkedPerItemView from './components/GenericLinkedPerItemView';
import { reconcileTeamMemberAssignments, recordStoreKey, safeLinkedIds } from './services/recordHelpers';
import { formatSavedViewTitle } from './services/titleHelpers';
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
  FileText,
  Plus,
  Layers
} from 'lucide-react';

const STORAGE_KEY = 'fest_sched_config_v5';
const VIEWS_STORAGE_KEY = 'fest_sched_saved_views_v1';
const ACTIVE_VIEW_STORAGE_KEY = 'fest_sched_active_view_v1';
const CACHE_KEY_SCHEDULE = 'fest_cache_schedule';
const CACHE_KEY_SERVICES = 'fest_cache_services';
const CACHE_KEY_TEAM = 'fest_cache_team';
const CACHE_KEY_MAPPING = 'fest_cache_mapping';
const CACHE_KEY_TIMESTAMP = 'fest_cache_timestamp';

const scopedStorageKey = (key: string, baseId: string) => `${key}:${baseId || 'no-base'}`;

const readJsonStorage = <T,>(key: string, fallback: T): T => {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
};

const writeJsonStorage = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const readViewsForBase = (baseId: string, config: AppConfig): SavedViewConfig[] => {
  const scoped = localStorage.getItem(scopedStorageKey(VIEWS_STORAGE_KEY, baseId));
  if (scoped) {
    try {
      const parsed = JSON.parse(scoped) as SavedViewConfig[];
      return parsed.length > 0 ? parsed : createDefaultViews(config);
    } catch {
      return createDefaultViews(config);
    }
  }

  const legacy = localStorage.getItem(VIEWS_STORAGE_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as SavedViewConfig[];
      if (parsed.length > 0) {
        writeJsonStorage(scopedStorageKey(VIEWS_STORAGE_KEY, baseId), parsed);
        localStorage.removeItem(VIEWS_STORAGE_KEY);
        return parsed;
      }
    } catch {
      return createDefaultViews(config);
    }
  }

  return createDefaultViews(config);
};

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

const createDefaultViews = (config: AppConfig): SavedViewConfig[] => [
  {
    id: 'default-schedule',
    label: 'Schedule',
    pdfTitle: config.pdfTitle || ENV.PDF_TITLE_SCHEDULE,
    viewType: 'built-in',
    builtInView: 'schedule',
  },
  {
    id: 'default-services',
    label: 'Service List',
    pdfTitle: config.servicePdfTitle || ENV.PDF_TITLE_SERVICES,
    viewType: 'built-in',
    builtInView: 'services',
  },
  {
    id: 'default-team',
    label: 'Team View',
    pdfTitle: config.teamPdfTitle || ENV.PDF_TITLE_TEAM,
    viewType: 'built-in',
    builtInView: 'team',
  },
];

const isBuiltInView = (view: SavedViewConfig): view is Extract<SavedViewConfig, { viewType: 'built-in' }> => {
  return view.viewType === 'built-in';
};

const tableInfoFromRecords = (name: string, records: AirtableRecord[]): TableInfo => {
  const fields = new Set<string>();
  records.forEach(record => {
    Object.keys(record.fields).forEach(field => fields.add(field));
  });
  return {
    name,
    primaryFieldName: ['Name', 'Service', 'Activity'].find(field => fields.has(field)) ?? Array.from(fields)[0],
    fields: Array.from(fields).sort().map(field => ({ name: field })),
    views: [],
  };
};

const linkedNameFieldRequestsForViews = (views: SavedViewConfig[], tables: TableInfo[]) => {
  const tableByName = new Map(tables.map(table => [table.name, table]));
  const requests: Array<{ tableName: string; viewName: string }> = [];

  const addLinkedTarget = (sourceTableName: string, fieldName: string) => {
    const field = tableByName.get(sourceTableName)?.fields.find(item => item.name === fieldName);
    if (field?.linkedTableName) requests.push({ tableName: field.linkedTableName, viewName: '' });
  };

  views.forEach(view => {
    if (view.viewType === 'grouped' && view.groupedConfig) {
      const tableName = view.groupedConfig.tableName;
      view.groupedConfig.columns.forEach(column => {
        addLinkedTarget(tableName, column.fieldName);
        (column.stackedFields ?? []).forEach(stacked => {
          addLinkedTarget(tableName, stacked.fieldName);
        });
      });
    }

    if (view.viewType === 'linked-per-item' && view.linkedConfig) {
      const tableName = view.linkedConfig.detailTableName;
      view.linkedConfig.detailColumns.forEach(column => {
        addLinkedTarget(tableName, column.fieldName);
        (column.stackedFields ?? []).forEach(stacked => {
          addLinkedTarget(tableName, stacked.fieldName);
        });
      });
    }
  });

  return requests;
};

const inferRecordDisplayName = (record: AirtableRecord, primaryFieldName?: string) => {
  const preferredFields = [primaryFieldName, 'Name', 'Service', 'Activity', 'Title'].filter(Boolean) as string[];
  for (const fieldName of preferredFields) {
    const value = record.fields[fieldName];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const names = value.map(item => typeof item === 'object' ? item.name ?? item.id : String(item)).filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    if (typeof value === 'object') return value.name ?? JSON.stringify(value);
    const str = String(value);
    if (str) return str;
  }
  return record.id;
};

const isHiddenRecord = (record: AirtableRecord) => record.fields.Hide === true;

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

  const [views, setViews] = useState<SavedViewConfig[]>(() => {
    return readViewsForBase(config.airtableBaseId, config);
  });
  const [viewsBaseId, setViewsBaseId] = useState(config.airtableBaseId);

  const [activeViewId, setActiveViewId] = useState<string>(() => {
    return localStorage.getItem(scopedStorageKey(ACTIVE_VIEW_STORAGE_KEY, config.airtableBaseId)) ||
      localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) ||
      'default-schedule';
  });

  const activeView = useMemo(() => {
    return views.find(view => view.id === activeViewId) ?? views[0] ?? createDefaultViews(config)[0];
  }, [views, activeViewId, config]);

  const activeBuiltInMode: BuiltInViewMode | null = isBuiltInView(activeView) ? activeView.builtInView : null;
  
  const [scheduleRecords, setScheduleRecords] = useState<AirtableRecord[]>(() => {
    return readJsonStorage(scopedStorageKey(CACHE_KEY_SCHEDULE, config.airtableBaseId), []);
  });
  
  const [serviceRecords, setServiceRecords] = useState<AirtableRecord[]>(() => {
    return readJsonStorage(scopedStorageKey(CACHE_KEY_SERVICES, config.airtableBaseId), []);
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    return readJsonStorage(scopedStorageKey(CACHE_KEY_TEAM, config.airtableBaseId), []);
  });

  const [nameMapping, setNameMapping] = useState<NameMapping>(() => {
    return readJsonStorage(scopedStorageKey(CACHE_KEY_MAPPING, config.airtableBaseId), {});
  });

  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    return localStorage.getItem(scopedStorageKey(CACHE_KEY_TIMESTAMP, config.airtableBaseId));
  });
  const [dataBaseId, setDataBaseId] = useState(config.airtableBaseId);

  const [availableTables, setAvailableTables] = useState<TableInfo[]>([]);
  const [customRecordsByKey, setCustomRecordsByKey] = useState<Record<string, AirtableRecord[]>>({});

  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [teamTypeFilter, setTeamTypeFilter] = useState('FTM');
  const [teamStatusFilter, setTeamStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const [isLoading, setIsLoading] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    initHeaderImage();
  }, []);

  useEffect(() => {
    const nextViews = readViewsForBase(config.airtableBaseId, config);
    const nextActiveViewId =
      localStorage.getItem(scopedStorageKey(ACTIVE_VIEW_STORAGE_KEY, config.airtableBaseId)) ||
      (nextViews.some(view => view.id === activeViewId) ? activeViewId : nextViews[0]?.id) ||
      'default-schedule';

    setViews(nextViews);
    setViewsBaseId(config.airtableBaseId);
    setActiveViewId(nextActiveViewId);
    setScheduleRecords(readJsonStorage(scopedStorageKey(CACHE_KEY_SCHEDULE, config.airtableBaseId), []));
    setServiceRecords(readJsonStorage(scopedStorageKey(CACHE_KEY_SERVICES, config.airtableBaseId), []));
    setTeamMembers(readJsonStorage(scopedStorageKey(CACHE_KEY_TEAM, config.airtableBaseId), []));
    setNameMapping(readJsonStorage(scopedStorageKey(CACHE_KEY_MAPPING, config.airtableBaseId), {}));
    setLastSynced(localStorage.getItem(scopedStorageKey(CACHE_KEY_TIMESTAMP, config.airtableBaseId)));
    setAvailableTables([]);
    setCustomRecordsByKey({});
    setDataBaseId(config.airtableBaseId);
  }, [config.airtableBaseId]);

  useEffect(() => {
    if (viewsBaseId !== config.airtableBaseId) return;
    writeJsonStorage(scopedStorageKey(VIEWS_STORAGE_KEY, config.airtableBaseId), views);
    if (!views.find(view => view.id === activeViewId)) {
      setActiveViewId(views[0]?.id ?? 'default-schedule');
    }
  }, [views, activeViewId, config.airtableBaseId, viewsBaseId]);

  useEffect(() => {
    if (viewsBaseId !== config.airtableBaseId) return;
    localStorage.setItem(scopedStorageKey(ACTIVE_VIEW_STORAGE_KEY, config.airtableBaseId), activeViewId);
  }, [activeViewId, config.airtableBaseId, viewsBaseId]);

  const visibleServiceRecords = useMemo(() => {
    return serviceRecords.filter(record => !isHiddenRecord(record));
  }, [serviceRecords]);

  const serviceMap = useMemo(() => visibleServiceRecords.reduce((acc, r) => {
    acc[r.id] = r;
    return acc;
  }, {} as Record<string, AirtableRecord>), [visibleServiceRecords]);

  const teamMembersWithServiceAssignments = useMemo(() => {
    return reconcileTeamMemberAssignments(teamMembers, serviceRecords);
  }, [teamMembers, serviceRecords]);

  const filteredTeamMembers = useMemo(() => {
    return teamMembersWithServiceAssignments.filter(member => {
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
  }, [teamMembersWithServiceAssignments, teamSearchTerm, teamTypeFilter, teamStatusFilter, serviceMap]);

  const teamUniqueTypes = useMemo(() => {
    const types = new Set(teamMembersWithServiceAssignments.map(m => m.type).filter(Boolean));
    return ['All', ...Array.from(types).sort()];
  }, [teamMembersWithServiceAssignments]);

  const recordNameById = useMemo(() => {
    const tableByName = new Map(availableTables.map(table => [table.name, table]));
    const mapping: Record<string, string> = { ...nameMapping };

    const addRecords = (tableName: string, records: AirtableRecord[]) => {
      const primaryFieldName = tableByName.get(tableName)?.primaryFieldName;
      records.forEach(record => {
        mapping[record.id] = inferRecordDisplayName(record, primaryFieldName);
      });
    };

    addRecords(config.airtableTableName || ENV.TABLE_ACTIVITIES, scheduleRecords);
    addRecords(config.serviceTableName || ENV.TABLE_SERVICES, serviceRecords);

    Object.entries(customRecordsByKey).forEach(([key, records]) => {
      const tableName = key.split('::')[0];
      addRecords(tableName, records);
    });

    return mapping;
  }, [availableTables, nameMapping, config.airtableTableName, config.serviceTableName, scheduleRecords, serviceRecords, customRecordsByKey]);

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

  const loadData = useCallback(async (force = false, viewsOverride?: SavedViewConfig[]) => {
    if (!config.airtableApiKey || !config.airtableBaseId) {
      setIsConfigOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      let schemaTables: TableInfo[] = [];
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
          setViews(prev => prev.map(view => {
            if (view.id === 'default-schedule') return { ...view, pdfTitle: expectedScheduleTitle };
            if (view.id === 'default-services') return { ...view, pdfTitle: expectedServiceTitle };
            if (view.id === 'default-team') return { ...view, pdfTitle: expectedTeamTitle };
            return view;
          }));
        }
      }

      try {
        schemaTables = await fetchAirtableTables(config);
        setAvailableTables(schemaTables);
      } catch (schemaErr) {
        console.warn('Could not fetch Airtable schema, will infer fields from loaded records.', schemaErr);
      }

      const teamRes = await fetchAirtableData(config, config.teamMembersTableName || ENV.TABLE_TEAM);
      const members: TeamMember[] = teamRes.records.map(r => {
        const rawType = r.fields.Type;
        const typeStr = Array.isArray(rawType) ? rawType[0] : (rawType || 'FTM');
        
        return {
          id: r.id,
          name: r.fields.Name || 'Unknown',
          type: typeStr,
          coordinatorServiceIds: safeLinkedIds(r, 'Coordinator'),
          teamMemberServiceIds: safeLinkedIds(r, 'Team Member'),
          standbyServiceIds: safeLinkedIds(r, 'Standby')
        };
      });
      setTeamMembers(members);
      writeJsonStorage(scopedStorageKey(CACHE_KEY_TEAM, config.airtableBaseId), members);

      const mapping: NameMapping = {};
      members.forEach(m => mapping[m.id] = m.name);
      setNameMapping(mapping);
      writeJsonStorage(scopedStorageKey(CACHE_KEY_MAPPING, config.airtableBaseId), mapping);

      let loadedScheduleRecords: AirtableRecord[] = [];
      let loadedServiceRecords: AirtableRecord[] = [];

      if (config.airtableTableName) {
        const schedRes = await fetchAirtableData(config, config.airtableTableName);
        loadedScheduleRecords = schedRes.records;
        setScheduleRecords(loadedScheduleRecords);
        writeJsonStorage(scopedStorageKey(CACHE_KEY_SCHEDULE, config.airtableBaseId), schedRes.records);
      }

      if (config.serviceTableName) {
        const servRes = await fetchAirtableData(config, config.serviceTableName);
        loadedServiceRecords = servRes.records;
        setServiceRecords(loadedServiceRecords);
        writeJsonStorage(scopedStorageKey(CACHE_KEY_SERVICES, config.airtableBaseId), servRes.records);
      }

      if (schemaTables.length === 0) {
        setAvailableTables([
          tableInfoFromRecords(config.airtableTableName || ENV.TABLE_ACTIVITIES, loadedScheduleRecords),
          tableInfoFromRecords(config.serviceTableName || ENV.TABLE_SERVICES, loadedServiceRecords),
          tableInfoFromRecords(config.teamMembersTableName || ENV.TABLE_TEAM, teamRes.records),
        ]);
      }

      const viewsToLoad = viewsOverride ?? views;
      const customRequests = viewsToLoad.flatMap(view => {
        if (view.viewType === 'grouped' && view.groupedConfig?.tableName) {
          return [{ tableName: view.groupedConfig.tableName, viewName: view.groupedConfig.viewName ?? '' }];
        }
        if (view.viewType === 'linked-per-item' && view.linkedConfig) {
          return [
            { tableName: view.linkedConfig.primaryTableName, viewName: view.linkedConfig.primaryViewName ?? '' },
            { tableName: view.linkedConfig.detailTableName, viewName: view.linkedConfig.detailViewName ?? '' },
          ].filter(req => req.tableName);
        }
        return [];
      });

      customRequests.push(...linkedNameFieldRequestsForViews(viewsToLoad, schemaTables));

      const uniqueCustomRequests = Array.from(
        new Map(customRequests.map(req => [recordStoreKey(req.tableName, req.viewName), req])).values()
      );

      if (uniqueCustomRequests.length > 0) {
        const entries = await Promise.all(
          uniqueCustomRequests.map(async req => {
            const result = await fetchAirtableData(config, req.tableName, req.viewName || undefined);
            return [recordStoreKey(req.tableName, req.viewName), result.records] as const;
          })
        );
        setCustomRecordsByKey(Object.fromEntries(entries));
      } else {
        setCustomRecordsByKey({});
      }

      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem(scopedStorageKey(CACHE_KEY_TIMESTAMP, config.airtableBaseId), now);
      setDataBaseId(config.airtableBaseId);
      setStatus('Cloud Data Refreshed');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [config, views]);

  useEffect(() => {
    const hasCurrentBaseData = dataBaseId === config.airtableBaseId;
    const hasAnyData = hasCurrentBaseData && (scheduleRecords.length > 0 || serviceRecords.length > 0 || teamMembers.length > 0);
    const hasCustomViews = views.some(view => view.viewType !== 'built-in');
    const needsMetadata = !hasCurrentBaseData || availableTables.length === 0;
    const needsCustomData = !hasCurrentBaseData || (hasCustomViews && Object.keys(customRecordsByKey).length === 0);
    if ((!hasAnyData || needsMetadata || needsCustomData) && config.airtableApiKey && config.airtableBaseId) {
      loadData(false);
    }
  }, [config.airtableApiKey, config.airtableBaseId, dataBaseId, loadData, views, availableTables.length, customRecordsByKey, scheduleRecords.length, serviceRecords.length, teamMembers.length]);

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
  };

  const generatePdf = async () => {
    if (!isBuiltInView(activeView)) {
      return await generateCustomViewPdfBlob({ ...activeView, pdfTitle: formatSavedViewTitle(activeView, config) } as TabConfig, customRecordsByKey, recordNameById);
    }

    const viewMode = activeView.builtInView;
    const viewTitle = formatSavedViewTitle(activeView, config);
    const pdfConfig = {
      ...config,
      pdfTitle: viewMode === 'schedule' ? viewTitle : config.pdfTitle,
      servicePdfTitle: viewMode === 'services' ? viewTitle : config.servicePdfTitle,
      teamPdfTitle: viewMode === 'team' ? viewTitle : config.teamPdfTitle,
    };
    const options = {
        viewMode,
        schedule: scheduleRecords,
        services: visibleServiceRecords,
        teamMembers: viewMode === 'team' ? filteredTeamMembers : teamMembersWithServiceAssignments,
        serviceRecords: visibleServiceRecords,
        nameMapping
    };
    return await generatePdfBlob(options, pdfConfig);
  };

  const handleDownloadPdf = async () => {
    try {
      setStatus('Generating PDF...');
      const blob = await generatePdf();
      const title = formatSavedViewTitle(activeView, config);
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

  const handleGenerateFullReport = async (selectedViewIds: string[], images: File[]) => {
    try {
      setStatus('Processing Images...');
      // Convert images to base64 with file names (extension stripped)
      const processedImages = await Promise.all(images.map(async (file) => ({
        name: file.name.replace(/\.[^/.]+$/, ""),
        data: await convertFileToBase64(file)
      })));
      
      setStatus('Generating Full Report...');
      const selectedViews = views
        .filter(view => selectedViewIds.includes(view.id))
        .map(view => ({ ...view, pdfTitle: formatSavedViewTitle(view, config) }));
      const blob = await generateSavedViewsReportPdfBlob(
        selectedViews,
        customRecordsByKey,
        {
          schedule: scheduleRecords,
          services: visibleServiceRecords,
          teamMembers: filteredTeamMembers,
          serviceRecords: visibleServiceRecords,
          nameMapping,
        },
        processedImages,
        config,
        recordNameById
      );
      const fileName = selectedViews[0]?.pdfTitle || selectedViews[0]?.label || 'Festival_Report';
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
      const title = formatSavedViewTitle(activeView, config);
      downloadPdf(blob, `${title}.pdf`);
      setStatus('WhatsApp logic requires a public URL host');
      setTimeout(() => setStatus(null), 5000);
    } catch (err: any) {
      setError('WhatsApp Error: ' + err.message);
    }
  };

  const handleSaveViews = (nextViews: SavedViewConfig[]) => {
    setViews(nextViews);
    setViewsBaseId(config.airtableBaseId);
    writeJsonStorage(scopedStorageKey(VIEWS_STORAGE_KEY, config.airtableBaseId), nextViews);
    setStatus('Views Saved');
    setTimeout(() => setStatus(null), 2000);
    if (nextViews.some(view => view.viewType !== 'built-in')) {
      setTimeout(() => loadData(true, nextViews), 100);
    }
  };

  const handleRestoreDefaultViews = () => {
    const defaults = createDefaultViews(config);
    setViews(defaults);
    setViewsBaseId(config.airtableBaseId);
    setActiveViewId(defaults[0].id);
    writeJsonStorage(scopedStorageKey(VIEWS_STORAGE_KEY, config.airtableBaseId), defaults);
    setStatus('Default Views Restored');
    setTimeout(() => setStatus(null), 2000);
  };

  const activeTitle = formatSavedViewTitle(activeView, config);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">Festival Management</span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{activeView.label.toUpperCase()}</span>
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none mb-2">
              {activeTitle}
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
            <button onClick={() => setIsViewSettingsOpen(true)} className="group flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl shadow-sm hover:border-slate-300 transition-all active:scale-95">
              <Layers className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-sm">Views</span>
            </button>
            <button onClick={() => setIsConfigOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95">
              <SettingsIcon className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-sm">Settings</span>
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-8 no-print p-1 bg-slate-200/50 rounded-2xl w-fit">
          {views.map(view => {
            const icon = isBuiltInView(view)
              ? view.builtInView === 'schedule'
                ? <Calendar className="w-4 h-4" />
                : view.builtInView === 'services'
                  ? <ListChecks className="w-4 h-4" />
                  : <Users className="w-4 h-4" />
              : <Layers className="w-4 h-4" />;
            return (
              <button
                key={view.id}
                onClick={() => setActiveViewId(view.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${view.id === activeView.id ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {icon} {view.label}
              </button>
            );
          })}
          <button
            onClick={() => setIsViewSettingsOpen(true)}
            title="Add view"
            className="px-3 py-3 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-all"
          >
            <Plus className="w-4 h-4" />
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
              {activeBuiltInMode === 'schedule' && (
                <ScheduleTable id="schedule-capture" data={groupData(scheduleRecords)} title={activeTitle} />
              )}
              {activeBuiltInMode === 'services' && (
                <ServiceListTable id="service-capture" data={groupData(visibleServiceRecords)} title={activeTitle} nameMapping={nameMapping} />
              )}
              {activeBuiltInMode === 'team' && (
                <TeamAssignmentTable 
                  filteredMembers={filteredTeamMembers} 
                  serviceRecords={visibleServiceRecords} 
                  title={activeTitle}
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
              {activeView.viewType === 'grouped' && activeView.groupedConfig && (
                <GenericGroupedTableView
                  id={`custom-capture-${activeView.id}`}
                  records={customRecordsByKey[recordStoreKey(activeView.groupedConfig.tableName, activeView.groupedConfig.viewName ?? '')] ?? []}
                  config={activeView.groupedConfig}
                  title={activeTitle}
                  recordNameById={recordNameById}
                />
              )}
              {activeView.viewType === 'linked-per-item' && activeView.linkedConfig && (
                <GenericLinkedPerItemView
                  id={`custom-capture-${activeView.id}`}
                  primaryRecords={customRecordsByKey[recordStoreKey(activeView.linkedConfig.primaryTableName, activeView.linkedConfig.primaryViewName ?? '')] ?? []}
                  detailRecords={customRecordsByKey[recordStoreKey(activeView.linkedConfig.detailTableName, activeView.linkedConfig.detailViewName ?? '')] ?? []}
                  config={activeView.linkedConfig}
                  title={activeTitle}
                  recordNameById={recordNameById}
                />
              )}
            </div>
          )}
        </main>
      </div>

      <ConfigModal isOpen={isConfigOpen} config={config} onSave={handleSaveConfig} onClose={() => setIsConfigOpen(false)} />
      <ViewSettingsPanel
        isOpen={isViewSettingsOpen}
        views={views}
        availableTables={availableTables}
        onSaveViews={handleSaveViews}
        onRestoreDefaults={handleRestoreDefaultViews}
        onClose={() => setIsViewSettingsOpen(false)}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        views={views}
        isGenerating={!!status && status.includes('Generating')}
        onGenerate={handleGenerateFullReport}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
};

export default App;
