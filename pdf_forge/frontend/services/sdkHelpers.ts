
import { Record as AirtableSDKRecord } from '@airtable/blocks/models';

/**
 * Safely returns the string representation of a cell value.
 * Returns '' when the field doesn't exist or throws.
 */
export function safeStr(record: AirtableSDKRecord, fieldName: string): string {
  if (!fieldName) return '';
  try {
    return record.getCellValueAsString(fieldName) ?? '';
  } catch {
    return '';
  }
}

/**
 * Safely reads a linked-record field and returns the joined display names.
 * Returns '-' when empty or field is missing.
 */
export function safeLinkedNames(record: AirtableSDKRecord, fieldName: string): string {
  if (!fieldName) return '-';
  try {
    const val = record.getCellValue(fieldName);
    if (!val || !Array.isArray(val)) return '-';
    const names = (val as Array<{ id: string; name: string }>).map(v => v.name).filter(Boolean);
    return names.length > 0 ? names.join(', ') : '-';
  } catch {
    return '-';
  }
}

/**
 * Safely reads a linked-record field and returns the linked record IDs.
 */
export function safeLinkedIds(record: AirtableSDKRecord, fieldName: string): string[] {
  if (!fieldName) return [];
  try {
    const val = record.getCellValue(fieldName);
    if (!val || !Array.isArray(val)) return [];
    return (val as Array<{ id: string }>).map(v => v.id);
  } catch {
    return [];
  }
}

/**
 * Safely reads a checkbox field. Returns false on missing field or error.
 */
export function safeCheckbox(record: AirtableSDKRecord, fieldName: string): boolean {
  if (!fieldName) return false;
  try {
    return !!(record.getCellValue(fieldName));
  } catch {
    return false;
  }
}

/**
 * Formats a date string as an ordinal date (e.g. "Wednesday, 15th January 2025").
 * Returns the original string unchanged if it cannot be parsed.
 */
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

/** Strips leading numeric serial from category names like "01. Morning Program" */
export function cleanCategoryName(name: string): string {
  return name.replace(/^\d+[\.\s]*/, '').trim();
}
