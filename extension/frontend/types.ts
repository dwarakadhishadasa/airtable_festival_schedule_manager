
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
    "Team Member"?: string[];

    // Common
    Location?: string;
    Category: string;
    Department?: string[];
    Date: string;
    Timings?: string;
    Serial?: number;
    Select?: boolean;
  };
}

export interface AirtableResponse {
  records: AirtableRecord[];
}

// AppConfig: no Airtable connection fields — the extension auto-connects to the base.
// Only stores user-customisable settings.
export interface AppConfig {
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
  attachedImages?: { name: string; data: string }[];
  reportOptions?: {
    includeSchedule: boolean;
    includeServices: boolean;
    includeTeam: boolean;
  };
}
