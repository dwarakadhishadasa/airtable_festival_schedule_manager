
export type ViewType = 'grouped' | 'linked-per-item';

export type FieldTreatment = 'text' | 'linked-names' | 'highlight';

/** Sentinel fieldName used when a stacked field or detail column has treatment 'link-label' */
export const LINK_LABEL_FIELD = '__link_label__';

/** A field stacked below the primary value in a column cell */
export interface StackedFieldConfig {
  fieldName: string;                      // '__link_label__' when treatment is 'link-label'
  treatment: FieldTreatment | 'link-label';
  /** Show the Airtable field name as an inline prefix. Applicable in LinkedPerItem views only. */
  showInlineFieldName?: boolean;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
}

// ─── Grouped Table types ───────────────────────────────────────────────────────

export interface ColumnConfig {
  fieldName: string;
  label: string;
  alignment: 'left' | 'center' | 'right';
  widthWeight: number;
  /** text: plain string; linked-names: joined names; highlight: amber badge; checkbox-highlight: marks row red (not a visible column) */
  treatment: FieldTreatment | 'checkbox-highlight';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  stackedFields?: StackedFieldConfig[];
  /** @deprecated Use stackedFields instead */
  secondaryFieldName?: string;
  /** @deprecated Use stackedFields instead */
  secondaryTreatment?: FieldTreatment;
}

export interface GroupedViewConfig {
  tableName: string;
  viewName?: string;             // '' / undefined = all records in table
  primaryGroupField: string;    // e.g., 'Date'
  secondaryGroupField: string;  // '' = no secondary grouping
  sortField: string;            // '' = no sort within groups
  columns: ColumnConfig[];
}

// ─── Linked Per Item types ─────────────────────────────────────────────────────

/** A linked record field in the primary table that points to the detail table */
export interface LinkFieldConfig {
  fieldName: string;  // field in primary table holding linked record IDs
  label: string;      // display label, e.g., 'Coordinator'
}

/** One column in the detail rows table */
export interface DetailColumnConfig {
  fieldName: string;                      // '__link_label__' when treatment is 'link-label'
  label: string;                          // column header
  treatment: FieldTreatment | 'link-label';
  alignment: 'left' | 'center' | 'right';
  widthWeight: number;
  /** Prefix the cell value with the Airtable field name inline. Not applicable to link-label columns. */
  showInlineFieldName?: boolean;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  stackedFields?: StackedFieldConfig[];
  /** @deprecated Use stackedFields instead */
  secondaryFieldName?: string;
  /** @deprecated Use stackedFields instead */
  secondaryTreatment?: FieldTreatment | 'link-label';
  /** @deprecated Use stackedFields instead */
  secondaryShowInlineFieldName?: boolean;
}

export interface LinkedPerItemConfig {
  primaryTableName: string;
  primaryViewName?: string;     // '' / undefined = all records in table
  nameField: string;
  typeField: string;           // '' = type filter disabled
  detailTableName: string;
  detailViewName?: string;     // '' / undefined = all records in table
  linkFields: LinkFieldConfig[];
  detailSortField: string;     // '' = no sort
  detailGroupByField: string;  // '' = no grouping within each card
  detailColumns: DetailColumnConfig[];
}

// ─── Tab config ────────────────────────────────────────────────────────────────

export interface TabConfig {
  id: string;
  label: string;
  pdfTitle: string;
  viewType: ViewType;
  groupedConfig?: GroupedViewConfig;
  linkedConfig?: LinkedPerItemConfig;
}

// ─── Table/field metadata ──────────────────────────────────────────────────────

export interface TableFieldInfo {
  name: string;
}

export interface TableViewInfo {
  name: string;
}

export interface TableInfo {
  name: string;
  fields: TableFieldInfo[];
  views: TableViewInfo[];
}
