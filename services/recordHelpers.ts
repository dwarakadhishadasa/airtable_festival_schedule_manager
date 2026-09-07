import { AirtableRecord, TeamMember } from '../types';

export function safeStr(record: AirtableRecord, fieldName: string, recordNameById: Record<string, string> = {}): string {
  if (!fieldName) return '';
  const val = record.fields[fieldName];
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) {
    return val
      .map(item => {
        if (item && typeof item === 'object') return item.name ?? recordNameById[item.id] ?? item.id ?? JSON.stringify(item);
        const id = String(item);
        return recordNameById[id] ?? id;
      })
      .filter(Boolean)
      .join(', ');
  }
  if (typeof val === 'object') return val.name ?? recordNameById[val.id] ?? JSON.stringify(val);
  return String(val);
}

export function safeLinkedIds(record: AirtableRecord, fieldName: string): string[] {
  if (!fieldName) return [];
  const val = record.fields[fieldName];
  const values = Array.isArray(val) ? val : val == null ? [] : [val];
  return values
    .map(item => {
      if (item && typeof item === 'object') return item.id ?? item.recordId;
      return String(item);
    })
    .filter(Boolean);
}

type TeamAssignmentField =
  | 'coordinatorServiceIds'
  | 'teamMemberServiceIds'
  | 'standbyServiceIds';

const serviceRoleFields: Array<{ serviceField: string; memberField: TeamAssignmentField }> = [
  { serviceField: 'Coordinator', memberField: 'coordinatorServiceIds' },
  { serviceField: 'Team Members', memberField: 'teamMemberServiceIds' },
  { serviceField: 'Standby', memberField: 'standbyServiceIds' },
];

/**
 * The Services table is the source of truth for role assignments. Reconcile its
 * links with the reverse fields on Team Members so either Airtable direction works.
 */
export function reconcileTeamMemberAssignments(
  members: TeamMember[],
  serviceRecords: AirtableRecord[],
): TeamMember[] {
  const serviceIdsByMember = new Map<string, Record<TeamAssignmentField, string[]>>();

  members.forEach(member => {
    serviceIdsByMember.set(member.id, {
      coordinatorServiceIds: [],
      teamMemberServiceIds: [],
      standbyServiceIds: [],
    });
  });

  serviceRecords.forEach(service => {
    serviceRoleFields.forEach(({ serviceField, memberField }) => {
      safeLinkedIds(service, serviceField).forEach(memberId => {
        serviceIdsByMember.get(memberId)?.[memberField].push(service.id);
      });
    });
  });

  return members.map(member => {
    const serviceIds = serviceIdsByMember.get(member.id);
    const mergeIds = (existing: string[], derived: string[] = []) =>
      Array.from(new Set([...existing, ...derived].filter(Boolean)));

    return {
      ...member,
      coordinatorServiceIds: mergeIds(member.coordinatorServiceIds, serviceIds?.coordinatorServiceIds),
      teamMemberServiceIds: mergeIds(member.teamMemberServiceIds, serviceIds?.teamMemberServiceIds),
      standbyServiceIds: mergeIds(member.standbyServiceIds, serviceIds?.standbyServiceIds),
    };
  });
}

export function safeLinkedNames(record: AirtableRecord, fieldName: string, recordNameById: Record<string, string> = {}): string {
  if (!fieldName) return '-';
  const val = record.fields[fieldName];
  if (!Array.isArray(val) || val.length === 0) return '-';
  const names = val
    .map(item => {
      if (item && typeof item === 'object') return item.name ?? recordNameById[item.id] ?? item.id;
      const id = String(item);
      return recordNameById[id] ?? id;
    })
    .filter(Boolean);
  return names.length > 0 ? names.join(', ') : '-';
}

export function safeCheckbox(record: AirtableRecord, fieldName: string): boolean {
  if (!fieldName) return false;
  return !!record.fields[fieldName];
}

export function getOrdinalDate(dateStr: string): string {
  const clean = dateStr.replace(/(st|nd|rd|th)/gi, '');
  const d = new Date(clean);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleString('en-US', { month: 'long' });
  const year = d.getFullYear();
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' :
    day % 10 === 2 && day !== 12 ? 'nd' :
    day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${weekday}, ${day}${suffix} ${month} ${year}`;
}

export function cleanCategoryName(name: string): string {
  return name.replace(/^\d+[\.\s]*/, '').trim();
}

export function recordStoreKey(tableName: string, viewName?: string): string {
  return `${tableName}::${viewName ?? ''}`;
}
