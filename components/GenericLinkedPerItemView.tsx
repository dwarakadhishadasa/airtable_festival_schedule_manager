import React, { useCallback, useMemo, useState } from 'react';
import { AirtableRecord, DetailColumnConfig, LinkedPerItemConfig, StackedFieldConfig, LINK_LABEL_FIELD } from '../types';
import { Filter, Search, UserCheck, UserX, Users } from 'lucide-react';
import { safeLinkedIds, safeLinkedNames, safeStr } from '../services/recordHelpers';

interface GenericLinkedPerItemViewProps {
  id: string;
  primaryRecords: AirtableRecord[];
  detailRecords: AirtableRecord[];
  config: LinkedPerItemConfig;
  title: string;
  recordNameById?: Record<string, string>;
}

interface AssignedRow {
  detailRecord: AirtableRecord;
  linkLabel: string;
  sortValue: string;
}

function getDetailStackedFields(col: DetailColumnConfig): StackedFieldConfig[] {
  if (col.stackedFields && col.stackedFields.length > 0) return col.stackedFields;
  if (col.secondaryFieldName && col.secondaryTreatment) {
    return [{
      fieldName: col.secondaryFieldName,
      treatment: col.secondaryTreatment,
      showInlineFieldName: col.secondaryShowInlineFieldName,
    }];
  }
  return [];
}

const GenericLinkedPerItemView: React.FC<GenericLinkedPerItemViewProps> = ({ id, primaryRecords, detailRecords, config, title, recordNameById = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const detailColumns = config.detailColumns ?? [];
  const linkFields = config.linkFields ?? [];

  const detailMap = useMemo(() => {
    const map: Record<string, AirtableRecord> = {};
    detailRecords.forEach(record => { map[record.id] = record; });
    return map;
  }, [detailRecords]);

  const uniqueTypes = useMemo(() => {
    if (!config.typeField) return [];
    const types = new Set(primaryRecords.map(record => safeStr(record, config.typeField)).filter(Boolean));
    return ['All', ...Array.from(types).sort()];
  }, [primaryRecords, config.typeField]);

  const getRows = useCallback((record: AirtableRecord): AssignedRow[] => {
    const rows: AssignedRow[] = [];
    linkFields.forEach(linkField => {
      safeLinkedIds(record, linkField.fieldName).forEach(id => {
        const detail = detailMap[id];
        if (!detail) return;
        const sortValue = config.detailSortField ? safeStr(detail, config.detailSortField) : '9999';
        rows.push({ detailRecord: detail, linkLabel: linkField.label, sortValue });
      });
    });
    return rows.sort((a, b) => a.sortValue.localeCompare(b.sortValue));
  }, [detailMap, linkFields, config.detailSortField]);

  const filteredPrimary = useMemo(() => {
    return primaryRecords
      .filter(record => {
        const name = safeStr(record, config.nameField);
        if (!name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (config.typeField && typeFilter !== 'All' && safeStr(record, config.typeField) !== typeFilter) return false;
        if (statusFilter === 'all') return true;
        const assignmentCount = linkFields.reduce((count, linkField) => {
          return count + safeLinkedIds(record, linkField.fieldName).filter(id => !!detailMap[id]).length;
        }, 0);
        return statusFilter === 'assigned' ? assignmentCount > 0 : assignmentCount === 0;
      })
      .sort((a, b) => safeStr(a, config.nameField).localeCompare(safeStr(b, config.nameField)));
  }, [primaryRecords, config.nameField, config.typeField, searchTerm, typeFilter, statusFilter, linkFields, detailMap]);

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('All');
    setStatusFilter('all');
  };

  const totalWeight = detailColumns.reduce((sum, col) => sum + (col.widthWeight ?? 1), 0) || 1;
  const colWidths = detailColumns.map(col => `${((col.widthWeight ?? 1) / totalWeight) * 100}%`);

  const buildGroups = (rows: AssignedRow[]) => {
    if (!config.detailGroupByField) return [{ key: '_all', label: '', rows }];
    const map: Record<string, AssignedRow[]> = {};
    rows.forEach(row => {
      const key = safeStr(row.detailRecord, config.detailGroupByField) || 'Other';
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, groupRows]) => ({ key, label: key, rows: groupRows }));
  };

  const renderDetailField = (
    row: AssignedRow,
    fieldName: string,
    treatment: DetailColumnConfig['treatment'] | string,
    showInlineFieldName?: boolean,
    small = false,
    fontSize?: number,
    fontWeight?: 'normal' | 'bold',
  ) => {
    const style: React.CSSProperties = {
      fontSize: fontSize ? `${fontSize}px` : undefined,
      fontWeight,
    };

    if (treatment === 'link-label') {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold uppercase tracking-wide bg-slate-100 text-slate-600 ${fontSize ? '' : small ? 'text-[8px]' : 'text-[9px]'}`} style={style}>
          {row.linkLabel}
        </span>
      );
    }

    const prefix = showInlineFieldName && fieldName !== LINK_LABEL_FIELD ? (
      <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">{fieldName}: </span>
    ) : null;

    if (treatment === 'linked-names') {
      return (
        <p className={`${fontSize ? '' : small ? 'text-[9px]' : 'text-[11px]'} font-medium leading-tight text-slate-600`} style={style}>
          {prefix}{safeLinkedNames(row.detailRecord, fieldName, recordNameById)}
        </p>
      );
    }

    if (treatment === 'highlight' || treatment === 'timing') {
      const value = safeStr(row.detailRecord, fieldName, recordNameById);
      if (!value) return <span className="text-slate-300 text-[10px]">-</span>;
      return (
        <div className={`inline-flex items-center gap-1 ${fontSize ? '' : small ? 'text-[8px]' : 'text-[10px]'}`}>
          {prefix}
          <span className="inline-flex items-center bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-tight text-amber-700" style={style}>
            {value}
          </span>
        </div>
      );
    }

    return (
      <p className={`${fontSize ? '' : small ? 'text-[10px]' : 'text-[12px]'} font-medium leading-tight text-slate-700`} style={style}>
        {prefix}{safeStr(row.detailRecord, fieldName, recordNameById) || '-'}
      </p>
    );
  };

  const renderDetailCell = (row: AssignedRow, col: DetailColumnConfig) => {
    const stackedFields = getDetailStackedFields(col);
    return (
      <div className="flex flex-col gap-1">
        {renderDetailField(row, col.fieldName, col.treatment, col.showInlineFieldName, false, col.fontSize, col.fontWeight)}
        {stackedFields.map((sf, idx) => (
          <React.Fragment key={idx}>
            {renderDetailField(row, sf.fieldName, sf.treatment, sf.showInlineFieldName, true, sf.fontSize, sf.fontWeight)}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white">
      <style>{`
        .lip-keep { page-break-inside: avoid; break-inside: avoid; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="no-print p-6 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${config.nameField || 'records'}...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all text-sm font-medium"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
          />
        </div>

        {uniqueTypes.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all cursor-pointer"
              value={typeFilter}
              onChange={event => setTypeFilter(event.target.value)}
            >
              {uniqueTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        )}

        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          {(['all', 'assigned', 'unassigned'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${statusFilter === status ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              {status === 'all' && <Users className="w-3.5 h-3.5" />}
              {status === 'assigned' && <UserCheck className="w-3.5 h-3.5" />}
              {status === 'unassigned' && <UserX className="w-3.5 h-3.5" />}
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-auto">
          {filteredPrimary.length} Results
        </div>
      </div>

      <div id={id} className="bg-white p-8 md:p-12 text-slate-900 min-h-screen">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-1">{title}</h2>
          <div className="h-1.5 w-24 bg-amber-500 mx-auto mt-4 rounded-full" />
        </div>

        {filteredPrimary.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <UserX className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-bold uppercase tracking-widest opacity-50">No records found</p>
            <button onClick={resetFilters} className="mt-4 text-xs font-black text-amber-600 uppercase tracking-widest hover:underline no-print">
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredPrimary.map(record => {
              const name = safeStr(record, config.nameField);
              const type = config.typeField ? safeStr(record, config.typeField) : '';
              const rows = getRows(record);
              const groups = buildGroups(rows);

              return (
                <div key={record.id} className="lip-keep">
                  <div className="flex items-center gap-3 mb-3 border-b-2 border-slate-900 pb-2">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {name.charAt(0).toUpperCase() || '?'}
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">{name || 'Untitled'}</h3>
                    {type && (
                      <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded uppercase tracking-wider">
                        {type}
                      </span>
                    )}
                  </div>

                  {rows.length > 0 && detailColumns.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            {detailColumns.map((col, idx) => (
                              <th key={idx} className={`px-4 py-3 text-${col.alignment ?? 'left'}`} style={{ width: colWidths[idx] }}>
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groups.map(({ key, label, rows: groupRows }) => (
                            <React.Fragment key={key}>
                              {config.detailGroupByField && label && (
                                <tr>
                                  <td colSpan={detailColumns.length} className="bg-slate-800 px-4 py-1.5">
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{label}</span>
                                  </td>
                                </tr>
                              )}
                              {groupRows.map((row, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                  {detailColumns.map((col, colIdx) => (
                                    <td key={colIdx} className={`px-4 py-3 align-top text-${col.alignment ?? 'left'}`}>
                                      {renderDetailCell(row, col)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                      No assignments scheduled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-16 border-t border-slate-100 pt-8 flex justify-between items-center opacity-40">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {title} &bull; {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GenericLinkedPerItemView;
