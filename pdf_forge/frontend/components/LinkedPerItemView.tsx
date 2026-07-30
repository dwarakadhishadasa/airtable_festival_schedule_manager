
import React, { useState, useMemo, useCallback } from 'react';
import { Record as AirtableSDKRecord } from '@airtable/blocks/models';
import { LinkedPerItemConfig, DetailColumnConfig, StackedFieldConfig, LINK_LABEL_FIELD } from '../types';
import { Search, Filter, UserX, UserCheck, Users } from 'lucide-react';
import { safeStr, safeLinkedIds, safeLinkedNames } from '../services/sdkHelpers';

interface LinkedPerItemViewProps {
  id: string;
  primaryRecords: AirtableSDKRecord[];
  detailRecords: AirtableSDKRecord[];
  config: LinkedPerItemConfig;
  title: string;
}

interface AssignedRow {
  detailRecord: AirtableSDKRecord;
  linkLabel: string;
  sortValue: string;
}

/** Normalize backward-compat: migrate old secondaryFieldName → stackedFields[0] */
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

const LinkedPerItemView: React.FC<LinkedPerItemViewProps> = ({
  id, primaryRecords, detailRecords, config, title,
}) => {
  // Normalize for backward compatibility with configs saved before this version
  const detailColumns = config.detailColumns ?? [];
  const linkFields = config.linkFields ?? [];

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const detailMap = useMemo(() => {
    const map: Record<string, AirtableSDKRecord> = {};
    detailRecords.forEach(r => { map[r.id] = r; });
    return map;
  }, [detailRecords]);

  const uniqueTypes = useMemo(() => {
    if (!config.typeField) return [];
    const types = new Set(
      primaryRecords.map(r => safeStr(r, config.typeField)).filter(Boolean)
    );
    return ['All', ...Array.from(types).sort()];
  }, [primaryRecords, config.typeField]);

  const getMemberRows = useCallback((record: AirtableSDKRecord): AssignedRow[] => {
    const rows: AssignedRow[] = [];
    linkFields.forEach(lf => {
      safeLinkedIds(record, lf.fieldName).forEach(id => {
        const detail = detailMap[id];
        if (!detail) return;
        const sortVal = config.detailSortField ? safeStr(detail, config.detailSortField) : '9999';
        rows.push({ detailRecord: detail, linkLabel: lf.label, sortValue: sortVal });
      });
    });
    return rows.sort((a, b) => a.sortValue.localeCompare(b.sortValue));
  }, [detailMap, config]);

  const filteredPrimary = useMemo(() => {
    return primaryRecords
      .filter(record => {
        const name = safeStr(record, config.nameField);
        if (!name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (config.typeField && typeFilter !== 'All') {
          if (safeStr(record, config.typeField) !== typeFilter) return false;
        }
        if (statusFilter === 'all') return true;
        const assignCount = linkFields.reduce((n, lf) => {
          return n + safeLinkedIds(record, lf.fieldName).filter(id => !!detailMap[id]).length;
        }, 0);
        return statusFilter === 'assigned' ? assignCount > 0 : assignCount === 0;
      })
      .sort((a, b) =>
        safeStr(a, config.nameField).localeCompare(safeStr(b, config.nameField))
      );
  }, [primaryRecords, searchTerm, typeFilter, statusFilter, detailMap, config]);

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('All');
    setStatusFilter('all');
  };

  // ── Column widths ──
  const totalWeight = detailColumns.reduce((s, c) => s + (c.widthWeight ?? 1), 0) || 1;
  const colWidths = detailColumns.map(c => `${((c.widthWeight ?? 1) / totalWeight) * 100}%`);

  // ── Grouping ──
  const gf = config.detailGroupByField;
  const buildGroups = (rows: AssignedRow[]): { key: string; label: string; rows: AssignedRow[] }[] => {
    if (!gf) return [{ key: '_all', label: '', rows }];
    const map: Record<string, AssignedRow[]> = {};
    rows.forEach(row => {
      const key = safeStr(row.detailRecord, gf) || 'Other';
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, groupRows]) => ({ key, label: key, rows: groupRows }));
  };

  // ── Field rendering ──
  const renderDetailField = (
    record: AirtableSDKRecord,
    fieldName: string,
    treatment: DetailColumnConfig['treatment'] | string,
    showInlineFieldName: boolean | undefined,
    linkLabel: string,
    small = false,
    overrideFontSize?: number,
    overrideFontWeight?: 'normal' | 'bold',
  ) => {
    const style: React.CSSProperties = {
      fontSize: overrideFontSize ? `${overrideFontSize}px` : undefined,
      fontWeight: overrideFontWeight,
    };

    if (treatment === 'link-label') {
      const defaultSize = small ? 'text-[8px]' : 'text-[9px]';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold uppercase tracking-wide bg-slate-100 text-slate-600 ${overrideFontSize ? '' : defaultSize}`} style={style}>
          {linkLabel}
        </span>
      );
    }

    const prefix = (showInlineFieldName && fieldName !== LINK_LABEL_FIELD) ? (
      <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">{fieldName}:{' '}</span>
    ) : null;

    if (treatment === 'text') {
      const defaultSize = small ? 'text-[10px]' : 'text-[12px]';
      return (
        <p className={`${overrideFontSize ? '' : defaultSize} font-medium leading-tight text-slate-700`} style={style}>
          {prefix}{safeStr(record, fieldName) || '-'}
        </p>
      );
    }
    if (treatment === 'linked-names') {
      const defaultSize = small ? 'text-[9px]' : 'text-[11px]';
      return (
        <p className={`${overrideFontSize ? '' : defaultSize} font-medium leading-tight text-slate-600`} style={style}>
          {prefix}{safeLinkedNames(record, fieldName)}
        </p>
      );
    }
    // 'highlight' treatment — also handles legacy 'timing' values from old saved configs
    if (treatment === 'highlight' || treatment === 'timing') {
      const val = safeStr(record, fieldName);
      if (!val) return <span className="text-slate-300 text-[10px]">—</span>;
      const defaultSize = small ? 'text-[8px]' : 'text-[10px]';
      return (
        <div className={`inline-flex items-center gap-1 ${overrideFontSize ? '' : defaultSize}`}>
          {prefix}
          <div
            className={`inline-flex items-center bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-tight text-amber-700`}
            style={style}
          >
            {val}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderDetailCell = (row: AssignedRow, col: DetailColumnConfig) => {
    const stackedFields = getDetailStackedFields(col);
    const primary = renderDetailField(row.detailRecord, col.fieldName, col.treatment, col.showInlineFieldName, row.linkLabel, false, col.fontSize, col.fontWeight);
    if (stackedFields.length > 0) {
      return (
        <div className="flex flex-col gap-1">
          {primary}
          {stackedFields.map((sf, i) => (
            <React.Fragment key={i}>
              {renderDetailField(row.detailRecord, sf.fieldName, sf.treatment, sf.showInlineFieldName, row.linkLabel, true, sf.fontSize, sf.fontWeight)}
            </React.Fragment>
          ))}
        </div>
      );
    }
    return primary;
  };

  return (
    <div className="bg-white">
      <style>{`
        .lip-keep { page-break-inside: avoid; break-inside: avoid; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* Filter Toolbar */}
      <div className="no-print p-6 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${config.nameField.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all text-sm font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {uniqueTypes.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all cursor-pointer"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          {(['all', 'assigned', 'unassigned'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === s ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              {s === 'all' && <Users className="w-3.5 h-3.5" />}
              {s === 'assigned' && <UserCheck className="w-3.5 h-3.5" />}
              {s === 'unassigned' && <UserX className="w-3.5 h-3.5" />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
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
            <button
              onClick={resetFilters}
              className="mt-4 text-xs font-black text-amber-600 uppercase tracking-widest hover:underline no-print"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredPrimary.map(record => {
              const name = safeStr(record, config.nameField);
              const type = config.typeField ? safeStr(record, config.typeField) : '';
              const rows = getMemberRows(record);
              const groups = buildGroups(rows);

              return (
                <div key={record.id} className="lip-keep">
                  <div className="flex items-center gap-3 mb-3 border-b-2 border-slate-900 pb-2">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {name.charAt(0).toUpperCase() || '?'}
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">{name}</h3>
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
                            {detailColumns.map((col, i) => (
                              <th
                                key={i}
                                className={`px-4 py-3 text-${col.alignment ?? 'left'}`}
                                style={{ width: colWidths[i] }}
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groups.map(({ key, label: groupLabel, rows: groupRows }) => (
                            <React.Fragment key={key}>
                              {gf && groupLabel && (
                                <tr>
                                  <td colSpan={detailColumns.length} className="bg-slate-800 px-4 py-1.5">
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                      {groupLabel}
                                    </span>
                                  </td>
                                </tr>
                              )}
                              {groupRows.map((row, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                  {detailColumns.map((col, ci) => (
                                    <td key={ci} className={`px-4 py-3 align-top text-${col.alignment ?? 'left'}`}>
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

export default LinkedPerItemView;
