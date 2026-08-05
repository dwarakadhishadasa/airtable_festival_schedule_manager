
export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: {
    // Schedule specific
    From?: string;
    To?: string;
    Activity?: string;
    
    // Service List specific
    Service?: string;
    Coordinator?: string[];
    "Team Members"?: string[];
    Standby?: string[];
    "Start Time"?: string;
    
    // Team Members table specific
    Name?: string;
    Type?: string;
    "Team Member"?: string[]; // Singular variant from Team Members table
    
    // Common or variants
    Location?: string;
    Category: string;
    Department?: string[];
    Date: string;
    Timings?: string;
    Serial?: number; // Added for explicit ordering if available
    Select?: boolean;
    Hide?: boolean;
  } & Record<string, any>;
}

export interface AirtableResponse {
  records: AirtableRecord[];
}

export interface AppConfig {
  airtableApiKey: string;
  airtableBaseId: string;
  airtableTableName: string;
  serviceTableName: string;
  teamMembersTableName: string;
  aisensyApiKey: string;
  aisensyCampaignName: string;
  whatsappRecipient: string;
  pdfTitle: string;
  servicePdfTitle: string;
  teamPdfTitle: string;
}

export type GroupedData = Record<string, Record<string, AirtableRecord[]>>;
export type NameMapping = Record<string, string>;

export interface TeamMember {
  id: string;
  name: string;
  type: string;
  coordinatorServiceIds: string[];
  teamMemberServiceIds: string[];
  standbyServiceIds: string[];
}

export type ViewMode = 'schedule' | 'services' | 'team' | 'full';

export interface PdfData {
  schedule?: AirtableRecord[];
  services?: AirtableRecord[];
  serviceRecords?: AirtableRecord[];
  teamMembers?: TeamMember[];
  nameMapping?: NameMapping;
  viewMode: ViewMode;
  attachedImages?: { name: string; data: string }[]; // Updated to include name
  reportOptions?: {
    includeSchedule: boolean;
    includeServices: boolean;
    includeTeam: boolean;
  };
}

export type FieldTreatment = 'text' | 'linked-names' | 'highlight';
export type GenericViewType = 'grouped' | 'linked-per-item';

export const LINK_LABEL_FIELD = '__link_label__';

export interface StackedFieldConfig {
  fieldName: string;
  treatment: FieldTreatment | 'link-label';
  showInlineFieldName?: boolean;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
}

export interface ColumnConfig {
  fieldName: string;
  label: string;
  alignment: 'left' | 'center' | 'right';
  widthWeight: number;
  treatment: FieldTreatment | 'checkbox-highlight';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  stackedFields?: StackedFieldConfig[];
  secondaryFieldName?: string;
  secondaryTreatment?: FieldTreatment;
}

export interface GroupedViewConfig {
  tableName: string;
  viewName?: string;
  primaryGroupField: string;
  secondaryGroupField: string;
  sortField: string;
  columns: ColumnConfig[];
}

export interface LinkFieldConfig {
  fieldName: string;
  label: string;
}

export interface DetailColumnConfig {
  fieldName: string;
  label: string;
  treatment: FieldTreatment | 'link-label';
  alignment: 'left' | 'center' | 'right';
  widthWeight: number;
  showInlineFieldName?: boolean;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  stackedFields?: StackedFieldConfig[];
  secondaryFieldName?: string;
  secondaryTreatment?: FieldTreatment | 'link-label';
  secondaryShowInlineFieldName?: boolean;
}

export interface LinkedPerItemConfig {
  primaryTableName: string;
  primaryViewName?: string;
  nameField: string;
  typeField: string;
  detailTableName: string;
  detailViewName?: string;
  linkFields: LinkFieldConfig[];
  detailSortField: string;
  detailGroupByField: string;
  detailColumns: DetailColumnConfig[];
}

export interface TabConfig {
  id: string;
  label: string;
  pdfTitle: string;
  viewType: GenericViewType;
  groupedConfig?: GroupedViewConfig;
  linkedConfig?: LinkedPerItemConfig;
}

export type BuiltInViewMode = Exclude<ViewMode, 'full'>;

export interface BuiltInTabConfig {
  id: string;
  label: string;
  pdfTitle: string;
  viewType: 'built-in';
  builtInView: BuiltInViewMode;
}

export type SavedViewConfig = BuiltInTabConfig | TabConfig;

export interface TableFieldInfo {
  name: string;
  id?: string;
  type?: string;
  linkedTableName?: string;
}

export interface TableViewInfo {
  name: string;
}

export interface TableInfo {
  name: string;
  id?: string;
  primaryFieldName?: string;
  fields: TableFieldInfo[];
  views: TableViewInfo[];
}
