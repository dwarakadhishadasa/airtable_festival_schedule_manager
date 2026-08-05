import { AirtableRecord } from '../types';

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
  if (!Array.isArray(val)) return [];
  return val
    .map(item => {
      if (item && typeof item === 'object') return item.id;
      return String(item);
    })
    .filter(Boolean);
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
