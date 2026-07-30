
import React, { useState } from 'react';
import {
  TabConfig, ViewType, GroupedViewConfig, LinkedPerItemConfig,
  ColumnConfig, DetailColumnConfig, LinkFieldConfig, StackedFieldConfig,
  LINK_LABEL_FIELD, TableInfo,
} from '../types';
import { Plus, Trash2, ChevronLeft, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

interface TabConfigEditorProps {
  tab: TabConfig | null;
  availableTables: TableInfo[];
  onSave: (tab: TabConfig) => void;
  onCancel: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultGroupedConfig(tableName: string): GroupedViewConfig {
  return { tableName, viewName: '', primaryGroupField: '', secondaryGroupField: '', sortField: '', columns: [] };
}

function defaultLinkedConfig(primaryTableName: string): LinkedPerItemConfig {
  return {
    primaryTableName, primaryViewName: '', nameField: '', typeField: '',
    detailTableName: '', detailViewName: '', linkFields: [],
    detailSortField: '', detailGroupByField: '', detailColumns: [],
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

function defaultStackedField(fieldName: string): StackedFieldConfig {
  return { fieldName, treatment: 'text' };
}

function defaultDetailStackedField(fieldName: string): StackedFieldConfig {
  return { fieldName: fieldName === LINK_LABEL_FIELD ? LINK_LABEL_FIELD : fieldName, treatment: fieldName === LINK_LABEL_FIELD ? 'link-label' : 'text' };
}

/** Migrate old secondaryFieldName to stackedFields[0] if stackedFields is absent */
function migrateColumnStackedFields(col: ColumnConfig): StackedFieldConfig[] {
  if (col.stackedFields && col.stackedFields.length > 0) return col.stackedFields;
  if (col.secondaryFieldName && col.secondaryTreatment) {
    return [{ fieldName: col.secondaryFieldName, treatment: col.secondaryTreatment }];
  }
  return [];
}

function migrateDetailStackedFields(col: DetailColumnConfig): StackedFieldConfig[] {
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

// ─── Shared CSS class strings ────────────────────────────────────────────────

const inputCls = 'w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500/30';
const labelCls = 'block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1';

// ─── Sub-components ──────────────────────────────────────────────────────────

const LabeledSelect: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string; optional?: boolean;
}> = ({ label, value, onChange, options, placeholder = 'Select…', optional }) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
      {label}{optional && <span className="text-slate-300 ml-1">(optional)</span>}
    </label>
    <select
      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
      value={value} onChange={e => onChange(e.target.value)}
    >
      <option value="">{optional ? '— None —' : placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const LabeledInput: React.FC<{
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{label}</label>
    <input
      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    />
  </div>
);

// ─── Main editor ─────────────────────────────────────────────────────────────

const TabConfigEditor: React.FC<TabConfigEditorProps> = ({ tab, availableTables, onSave, onCancel }) => {
  const [label, setLabel] = useState(tab?.label ?? '');
  const [pdfTitle, setPdfTitle] = useState(tab?.pdfTitle ?? '');
  const [viewType, setViewType] = useState<ViewType>(tab?.viewType ?? 'grouped');

  const [groupedCfg, setGroupedCfg] = useState<GroupedViewConfig>(() => {
    const base = tab?.groupedConfig ?? defaultGroupedConfig(availableTables[0]?.name ?? '');
    return {
      ...base,
      columns: base.columns.map(col => ({
        ...col,
        stackedFields: migrateColumnStackedFields(col),
      })),
    };
  });

  const [linkedCfg, setLinkedCfg] = useState<LinkedPerItemConfig>(() => {
    const base = tab?.linkedConfig ?? defaultLinkedConfig(availableTables[0]?.name ?? '');
    return {
      ...base,
      linkFields: (base as any).linkFields ?? (base as any).roleLinks?.map((rl: any) => ({ fieldName: rl.linkFieldName, label: rl.roleLabel })) ?? [],
      detailGroupByField: base.detailGroupByField ?? '',
      detailColumns: (base.detailColumns ?? []).map(col => ({
        ...col,
        stackedFields: migrateDetailStackedFields(col),
      })),
    };
  });

  // ── Drag-and-drop + collapse state ──
  const [dragGroupColIdx, setDragGroupColIdx] = useState<number | null>(null);
  const [dragDetailColIdx, setDragDetailColIdx] = useState<number | null>(null);
  const [collapsedGroupCols, setCollapsedGroupCols] = useState<Set<number>>(new Set());
  const [collapsedDetailCols, setCollapsedDetailCols] = useState<Set<number>>(new Set());

  const toggleGroupCollapse = (idx: number) =>
    setCollapsedGroupCols(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const toggleDetailCollapse = (idx: number) =>
    setCollapsedDetailCols(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });

  const tableOptions = availableTables.map(t => ({ value: t.name, label: t.name }));
  const fieldsFor = (tableName: string) =>
    (availableTables.find(t => t.name === tableName)?.fields ?? []).map(f => ({ value: f.name, label: f.name }));
  const viewsFor = (tableName: string) =>
    (availableTables.find(t => t.name === tableName)?.views ?? []).map(v => ({ value: v.name, label: v.name }));

  // ── Grouped config handlers ──
  const updateGrouped = (patch: Partial<GroupedViewConfig>) =>
    setGroupedCfg(prev => ({ ...prev, ...patch }));

  const addColumn = () => {
    const first = fieldsFor(groupedCfg.tableName)[0]?.value ?? '';
    setGroupedCfg(prev => ({ ...prev, columns: [...prev.columns, defaultColumn(first)] }));
  };

  const updateColumn = (idx: number, patch: Partial<ColumnConfig>) =>
    setGroupedCfg(prev => ({ ...prev, columns: prev.columns.map((c, i) => i === idx ? { ...c, ...patch } : c) }));

  const removeColumn = (idx: number) =>
    setGroupedCfg(prev => ({ ...prev, columns: prev.columns.filter((_, i) => i !== idx) }));

  const moveColumn = (from: number, to: number) =>
    setGroupedCfg(prev => {
      const cols = [...prev.columns];
      const [moved] = cols.splice(from, 1);
      cols.splice(to, 0, moved);
      return { ...prev, columns: cols };
    });

  const addGroupedStackedField = (colIdx: number) => {
    setGroupedCfg(prev => {
      const fields = availableTables.find(t => t.name === prev.tableName)?.fields ?? [];
      const first = fields[0]?.name ?? '';
      return {
        ...prev,
        columns: prev.columns.map((c, i) => i === colIdx
          ? { ...c, stackedFields: [...(c.stackedFields ?? []), defaultStackedField(first)] }
          : c
        ),
      };
    });
  };

  const updateGroupedStackedField = (colIdx: number, sfIdx: number, patch: Partial<StackedFieldConfig>) =>
    setGroupedCfg(prev => ({
      ...prev,
      columns: prev.columns.map((c, i) => i === colIdx
        ? { ...c, stackedFields: (c.stackedFields ?? []).map((sf, si) => si === sfIdx ? { ...sf, ...patch } : sf) }
        : c
      ),
    }));

  const removeGroupedStackedField = (colIdx: number, sfIdx: number) =>
    setGroupedCfg(prev => ({
      ...prev,
      columns: prev.columns.map((c, i) => i === colIdx
        ? { ...c, stackedFields: (c.stackedFields ?? []).filter((_, si) => si !== sfIdx) }
        : c
      ),
    }));

  // ── Linked config handlers ──
  const updateLinked = (patch: Partial<LinkedPerItemConfig>) =>
    setLinkedCfg(prev => ({ ...prev, ...patch }));

  const addLinkField = () =>
    setLinkedCfg(prev => ({ ...prev, linkFields: [...prev.linkFields, { fieldName: '', label: '' }] }));

  const updateLinkField = (idx: number, patch: Partial<LinkFieldConfig>) =>
    setLinkedCfg(prev => ({ ...prev, linkFields: prev.linkFields.map((lf, i) => i === idx ? { ...lf, ...patch } : lf) }));

  const removeLinkField = (idx: number) =>
    setLinkedCfg(prev => ({ ...prev, linkFields: prev.linkFields.filter((_, i) => i !== idx) }));

  const addDetailColumn = (fieldName: string) =>
    setLinkedCfg(prev => ({ ...prev, detailColumns: [...prev.detailColumns, defaultDetailColumn(fieldName)] }));

  const updateDetailColumn = (idx: number, patch: Partial<DetailColumnConfig>) =>
    setLinkedCfg(prev => ({ ...prev, detailColumns: prev.detailColumns.map((c, i) => i === idx ? { ...c, ...patch } : c) }));

  const removeDetailColumn = (idx: number) =>
    setLinkedCfg(prev => ({ ...prev, detailColumns: prev.detailColumns.filter((_, i) => i !== idx) }));

  const moveDetailColumn = (from: number, to: number) =>
    setLinkedCfg(prev => {
      const cols = [...prev.detailColumns];
      const [moved] = cols.splice(from, 1);
      cols.splice(to, 0, moved);
      return { ...prev, detailColumns: cols };
    });

  const addDetailStackedField = (colIdx: number) => {
    setLinkedCfg(prev => {
      const fields = availableTables.find(t => t.name === prev.detailTableName)?.fields ?? [];
      const first = fields[0]?.name ?? '';
      return {
        ...prev,
        detailColumns: prev.detailColumns.map((c, i) => i === colIdx
          ? { ...c, stackedFields: [...(c.stackedFields ?? []), defaultDetailStackedField(first)] }
          : c
        ),
      };
    });
  };

  const updateDetailStackedField = (colIdx: number, sfIdx: number, patch: Partial<StackedFieldConfig>) =>
    setLinkedCfg(prev => ({
      ...prev,
      detailColumns: prev.detailColumns.map((c, i) => i === colIdx
        ? { ...c, stackedFields: (c.stackedFields ?? []).map((sf, si) => si === sfIdx ? { ...sf, ...patch } : sf) }
        : c
      ),
    }));

  const removeDetailStackedField = (colIdx: number, sfIdx: number) =>
    setLinkedCfg(prev => ({
      ...prev,
      detailColumns: prev.detailColumns.map((c, i) => i === colIdx
        ? { ...c, stackedFields: (c.stackedFields ?? []).filter((_, si) => si !== sfIdx) }
        : c
      ),
    }));

  // ── Save ──
  const handleSave = () => {
    const saved: TabConfig = {
      id: tab?.id ?? newId(),
      label: label.trim() || 'Untitled View',
      pdfTitle: pdfTitle.trim() || label.trim() || 'Untitled View',
      viewType,
      groupedConfig: viewType === 'grouped' ? groupedCfg : undefined,
      linkedConfig: viewType === 'linked-per-item' ? linkedCfg : undefined,
    };
    onSave(saved);
  };

  const groupedFields = fieldsFor(groupedCfg.tableName);
  const linkedPrimaryFields = fieldsFor(linkedCfg.primaryTableName);
  const linkedDetailFields = fieldsFor(linkedCfg.detailTableName);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-bold transition-colors">
        <ChevronLeft className="w-4 h-4" />
        {tab ? 'Back' : 'Cancel'}
      </button>

      <h3 className="text-base font-black text-slate-900">{tab ? 'Edit View' : 'New View'}</h3>

      <LabeledInput label="Tab Label" value={label} onChange={setLabel} placeholder="e.g. Schedule, Service List" />

      <div>
        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">View Type</label>
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {(['grouped', 'linked-per-item'] as ViewType[]).map(vt => (
            <button key={vt} onClick={() => setViewType(vt)}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewType === vt ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {vt === 'grouped' ? 'Grouped Table' : 'Linked Per Item'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">
          {viewType === 'grouped'
            ? 'Groups records by up to 2 fields. Good for schedules, service lists, tasks.'
            : 'Shows each record with its linked items listed below. Good for person or entity-based views.'}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          GROUPED CONFIG
          ══════════════════════════════════════════════════════════════════════ */}
      {viewType === 'grouped' && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grouped Table Settings</p>

          <LabeledSelect label="Table" value={groupedCfg.tableName}
            onChange={v => updateGrouped({ tableName: v, viewName: '', primaryGroupField: '', secondaryGroupField: '', sortField: '', columns: [] })}
            options={tableOptions}
          />

          {groupedCfg.tableName && (
            <>
              <LabeledSelect label="View" value={groupedCfg.viewName ?? ''} onChange={v => updateGrouped({ viewName: v })} options={viewsFor(groupedCfg.tableName)} optional />
              <LabeledSelect label="Group by (1st level)" value={groupedCfg.primaryGroupField} onChange={v => updateGrouped({ primaryGroupField: v })} options={groupedFields} optional />
              <LabeledSelect label="Group by (2nd level)" value={groupedCfg.secondaryGroupField} onChange={v => updateGrouped({ secondaryGroupField: v })} options={groupedFields.filter(f => f.value !== groupedCfg.primaryGroupField)} optional />
              <LabeledSelect label="Sort within groups" value={groupedCfg.sortField} onChange={v => updateGrouped({ sortField: v })} options={groupedFields} optional />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Columns</label>
                  <button onClick={addColumn} className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide">
                    <Plus className="w-3 h-3" /> Add Column
                  </button>
                </div>
                {groupedCfg.columns.length === 0 && <p className="text-[11px] text-slate-400 italic">No columns added yet.</p>}
                <div className="space-y-2">
                  {groupedCfg.columns.map((col, idx) => {
                    const isCollapsed = collapsedGroupCols.has(idx);
                    const isCheckboxHighlight = col.treatment === 'checkbox-highlight';
                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => setDragGroupColIdx(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => { if (dragGroupColIdx !== null && dragGroupColIdx !== idx) moveColumn(dragGroupColIdx, idx); setDragGroupColIdx(null); }}
                        onDragEnd={() => setDragGroupColIdx(null)}
                        className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${dragGroupColIdx === idx ? 'opacity-40 border-dashed' : ''}`}
                      >
                        {/* Card Header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                          <GripVertical className="w-4 h-4 text-slate-300 cursor-grab shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">{col.fieldName || 'Untitled'}</span>
                          {col.label && col.label !== col.fieldName && (
                            <span className="text-[10px] text-slate-400 truncate">→ {col.label}</span>
                          )}
                          {isCheckboxHighlight && (
                            <span className="text-[9px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded">Row highlight</span>
                          )}
                          <div className="ml-auto flex items-center gap-0.5 shrink-0">
                            <button onClick={() => toggleGroupCollapse(idx)} className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg transition-colors">
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => removeColumn(idx)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Card Body */}
                        {!isCollapsed && (
                          <div className="px-3 pb-3 pt-2 space-y-3">
                            {/* Row 1: Field + Label */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={labelCls}>Field</label>
                                <select className={inputCls}
                                  value={col.fieldName} onChange={e => updateColumn(idx, { fieldName: e.target.value, label: e.target.value })}>
                                  <option value="">Select…</option>
                                  {groupedFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className={labelCls}>Label</label>
                                <input className={inputCls}
                                  placeholder="Column header" value={col.label} onChange={e => updateColumn(idx, { label: e.target.value })} />
                              </div>
                            </div>

                            {/* Row 2: Display as + Align + Width */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className={labelCls}>Display as</label>
                                <select className={inputCls}
                                  value={col.treatment} onChange={e => updateColumn(idx, { treatment: e.target.value as ColumnConfig['treatment'] })}>
                                  <option value="text">Text</option>
                                  <option value="linked-names">Linked Names</option>
                                  <option value="highlight">Highlight</option>
                                  <option value="checkbox-highlight">Row Highlight</option>
                                </select>
                              </div>
                              {!isCheckboxHighlight && (
                                <>
                                  <div>
                                    <label className={labelCls}>Align</label>
                                    <select className={inputCls}
                                      value={col.alignment} onChange={e => updateColumn(idx, { alignment: e.target.value as ColumnConfig['alignment'] })}>
                                      <option value="left">Left</option>
                                      <option value="center">Center</option>
                                      <option value="right">Right</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className={labelCls}>Width</label>
                                    <input type="number" min={1} max={5} className={inputCls}
                                      value={col.widthWeight}
                                      onChange={e => updateColumn(idx, { widthWeight: Math.max(1, Math.min(5, Number(e.target.value))) })} />
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Row 3: Font size + Font weight */}
                            {!isCheckboxHighlight && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={labelCls}>Font size</label>
                                  <input type="number" min={6} max={24} className={inputCls}
                                    placeholder="Default" value={col.fontSize ?? ''}
                                    onChange={e => updateColumn(idx, { fontSize: e.target.value ? Number(e.target.value) : undefined })} />
                                </div>
                                <div>
                                  <label className={labelCls}>Font weight</label>
                                  <select className={inputCls}
                                    value={col.fontWeight ?? ''} onChange={e => updateColumn(idx, { fontWeight: (e.target.value as 'normal' | 'bold') || undefined })}>
                                    <option value="">Default</option>
                                    <option value="normal">Normal</option>
                                    <option value="bold">Bold</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {/* Stacked below section */}
                            {!isCheckboxHighlight && (
                              <div className="border-t border-dashed border-slate-200 pt-2">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">Stacked below</p>
                                <div className="space-y-2">
                                  {(col.stackedFields ?? []).map((sf, sfIdx) => (
                                    <div key={sfIdx} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-amber-500 bg-amber-50 w-5 h-5 rounded flex items-center justify-center shrink-0">{sfIdx + 1}</span>
                                        <select className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                                          value={sf.fieldName}
                                          onChange={e => updateGroupedStackedField(idx, sfIdx, { fieldName: e.target.value })}>
                                          <option value="">Field…</option>
                                          {groupedFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                        <select className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                                          value={sf.treatment}
                                          onChange={e => updateGroupedStackedField(idx, sfIdx, { treatment: e.target.value as StackedFieldConfig['treatment'] })}>
                                          <option value="text">Text</option>
                                          <option value="linked-names">Linked Names</option>
                                          <option value="highlight">Highlight</option>
                                        </select>
                                        <button onClick={() => removeGroupedStackedField(idx, sfIdx)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors shrink-0">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-2 pl-7">
                                        <input type="number" min={6} max={24}
                                          className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                                          placeholder="px" value={sf.fontSize ?? ''}
                                          onChange={e => updateGroupedStackedField(idx, sfIdx, { fontSize: e.target.value ? Number(e.target.value) : undefined })} />
                                        <select className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                                          value={sf.fontWeight ?? ''} onChange={e => updateGroupedStackedField(idx, sfIdx, { fontWeight: (e.target.value as 'normal' | 'bold') || undefined })}>
                                          <option value="">Default</option>
                                          <option value="normal">Normal</option>
                                          <option value="bold">Bold</option>
                                        </select>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  onClick={() => addGroupedStackedField(idx)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-600 uppercase tracking-wide mt-2"
                                >
                                  <Plus className="w-3 h-3" /> Add stacked field
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LINKED-PER-ITEM CONFIG
          ══════════════════════════════════════════════════════════════════════ */}
      {viewType === 'linked-per-item' && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Per Item Settings</p>

          <LabeledSelect label="Primary Table (people / entities)" value={linkedCfg.primaryTableName}
            onChange={v => updateLinked({ primaryTableName: v, primaryViewName: '', nameField: '', typeField: '', linkFields: [] })}
            options={tableOptions}
          />

          {linkedCfg.primaryTableName && (
            <>
              <LabeledSelect label="Primary View" value={linkedCfg.primaryViewName ?? ''} onChange={v => updateLinked({ primaryViewName: v })} options={viewsFor(linkedCfg.primaryTableName)} optional />
              <LabeledSelect label="Name Field" value={linkedCfg.nameField} onChange={v => updateLinked({ nameField: v })} options={linkedPrimaryFields} />
              <LabeledSelect label="Type / Category Field" value={linkedCfg.typeField} onChange={v => updateLinked({ typeField: v })} options={linkedPrimaryFields} optional />
            </>
          )}

          <LabeledSelect label="Detail Table (linked records)" value={linkedCfg.detailTableName}
            onChange={v => updateLinked({ detailTableName: v, detailViewName: '', detailSortField: '', detailGroupByField: '', detailColumns: [] })}
            options={tableOptions.filter(t => t.value !== linkedCfg.primaryTableName)}
          />

          {linkedCfg.detailTableName && (
            <>
              <LabeledSelect label="Detail View" value={linkedCfg.detailViewName ?? ''} onChange={v => updateLinked({ detailViewName: v })} options={viewsFor(linkedCfg.detailTableName)} optional />
              <LabeledSelect label="Sort Detail Rows By" value={linkedCfg.detailSortField} onChange={v => updateLinked({ detailSortField: v })} options={linkedDetailFields} optional />
              <LabeledSelect label="Group Detail Rows By" value={linkedCfg.detailGroupByField} onChange={v => updateLinked({ detailGroupByField: v })} options={linkedDetailFields} optional />

              {/* Detail columns builder */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Detail Columns</label>
                  <div className="flex gap-2">
                    <button onClick={() => addDetailColumn(LINK_LABEL_FIELD)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wide">
                      <Plus className="w-3 h-3" /> Link Label
                    </button>
                    <button onClick={() => addDetailColumn(linkedDetailFields[0]?.value ?? '')} className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide">
                      <Plus className="w-3 h-3" /> Field Column
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">
                  <strong>Link Label</strong> shows which link field connected this row.{' '}
                  <strong>Field Column</strong> shows a field value from the detail record.
                </p>
                {linkedCfg.detailColumns.length === 0 && <p className="text-[11px] text-slate-400 italic">No columns added yet.</p>}
                <div className="space-y-2">
                  {linkedCfg.detailColumns.map((col, idx) => {
                    const isCollapsed = collapsedDetailCols.has(idx);
                    const isLinkLabel = col.treatment === 'link-label';
                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => setDragDetailColIdx(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => { if (dragDetailColIdx !== null && dragDetailColIdx !== idx) moveDetailColumn(dragDetailColIdx, idx); setDragDetailColIdx(null); }}
                        onDragEnd={() => setDragDetailColIdx(null)}
                        className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${dragDetailColIdx === idx ? 'opacity-40 border-dashed' : ''}`}
                      >
                        {/* Card Header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                          <GripVertical className="w-4 h-4 text-slate-300 cursor-grab shrink-0" />
                          {isLinkLabel ? (
                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wide">Link Label</span>
                          ) : (
                            <span className="text-xs font-bold text-slate-700 truncate">{col.fieldName || 'Untitled'}</span>
                          )}
                          {!isLinkLabel && col.label && col.label !== col.fieldName && (
                            <span className="text-[10px] text-slate-400 truncate">→ {col.label}</span>
                          )}
                          {isLinkLabel && col.label && (
                            <span className="text-[10px] text-slate-400 truncate">→ {col.label}</span>
                          )}
                          <div className="ml-auto flex items-center gap-0.5 shrink-0">
                            <button onClick={() => toggleDetailCollapse(idx)} className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg transition-colors">
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => removeDetailColumn(idx)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Card Body */}
                        {!isCollapsed && (
                          <div className="px-3 pb-3 pt-2 space-y-3">
                            {/* Row 1: Field + Label */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={labelCls}>Field</label>
                                {isLinkLabel ? (
                                  <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-400 select-none">— Link Label —</div>
                                ) : (
                                  <select className={inputCls}
                                    value={col.fieldName} onChange={e => updateDetailColumn(idx, { fieldName: e.target.value, label: e.target.value })}>
                                    <option value="">Select…</option>
                                    {linkedDetailFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                  </select>
                                )}
                              </div>
                              <div>
                                <label className={labelCls}>Label</label>
                                <input className={inputCls}
                                  placeholder="Column header" value={col.label} onChange={e => updateDetailColumn(idx, { label: e.target.value })} />
                              </div>
                            </div>

                            {/* Row 2: Display as + Align + Width */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className={labelCls}>Display as</label>
                                <select className={inputCls}
                                  value={col.treatment}
                                  onChange={e => {
                                    const t = e.target.value as DetailColumnConfig['treatment'];
                                    if (t === 'link-label') {
                                      updateDetailColumn(idx, { treatment: t, fieldName: LINK_LABEL_FIELD, showInlineFieldName: false });
                                    } else {
                                      updateDetailColumn(idx, { treatment: t, fieldName: col.fieldName === LINK_LABEL_FIELD ? '' : col.fieldName });
                                    }
                                  }}>
                                  <option value="text">Text</option>
                                  <option value="linked-names">Linked Names</option>
                                  <option value="highlight">Highlight</option>
                                  <option value="link-label">Link Label</option>
                                </select>
                              </div>
                              <div>
                                <label className={labelCls}>Align</label>
                                <select className={inputCls}
                                  value={col.alignment} onChange={e => updateDetailColumn(idx, { alignment: e.target.value as DetailColumnConfig['alignment'] })}>
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>
                              <div>
                                <label className={labelCls}>Width</label>
                                <input type="number" min={1} max={5} className={inputCls}
                                  value={col.widthWeight}
                                  onChange={e => updateDetailColumn(idx, { widthWeight: Math.max(1, Math.min(5, Number(e.target.value))) })} />
                              </div>
                            </div>

                            {/* Row 3: Font size + Font weight */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={labelCls}>Font size</label>
                                <input type="number" min={6} max={24} className={inputCls}
                                  placeholder="Default" value={col.fontSize ?? ''}
                                  onChange={e => updateDetailColumn(idx, { fontSize: e.target.value ? Number(e.target.value) : undefined })} />
                              </div>
                              <div>
                                <label className={labelCls}>Font weight</label>
                                <select className={inputCls}
                                  value={col.fontWeight ?? ''} onChange={e => updateDetailColumn(idx, { fontWeight: (e.target.value as 'normal' | 'bold') || undefined })}>
                                  <option value="">Default</option>
                                  <option value="normal">Normal</option>
                                  <option value="bold">Bold</option>
                                </select>
                              </div>
                            </div>

                            {/* Row 4: Show field name as prefix */}
                            {!isLinkLabel && (
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={!!col.showInlineFieldName}
                                  onChange={e => updateDetailColumn(idx, { showInlineFieldName: e.target.checked })}
                                  className="w-3.5 h-3.5 rounded" />
                                Show field name as prefix
                              </label>
                            )}

                            {/* Stacked below section */}
                            <div className="border-t border-dashed border-slate-200 pt-2">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">Stacked below</p>
                              <div className="space-y-2">
                                {(col.stackedFields ?? []).map((sf, sfIdx) => (
                                  <div key={sfIdx} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 w-5 h-5 rounded flex items-center justify-center shrink-0">{sfIdx + 1}</span>
                                      {/* Field selector: includes Link Label option */}
                                      <select className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                                        value={sf.fieldName === LINK_LABEL_FIELD ? LINK_LABEL_FIELD : sf.fieldName}
                                        onChange={e => {
                                          const val = e.target.value;
                                          if (val === LINK_LABEL_FIELD) {
                                            updateDetailStackedField(idx, sfIdx, { fieldName: LINK_LABEL_FIELD, treatment: 'link-label', showInlineFieldName: false });
                                          } else {
                                            updateDetailStackedField(idx, sfIdx, { fieldName: val, treatment: sf.treatment === 'link-label' ? 'text' : sf.treatment });
                                          }
                                        }}>
                                        <option value="">Field…</option>
                                        <option value={LINK_LABEL_FIELD}>— Link Label —</option>
                                        {linkedDetailFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                      </select>
                                      {/* Treatment selector (hidden for link-label) */}
                                      {sf.treatment !== 'link-label' && (
                                        <select className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                                          value={sf.treatment} onChange={e => updateDetailStackedField(idx, sfIdx, { treatment: e.target.value as StackedFieldConfig['treatment'] })}>
                                          <option value="text">Text</option>
                                          <option value="linked-names">Linked Names</option>
                                          <option value="highlight">Highlight</option>
                                        </select>
                                      )}
                                      <button onClick={() => removeDetailStackedField(idx, sfIdx)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors shrink-0">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2 pl-7">
                                      <input type="number" min={6} max={24}
                                        className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                                        placeholder="px" value={sf.fontSize ?? ''}
                                        onChange={e => updateDetailStackedField(idx, sfIdx, { fontSize: e.target.value ? Number(e.target.value) : undefined })} />
                                      <select className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                                        value={sf.fontWeight ?? ''} onChange={e => updateDetailStackedField(idx, sfIdx, { fontWeight: (e.target.value as 'normal' | 'bold') || undefined })}>
                                        <option value="">Default</option>
                                        <option value="normal">Normal</option>
                                        <option value="bold">Bold</option>
                                      </select>
                                      {sf.treatment !== 'link-label' && (
                                        <label className="flex items-center gap-1 text-[9px] text-slate-500 cursor-pointer shrink-0">
                                          <input type="checkbox" checked={!!sf.showInlineFieldName}
                                            onChange={e => updateDetailStackedField(idx, sfIdx, { showInlineFieldName: e.target.checked })}
                                            className="w-3 h-3" />
                                          Prefix
                                        </label>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => addDetailStackedField(idx)}
                                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-500 uppercase tracking-wide mt-2"
                              >
                                <Plus className="w-3 h-3" /> Add stacked field
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Link Fields builder */}
          {linkedCfg.primaryTableName && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Link Fields</label>
                <button onClick={addLinkField} className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wide">
                  <Plus className="w-3 h-3" /> Add Link Field
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mb-2">
                Select linked record fields in <strong>{linkedCfg.primaryTableName}</strong> that connect to <strong>{linkedCfg.detailTableName || 'the detail table'}</strong>. Give each a label to identify the connection type (e.g., "Coordinator", "Volunteer").
              </p>
              {linkedCfg.linkFields.length === 0 && <p className="text-[11px] text-slate-400 italic">No link fields added yet.</p>}
              <div className="space-y-2">
                {linkedCfg.linkFields.map((lf, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <select className={inputCls}
                      value={lf.fieldName} onChange={e => updateLinkField(idx, { fieldName: e.target.value })}>
                      <option value="">Field in primary table…</option>
                      {linkedPrimaryFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <input className={inputCls}
                      placeholder="Label, e.g. Coordinator"
                      value={lf.label} onChange={e => updateLinkField(idx, { label: e.target.value })} />
                    <button onClick={() => removeLinkField(idx)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-slate-100">
        <LabeledInput label="PDF Title" value={pdfTitle} onChange={setPdfTitle} placeholder={label || 'e.g. FESTIVAL NAME – SCHEDULE'} />
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:text-slate-900 transition-colors text-sm">
          Cancel
        </button>
        <button onClick={handleSave} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm">
          Save View
        </button>
      </div>
    </div>
  );
};

export default TabConfigEditor;
