import React, { useEffect, useState } from 'react';
import {
  BuiltInTabConfig,
  ColumnConfig,
  DetailColumnConfig,
  GenericViewType,
  GroupedViewConfig,
  LinkedPerItemConfig,
  LINK_LABEL_FIELD,
  SavedViewConfig,
  StackedFieldConfig,
  TableInfo,
  TabConfig,
} from '../types';
import { ArrowDown, ArrowUp, ChevronLeft, GripVertical, Layers, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';

interface ViewSettingsPanelProps {
  isOpen: boolean;
  views: SavedViewConfig[];
  availableTables: TableInfo[];
  onSaveViews: (views: SavedViewConfig[]) => void;
  onRestoreDefaults: () => void;
  onClose: () => void;
}

type EditorState =
  | { mode: 'list' }
  | { mode: 'new' }
  | { mode: 'edit'; view: SavedViewConfig };

const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30';
const miniInputCls = 'w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500/30';
const labelCls = 'block text-[11px] font-bold text-slate-500 uppercase mb-1';

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function isBuiltIn(view: SavedViewConfig): view is BuiltInTabConfig {
  return view.viewType === 'built-in';
}

function defaultGroupedConfig(tableName: string): GroupedViewConfig {
  return { tableName, viewName: '', primaryGroupField: '', secondaryGroupField: '', sortField: '', columns: [] };
}

function defaultLinkedConfig(tableName: string): LinkedPerItemConfig {
  return {
    primaryTableName: tableName,
    primaryViewName: '',
    nameField: '',
    typeField: '',
    detailTableName: '',
    detailViewName: '',
    linkFields: [],
    detailSortField: '',
    detailGroupByField: '',
    detailColumns: [],
  };
}

function defaultColumn(fieldName: string): ColumnConfig {
  return { fieldName, label: fieldName, alignment: 'left', widthWeight: 2, treatment: 'text', stackedFields: [] };
}

function defaultDetailColumn(fieldName: string): DetailColumnConfig {
  const isLinkLabel = fieldName === LINK_LABEL_FIELD;
  return {
    fieldName,
    label: isLinkLabel ? 'Type' : fieldName,
    treatment: isLinkLabel ? 'link-label' : 'text',
    alignment: 'left',
    widthWeight: 2,
    showInlineFieldName: false,
    stackedFields: [],
  };
}

const LabeledInput: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <input className={inputCls} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
  </div>
);

const LabeledSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  optional?: boolean;
}> = ({ label, value, onChange, options, optional }) => (
  <div>
    <label className={labelCls}>{label}{optional && <span className="text-slate-300 ml-1">(optional)</span>}</label>
    <select className={inputCls} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{optional ? 'None' : 'Select...'}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>
);

const BuiltInEditor: React.FC<{
  view: BuiltInTabConfig;
  onSave: (view: BuiltInTabConfig) => void;
  onCancel: () => void;
}> = ({ view, onSave, onCancel }) => {
  const [label, setLabel] = useState(view.label);
  const [pdfTitle, setPdfTitle] = useState(view.pdfTitle);

  return (
    <div className="space-y-5">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-bold transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <h3 className="text-base font-black text-slate-900">Edit Built-in View</h3>
      <LabeledInput label="Tab Label" value={label} onChange={setLabel} />
      <LabeledInput label="PDF Title" value={pdfTitle} onChange={setPdfTitle} />
      <button
        onClick={() => onSave({ ...view, label: label.trim() || view.label, pdfTitle: pdfTitle.trim() || label.trim() || view.pdfTitle })}
        className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
      >
        Save View
      </button>
    </div>
  );
};

const GenericViewEditor: React.FC<{
  tab: TabConfig | null;
  availableTables: TableInfo[];
  onSave: (tab: TabConfig) => void;
  onCancel: () => void;
}> = ({ tab, availableTables, onSave, onCancel }) => {
  const firstTable = availableTables[0]?.name ?? '';
  const [label, setLabel] = useState(tab?.label ?? '');
  const [pdfTitle, setPdfTitle] = useState(tab?.pdfTitle ?? '');
  const [viewType, setViewType] = useState<GenericViewType>(tab?.viewType ?? 'grouped');
  const [groupedCfg, setGroupedCfg] = useState<GroupedViewConfig>(tab?.groupedConfig ?? defaultGroupedConfig(firstTable));
  const [linkedCfg, setLinkedCfg] = useState<LinkedPerItemConfig>(tab?.linkedConfig ?? defaultLinkedConfig(firstTable));

  const tableOptions = availableTables.map(table => ({ value: table.name, label: table.name }));
  const fieldsFor = (tableName: string) => (availableTables.find(table => table.name === tableName)?.fields ?? []).map(field => ({ value: field.name, label: field.name }));
  const viewsFor = (tableName: string) => (availableTables.find(table => table.name === tableName)?.views ?? []).map(view => ({ value: view.name, label: view.name }));

  const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const updateColumn = (idx: number, patch: Partial<ColumnConfig>) => {
    setGroupedCfg(prev => ({ ...prev, columns: prev.columns.map((col, colIdx) => colIdx === idx ? { ...col, ...patch } : col) }));
  };

  const addStackedField = (idx: number) => {
    const firstField = fieldsFor(groupedCfg.tableName)[0]?.value ?? '';
    setGroupedCfg(prev => ({
      ...prev,
      columns: prev.columns.map((col, colIdx) => colIdx === idx
        ? { ...col, stackedFields: [...(col.stackedFields ?? []), { fieldName: firstField, treatment: 'text' }] }
        : col
      ),
    }));
  };

  const updateStackedField = (colIdx: number, sfIdx: number, patch: Partial<StackedFieldConfig>) => {
    setGroupedCfg(prev => ({
      ...prev,
      columns: prev.columns.map((col, idx) => idx === colIdx
        ? { ...col, stackedFields: (col.stackedFields ?? []).map((sf, nextIdx) => nextIdx === sfIdx ? { ...sf, ...patch } : sf) }
        : col
      ),
    }));
  };

  const removeStackedField = (colIdx: number, sfIdx: number) => {
    setGroupedCfg(prev => ({
      ...prev,
      columns: prev.columns.map((col, idx) => idx === colIdx
        ? { ...col, stackedFields: (col.stackedFields ?? []).filter((_, nextIdx) => nextIdx !== sfIdx) }
        : col
      ),
    }));
  };

  const updateDetailColumn = (idx: number, patch: Partial<DetailColumnConfig>) => {
    setLinkedCfg(prev => ({ ...prev, detailColumns: prev.detailColumns.map((col, colIdx) => colIdx === idx ? { ...col, ...patch } : col) }));
  };

  const handleSave = () => {
    onSave({
      id: tab?.id ?? newId(),
      label: label.trim() || 'Untitled View',
      pdfTitle: pdfTitle.trim() || label.trim() || 'Untitled View',
      viewType,
      groupedConfig: viewType === 'grouped' ? groupedCfg : undefined,
      linkedConfig: viewType === 'linked-per-item' ? linkedCfg : undefined,
    });
  };

  const groupedFields = fieldsFor(groupedCfg.tableName);
  const primaryFields = fieldsFor(linkedCfg.primaryTableName);
  const detailFields = fieldsFor(linkedCfg.detailTableName);

  return (
    <div className="space-y-6">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-bold transition-colors">
        <ChevronLeft className="w-4 h-4" /> {tab ? 'Back' : 'Cancel'}
      </button>

      <h3 className="text-base font-black text-slate-900">{tab ? 'Edit View' : 'New View'}</h3>
      <LabeledInput label="Tab Label" value={label} onChange={setLabel} placeholder="e.g. Kitchen Team" />
      <LabeledInput label="PDF Title" value={pdfTitle} onChange={setPdfTitle} placeholder="Defaults to tab label" />

      <div>
        <label className={labelCls}>View Type</label>
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {(['grouped', 'linked-per-item'] as GenericViewType[]).map(type => (
            <button
              key={type}
              onClick={() => setViewType(type)}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewType === type ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {type === 'grouped' ? 'Grouped Table' : 'Linked Per Item'}
            </button>
          ))}
        </div>
      </div>

      {viewType === 'grouped' && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grouped Table Settings</p>
          <LabeledSelect
            label="Table"
            value={groupedCfg.tableName}
            onChange={value => setGroupedCfg({ ...defaultGroupedConfig(value) })}
            options={tableOptions}
          />
          {groupedCfg.tableName && (
            <>
              <LabeledSelect label="Airtable View" value={groupedCfg.viewName ?? ''} onChange={value => setGroupedCfg(prev => ({ ...prev, viewName: value }))} options={viewsFor(groupedCfg.tableName)} optional />
              <LabeledSelect label="Group by" value={groupedCfg.primaryGroupField} onChange={value => setGroupedCfg(prev => ({ ...prev, primaryGroupField: value }))} options={groupedFields} optional />
              <LabeledSelect label="Then group by" value={groupedCfg.secondaryGroupField} onChange={value => setGroupedCfg(prev => ({ ...prev, secondaryGroupField: value }))} options={groupedFields} optional />
              <LabeledSelect label="Sort rows by" value={groupedCfg.sortField} onChange={value => setGroupedCfg(prev => ({ ...prev, sortField: value }))} options={groupedFields} optional />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Columns</label>
                  <button
                    onClick={() => setGroupedCfg(prev => ({ ...prev, columns: [...prev.columns, defaultColumn(groupedFields[0]?.value ?? '')] }))}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide"
                  >
                    <Plus className="w-3 h-3" /> Add Column
                  </button>
                </div>
                <div className="space-y-3">
                  {groupedCfg.columns.map((col, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-slate-300" />
                        <span className="text-xs font-bold text-slate-700 flex-1 truncate">{col.label || col.fieldName || 'Untitled column'}</span>
                        <button onClick={() => setGroupedCfg(prev => ({ ...prev, columns: moveItem(prev.columns, idx, idx - 1) }))} disabled={idx === 0} title="Move up" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setGroupedCfg(prev => ({ ...prev, columns: moveItem(prev.columns, idx, idx + 1) }))} disabled={idx === groupedCfg.columns.length - 1} title="Move down" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setGroupedCfg(prev => ({ ...prev, columns: prev.columns.filter((_, colIdx) => colIdx !== idx) }))} title="Delete" className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Field</label>
                          <select className={miniInputCls} value={col.fieldName} onChange={event => updateColumn(idx, { fieldName: event.target.value, label: event.target.value })}>
                            <option value="">Select...</option>
                            {groupedFields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Label</label>
                          <input className={miniInputCls} value={col.label} onChange={event => updateColumn(idx, { label: event.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Display</label>
                          <select className={miniInputCls} value={col.treatment} onChange={event => updateColumn(idx, { treatment: event.target.value as ColumnConfig['treatment'] })}>
                            <option value="text">Text</option>
                            <option value="linked-names">Linked Names</option>
                            <option value="highlight">Highlight</option>
                            <option value="checkbox-highlight">Row Highlight</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Align</label>
                          <select className={miniInputCls} value={col.alignment} onChange={event => updateColumn(idx, { alignment: event.target.value as ColumnConfig['alignment'] })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Width</label>
                          <input className={miniInputCls} type="number" min={1} max={5} value={col.widthWeight} onChange={event => updateColumn(idx, { widthWeight: Math.max(1, Math.min(5, Number(event.target.value))) })} />
                        </div>
                      </div>
                      {col.treatment !== 'checkbox-highlight' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Font size</label>
                            <input
                              className={miniInputCls}
                              type="number"
                              min={6}
                              max={24}
                              placeholder="Default"
                              value={col.fontSize ?? ''}
                              onChange={event => updateColumn(idx, { fontSize: event.target.value ? Number(event.target.value) : undefined })}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Font weight</label>
                            <select
                              className={miniInputCls}
                              value={col.fontWeight ?? ''}
                              onChange={event => updateColumn(idx, { fontWeight: (event.target.value as 'normal' | 'bold') || undefined })}
                            >
                              <option value="">Default</option>
                              <option value="normal">Normal</option>
                              <option value="bold">Bold</option>
                            </select>
                          </div>
                        </div>
                      )}
                      {col.treatment !== 'checkbox-highlight' && (
                        <div className="border-t border-dashed border-slate-200 pt-2">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Stacked below</p>
                            <button onClick={() => addStackedField(idx)} className="text-[10px] font-bold text-slate-400 hover:text-amber-600 uppercase tracking-wide">Add field</button>
                          </div>
                          <div className="space-y-2">
                            {(col.stackedFields ?? []).map((sf, sfIdx) => (
                              <div key={sfIdx} className="grid grid-cols-[1fr_120px_28px] gap-2">
                                <select className={miniInputCls} value={sf.fieldName} onChange={event => updateStackedField(idx, sfIdx, { fieldName: event.target.value })}>
                                  <option value="">Field...</option>
                                  {groupedFields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
                                </select>
                                <select className={miniInputCls} value={sf.treatment} onChange={event => updateStackedField(idx, sfIdx, { treatment: event.target.value as StackedFieldConfig['treatment'] })}>
                                  <option value="text">Text</option>
                                  <option value="linked-names">Linked Names</option>
                                  <option value="highlight">Highlight</option>
                                </select>
                                <button onClick={() => removeStackedField(idx, sfIdx)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {viewType === 'linked-per-item' && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Per Item Settings</p>
          <LabeledSelect label="Primary Table" value={linkedCfg.primaryTableName} onChange={value => setLinkedCfg(prev => ({ ...prev, primaryTableName: value, primaryViewName: '', nameField: '', typeField: '', linkFields: [] }))} options={tableOptions} />
          {linkedCfg.primaryTableName && (
            <>
              <LabeledSelect label="Primary View" value={linkedCfg.primaryViewName ?? ''} onChange={value => setLinkedCfg(prev => ({ ...prev, primaryViewName: value }))} options={viewsFor(linkedCfg.primaryTableName)} optional />
              <LabeledSelect label="Name Field" value={linkedCfg.nameField} onChange={value => setLinkedCfg(prev => ({ ...prev, nameField: value }))} options={primaryFields} />
              <LabeledSelect label="Type / Category Field" value={linkedCfg.typeField} onChange={value => setLinkedCfg(prev => ({ ...prev, typeField: value }))} options={primaryFields} optional />
            </>
          )}
          <LabeledSelect label="Detail Table" value={linkedCfg.detailTableName} onChange={value => setLinkedCfg(prev => ({ ...prev, detailTableName: value, detailViewName: '', detailSortField: '', detailGroupByField: '', detailColumns: [] }))} options={tableOptions.filter(table => table.value !== linkedCfg.primaryTableName)} />
          {linkedCfg.detailTableName && (
            <>
              <LabeledSelect label="Detail View" value={linkedCfg.detailViewName ?? ''} onChange={value => setLinkedCfg(prev => ({ ...prev, detailViewName: value }))} options={viewsFor(linkedCfg.detailTableName)} optional />
              <LabeledSelect label="Sort Detail Rows By" value={linkedCfg.detailSortField} onChange={value => setLinkedCfg(prev => ({ ...prev, detailSortField: value }))} options={detailFields} optional />
              <LabeledSelect label="Group Detail Rows By" value={linkedCfg.detailGroupByField} onChange={value => setLinkedCfg(prev => ({ ...prev, detailGroupByField: value }))} options={detailFields} optional />

              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Link Fields</label>
                  <button onClick={() => setLinkedCfg(prev => ({ ...prev, linkFields: [...prev.linkFields, { fieldName: '', label: '' }] }))} className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide">
                    <Plus className="w-3 h-3" /> Add Link
                  </button>
                </div>
                <div className="space-y-2">
                  {linkedCfg.linkFields.map((linkField, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_28px] gap-2">
                      <select className={miniInputCls} value={linkField.fieldName} onChange={event => setLinkedCfg(prev => ({ ...prev, linkFields: prev.linkFields.map((lf, lfIdx) => lfIdx === idx ? { ...lf, fieldName: event.target.value } : lf) }))}>
                        <option value="">Linked field...</option>
                        {primaryFields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
                      </select>
                      <input className={miniInputCls} placeholder="Label" value={linkField.label} onChange={event => setLinkedCfg(prev => ({ ...prev, linkFields: prev.linkFields.map((lf, lfIdx) => lfIdx === idx ? { ...lf, label: event.target.value } : lf) }))} />
                      <button onClick={() => setLinkedCfg(prev => ({ ...prev, linkFields: prev.linkFields.filter((_, lfIdx) => lfIdx !== idx) }))} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Detail Columns</label>
                  <div className="flex gap-2">
                    <button onClick={() => setLinkedCfg(prev => ({ ...prev, detailColumns: [...prev.detailColumns, defaultDetailColumn(LINK_LABEL_FIELD)] }))} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wide">Link Label</button>
                    <button onClick={() => setLinkedCfg(prev => ({ ...prev, detailColumns: [...prev.detailColumns, defaultDetailColumn(detailFields[0]?.value ?? '')] }))} className="text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide">Field Column</button>
                  </div>
                </div>
                <div className="space-y-3">
                  {linkedCfg.detailColumns.map((col, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-slate-300" />
                        <span className="text-xs font-bold text-slate-700 flex-1 truncate">{col.label || col.fieldName || 'Untitled column'}</span>
                        <button onClick={() => setLinkedCfg(prev => ({ ...prev, detailColumns: moveItem(prev.detailColumns, idx, idx - 1) }))} disabled={idx === 0} title="Move up" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setLinkedCfg(prev => ({ ...prev, detailColumns: moveItem(prev.detailColumns, idx, idx + 1) }))} disabled={idx === linkedCfg.detailColumns.length - 1} title="Move down" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setLinkedCfg(prev => ({ ...prev, detailColumns: prev.detailColumns.filter((_, colIdx) => colIdx !== idx) }))} title="Delete" className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {col.treatment !== 'link-label' && (
                        <div className="grid grid-cols-2 gap-2">
                          <select className={miniInputCls} value={col.fieldName} onChange={event => updateDetailColumn(idx, { fieldName: event.target.value, label: event.target.value })}>
                            <option value="">Field...</option>
                            {detailFields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
                          </select>
                          <input className={miniInputCls} value={col.label} onChange={event => updateDetailColumn(idx, { label: event.target.value })} />
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <select className={miniInputCls} value={col.treatment} onChange={event => updateDetailColumn(idx, { treatment: event.target.value as DetailColumnConfig['treatment'], fieldName: event.target.value === 'link-label' ? LINK_LABEL_FIELD : col.fieldName })}>
                          <option value="text">Text</option>
                          <option value="linked-names">Linked Names</option>
                          <option value="highlight">Highlight</option>
                          <option value="link-label">Link Label</option>
                        </select>
                        <select className={miniInputCls} value={col.alignment} onChange={event => updateDetailColumn(idx, { alignment: event.target.value as DetailColumnConfig['alignment'] })}>
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                        <input className={miniInputCls} type="number" min={1} max={5} value={col.widthWeight} onChange={event => updateDetailColumn(idx, { widthWeight: Math.max(1, Math.min(5, Number(event.target.value))) })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Font size</label>
                          <input
                            className={miniInputCls}
                            type="number"
                            min={6}
                            max={24}
                            placeholder="Default"
                            value={col.fontSize ?? ''}
                            onChange={event => updateDetailColumn(idx, { fontSize: event.target.value ? Number(event.target.value) : undefined })}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Font weight</label>
                          <select
                            className={miniInputCls}
                            value={col.fontWeight ?? ''}
                            onChange={event => updateDetailColumn(idx, { fontWeight: (event.target.value as 'normal' | 'bold') || undefined })}
                          >
                            <option value="">Default</option>
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <button onClick={handleSave} className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
        Save View
      </button>
    </div>
  );
};

const ViewSettingsPanel: React.FC<ViewSettingsPanelProps> = ({ isOpen, views, availableTables, onSaveViews, onRestoreDefaults, onClose }) => {
  const [editorState, setEditorState] = useState<EditorState>({ mode: 'list' });

  useEffect(() => {
    if (isOpen) setEditorState({ mode: 'list' });
  }, [isOpen]);

  if (!isOpen) return null;

  const saveView = (saved: SavedViewConfig) => {
    const next = editorState.mode === 'edit'
      ? views.map(view => view.id === saved.id ? saved : view)
      : [...views, saved];
    onSaveViews(next);
    setEditorState({ mode: 'list' });
  };

  const moveView = (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= views.length) return;
    const next = [...views];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onSaveViews(next);
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-black text-slate-900">View Settings</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors group">
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-900" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {editorState.mode === 'edit' && isBuiltIn(editorState.view) && (
            <BuiltInEditor view={editorState.view} onSave={saveView} onCancel={() => setEditorState({ mode: 'list' })} />
          )}

          {editorState.mode === 'edit' && !isBuiltIn(editorState.view) && (
            <GenericViewEditor tab={editorState.view} availableTables={availableTables} onSave={saveView} onCancel={() => setEditorState({ mode: 'list' })} />
          )}

          {editorState.mode === 'new' && (
            <GenericViewEditor tab={null} availableTables={availableTables} onSave={saveView} onCancel={() => setEditorState({ mode: 'list' })} />
          )}

          {editorState.mode === 'list' && (
            <div className="space-y-8">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saved Views</h3>
                  <button onClick={() => setEditorState({ mode: 'new' })} className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add View
                  </button>
                </div>

                <div className="space-y-2">
                  {views.map((view, idx) => (
                    <div key={view.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                      <div className="flex flex-col gap-0.5 text-[8px]">
                        <button onClick={() => moveView(idx, -1)} disabled={idx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors leading-none" title="Move up">▲</button>
                        <button onClick={() => moveView(idx, 1)} disabled={idx === views.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors leading-none" title="Move down">▼</button>
                      </div>
                      <Layers className="w-4 h-4 text-slate-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{view.label}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {isBuiltIn(view)
                            ? `Built-in · ${view.builtInView}`
                            : view.viewType === 'grouped'
                              ? `Grouped Table · ${view.groupedConfig?.tableName ?? '-'}${view.groupedConfig?.viewName ? ` / ${view.groupedConfig.viewName}` : ''}`
                              : `Linked Per Item · ${view.linkedConfig?.primaryTableName ?? '-'}${view.linkedConfig?.primaryViewName ? ` / ${view.linkedConfig.primaryViewName}` : ''}`}
                        </p>
                      </div>
                      <button onClick={() => setEditorState({ mode: 'edit', view })} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-slate-700" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => onSaveViews(views.filter(item => item.id !== view.id))} className="p-2 hover:bg-red-50 rounded-lg transition-all text-slate-400 hover:text-red-500" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pt-6 border-t border-slate-100">
                <button onClick={onRestoreDefaults} className="w-full bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
                  Restore Default Views
                </button>
                {availableTables.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-3 leading-relaxed">
                    Table metadata is not loaded yet. Refresh data after selecting a base to configure custom fields.
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewSettingsPanel;
