
import React from 'react';
import { Record as AirtableSDKRecord } from '@airtable/blocks/models';
import { GroupedViewConfig, ColumnConfig, FieldTreatment, StackedFieldConfig } from '../types';
import { Table2 } from 'lucide-react';
import { safeStr, safeLinkedNames, safeCheckbox, getOrdinalDate, cleanCategoryName } from '../services/sdkHelpers';

interface GroupedTableViewProps {
  id: string;
  sdkRecords: AirtableSDKRecord[];
  config: GroupedViewConfig;
  title: string;
}

/** Normalize backward-compat: migrate old secondaryFieldName → stackedFields[0] */
function getStackedFields(col: ColumnConfig): StackedFieldConfig[] {
  if (col.stackedFields && col.stackedFields.length > 0) return col.stackedFields;
  if (col.secondaryFieldName && col.secondaryTreatment) {
    return [{ fieldName: col.secondaryFieldName, treatment: col.secondaryTreatment }];
  }
  return [];
}

const GroupedTableView: React.FC<GroupedTableViewProps> = ({ id, sdkRecords, config, title }) => {
  const visibleColumns = config.columns.filter(c => c.treatment !== 'checkbox-highlight');
  const highlightCol = config.columns.find(c => c.treatment === 'checkbox-highlight');
  const hasSecondary = !!config.secondaryGroupField;

  const totalWeight = visibleColumns.reduce((s, c) => s + c.widthWeight, 0) || 1;
  const colWidths = visibleColumns.map(c => `${(c.widthWeight / totalWeight) * 100}%`);
  const colCount = visibleColumns.length;

  // Group records
  const grouped: Record<string, Record<string, AirtableSDKRecord[]>> = {};
  sdkRecords.forEach(record => {
    const primaryVal = config.primaryGroupField
      ? safeStr(record, config.primaryGroupField) || 'Unspecified'
      : 'All';
    const secondaryVal = hasSecondary
      ? safeStr(record, config.secondaryGroupField) || 'General'
      : '_all';
    if (!grouped[primaryVal]) grouped[primaryVal] = {};
    if (!grouped[primaryVal][secondaryVal]) grouped[primaryVal][secondaryVal] = [];
    grouped[primaryVal][secondaryVal].push(record);
  });

  if (config.sortField) {
    Object.values(grouped).forEach(secGroup =>
      Object.values(secGroup).forEach(records =>
        records.sort((a, b) =>
          safeStr(a, config.sortField).localeCompare(safeStr(b, config.sortField))
        )
      )
    );
  }

  const sortedPrimary = Object.keys(grouped).sort((a, b) => {
    if (a === 'Unspecified') return 1;
    if (b === 'Unspecified') return -1;
    return a.localeCompare(b);
  });

  if (sdkRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Table2 className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-700 font-bold text-base mb-1">No records found</p>
        <p className="text-slate-400 text-sm">
          Add records to your <strong>{config.tableName}</strong> table.
        </p>
      </div>
    );
  }

  const renderField = (
    record: AirtableSDKRecord,
    fieldName: string,
    treatment: FieldTreatment | string,
    isSelected: boolean,
    small = false,
    overrideFontSize?: number,
    overrideFontWeight?: 'normal' | 'bold',
  ) => {
    const highlight = isSelected ? 'text-red-600' : '';
    const style: React.CSSProperties = {
      fontSize: overrideFontSize ? `${overrideFontSize}px` : undefined,
      fontWeight: overrideFontWeight,
    };
    if (treatment === 'text') {
      const defaultSize = small ? 'text-[10px]' : 'text-[12px]';
      return (
        <p className={`${overrideFontSize ? '' : defaultSize} font-medium leading-tight ${highlight || (small ? 'text-slate-500' : 'text-slate-700')}`} style={style}>
          {safeStr(record, fieldName) || '-'}
        </p>
      );
    }
    if (treatment === 'linked-names') {
      const defaultSize = small ? 'text-[9px]' : 'text-[11px]';
      return (
        <p className={`${overrideFontSize ? '' : defaultSize} font-medium leading-tight ${highlight || (small ? 'text-slate-400' : 'text-slate-600')}`} style={style}>
          {safeLinkedNames(record, fieldName)}
        </p>
      );
    }
    // 'highlight' treatment — also handles legacy 'timing' values from old saved configs
    if (treatment === 'highlight' || treatment === 'timing') {
      const val = safeStr(record, fieldName);
      if (!val) return <span className="text-slate-300 text-[10px]">—</span>;
      const defaultSize = small ? 'text-[8px]' : 'text-[10px]';
      return (
        <div
          className={`inline-flex items-center bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-tight ${isSelected ? 'text-red-600' : 'text-amber-700'} ${overrideFontSize ? '' : defaultSize}`}
          style={style}
        >
          {val}
        </div>
      );
    }
    return null;
  };

  const renderCell = (record: AirtableSDKRecord, col: ColumnConfig, isSelected: boolean) => {
    const stackedFields = getStackedFields(col);
    const primary = renderField(record, col.fieldName, col.treatment as FieldTreatment, isSelected, false, col.fontSize, col.fontWeight);
    if (stackedFields.length > 0) {
      return (
        <div className="flex flex-col gap-1">
          {primary}
          {stackedFields.map((sf, i) => (
            <React.Fragment key={i}>
              {renderField(record, sf.fieldName, sf.treatment, isSelected, true, sf.fontSize, sf.fontWeight)}
            </React.Fragment>
          ))}
        </div>
      );
    }
    return primary;
  };

  return (
    <div className="bg-white relative">
      <style>{`
        .gtv-keep { page-break-inside: avoid !important; break-inside: avoid !important; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div id={id} className="bg-white p-6 max-w-full text-slate-900">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-1">{title}</h2>
          <div className="h-1 w-12 bg-amber-500 mx-auto mt-2 rounded-full" />
        </div>

        <table className="w-full border-collapse">
          <tbody>
            {sortedPrimary.map(primaryKey => (
              <React.Fragment key={primaryKey}>
                {primaryKey !== 'All' && (
                  <tr className="gtv-keep">
                    <td colSpan={colCount} className="pt-9 pb-2 text-center">
                      <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-400">
                        {getOrdinalDate(primaryKey)}
                      </h3>
                    </td>
                  </tr>
                )}

                {Object.entries(grouped[primaryKey])
                  .sort(([a], [b]) => {
                    const numA = parseInt(a.match(/^\d+/)?.[0] ?? '999', 10);
                    const numB = parseInt(b.match(/^\d+/)?.[0] ?? '999', 10);
                    return numA !== numB ? numA - numB : a.localeCompare(b);
                  })
                  .map(([secKey, records]) => (
                    <React.Fragment key={secKey}>
                      {hasSecondary && (
                        <tr className="gtv-keep">
                          <td colSpan={colCount} className="bg-slate-900 p-0">
                            <div className="py-2 px-4 text-center">
                              <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                {cleanCategoryName(secKey)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}

                      <tr className="border-b border-slate-300 bg-slate-50">
                        {visibleColumns.map((col, i) => (
                          <th
                            key={col.fieldName + i}
                            className={`py-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-${col.alignment}`}
                            style={{ width: colWidths[i] }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>

                      {records.map((record, idx) => {
                        const isSelected = highlightCol
                          ? safeCheckbox(record, highlightCol.fieldName)
                          : false;
                        return (
                          <tr
                            key={record.id}
                            className={`border-b border-slate-100 gtv-keep ${idx % 2 === 1 ? 'bg-slate-200' : 'bg-white'}`}
                          >
                            {visibleColumns.map((col, ci) => (
                              <td
                                key={col.fieldName + ci}
                                className={`py-3 px-2 align-top text-${col.alignment}`}
                              >
                                {renderCell(record, col, isSelected)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        <div className="mt-10 border-t border-slate-100 pt-6 flex justify-between items-center opacity-30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {title} &bull; {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GroupedTableView;
