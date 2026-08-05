import React from 'react';
import { AirtableRecord, ColumnConfig, FieldTreatment, GroupedViewConfig, StackedFieldConfig } from '../types';
import { Table2 } from 'lucide-react';
import { cleanCategoryName, getOrdinalDate, safeCheckbox, safeLinkedNames, safeStr } from '../services/recordHelpers';

interface GenericGroupedTableViewProps {
  id: string;
  records: AirtableRecord[];
  config: GroupedViewConfig;
  title: string;
  recordNameById?: Record<string, string>;
}

function getStackedFields(col: ColumnConfig): StackedFieldConfig[] {
  if (col.stackedFields && col.stackedFields.length > 0) return col.stackedFields;
  if (col.secondaryFieldName && col.secondaryTreatment) {
    return [{ fieldName: col.secondaryFieldName, treatment: col.secondaryTreatment }];
  }
  return [];
}

const GenericGroupedTableView: React.FC<GenericGroupedTableViewProps> = ({ id, records, config, title, recordNameById = {} }) => {
  const visibleColumns = config.columns.filter(c => c.treatment !== 'checkbox-highlight');
  const highlightCol = config.columns.find(c => c.treatment === 'checkbox-highlight');
  const hasSecondary = !!config.secondaryGroupField;
  const totalWeight = visibleColumns.reduce((s, c) => s + c.widthWeight, 0) || 1;
  const colWidths = visibleColumns.map(c => `${(c.widthWeight / totalWeight) * 100}%`);
  const colCount = Math.max(visibleColumns.length, 1);

  const grouped = records.reduce((acc, record) => {
    const primary = config.primaryGroupField ? safeStr(record, config.primaryGroupField) || 'Unspecified' : 'All';
    const secondary = hasSecondary ? safeStr(record, config.secondaryGroupField) || 'General' : '_all';
    if (!acc[primary]) acc[primary] = {};
    if (!acc[primary][secondary]) acc[primary][secondary] = [];
    acc[primary][secondary].push(record);
    return acc;
  }, {} as Record<string, Record<string, AirtableRecord[]>>);

  if (config.sortField) {
    Object.values(grouped).forEach(secGroup => {
      Object.values(secGroup).forEach(groupRecords => {
        groupRecords.sort((a, b) => safeStr(a, config.sortField).localeCompare(safeStr(b, config.sortField)));
      });
    });
  }

  const sortedPrimary = Object.keys(grouped).sort((a, b) => {
    if (a === 'Unspecified') return 1;
    if (b === 'Unspecified') return -1;
    return a.localeCompare(b);
  });

  const renderField = (
    record: AirtableRecord,
    fieldName: string,
    treatment: FieldTreatment | string,
    isSelected: boolean,
    small = false,
    fontSize?: number,
    fontWeight?: 'normal' | 'bold',
  ) => {
    const style: React.CSSProperties = {
      fontSize: fontSize ? `${fontSize}px` : undefined,
      fontWeight,
    };
    const selectedClass = isSelected ? 'text-red-600' : '';

    if (treatment === 'linked-names') {
      return (
        <p className={`${fontSize ? '' : small ? 'text-[9px]' : 'text-[11px]'} font-medium leading-tight ${selectedClass || (small ? 'text-slate-400' : 'text-slate-600')}`} style={style}>
          {safeLinkedNames(record, fieldName, recordNameById)}
        </p>
      );
    }

    if (treatment === 'highlight' || treatment === 'timing') {
      const value = safeStr(record, fieldName, recordNameById);
      if (!value) return <span className="text-slate-300 text-[10px]">-</span>;
      return (
        <span
          className={`inline-flex items-center bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md font-bold uppercase ${fontSize ? '' : small ? 'text-[8px]' : 'text-[10px]'} ${isSelected ? 'text-red-600' : 'text-amber-700'}`}
          style={style}
        >
          {value}
        </span>
      );
    }

    return (
      <p className={`${fontSize ? '' : small ? 'text-[10px]' : 'text-[12px]'} font-medium leading-tight ${selectedClass || (small ? 'text-slate-500' : 'text-slate-700')}`} style={style}>
        {safeStr(record, fieldName, recordNameById) || '-'}
      </p>
    );
  };

  const renderCell = (record: AirtableRecord, col: ColumnConfig, isSelected: boolean) => {
    const stackedFields = getStackedFields(col);
    return (
      <div className="flex flex-col gap-1">
        {renderField(record, col.fieldName, col.treatment, isSelected, false, col.fontSize, col.fontWeight)}
        {stackedFields.map((sf, idx) => (
          <React.Fragment key={idx}>
            {renderField(record, sf.fieldName, sf.treatment, isSelected, true, sf.fontSize, sf.fontWeight)}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Table2 className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-700 font-bold text-base mb-1">No records found</p>
        <p className="text-slate-400 text-sm">Add records to the {config.tableName || 'selected'} table.</p>
      </div>
    );
  }

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

        {visibleColumns.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm font-bold">No columns configured for this view.</div>
        ) : (
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
                    .map(([secondaryKey, groupRecords]) => (
                      <React.Fragment key={secondaryKey}>
                        {hasSecondary && (
                          <tr className="gtv-keep">
                            <td colSpan={colCount} className="bg-slate-900 p-0">
                              <div className="py-2 px-4 text-center">
                                <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                  {cleanCategoryName(secondaryKey)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}

                        <tr className="border-b border-slate-300 bg-slate-50">
                          {visibleColumns.map((col, idx) => (
                            <th
                              key={`${col.fieldName}-${idx}`}
                              className={`py-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-${col.alignment}`}
                              style={{ width: colWidths[idx] }}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>

                        {groupRecords.map((record, idx) => {
                          const isSelected = highlightCol ? safeCheckbox(record, highlightCol.fieldName) : false;
                          return (
                            <tr key={record.id} className={`border-b border-slate-100 gtv-keep ${idx % 2 === 1 ? 'bg-slate-200' : 'bg-white'}`}>
                              {visibleColumns.map((col, colIdx) => (
                                <td key={`${col.fieldName}-${colIdx}`} className={`py-3 px-2 align-top text-${col.alignment}`}>
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
        )}

        <div className="mt-10 border-t border-slate-100 pt-6 flex justify-between items-center opacity-30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {title} &bull; {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GenericGroupedTableView;
