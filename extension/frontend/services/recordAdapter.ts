import { Record as AirtableSDKRecord } from '@airtable/blocks/models';
import { AirtableRecord } from '../types';

/**
 * Safe wrapper around getCellValue — returns null instead of throwing when a
 * field doesn't exist in the record's table. This is necessary because the
 * Blocks SDK throws on unknown field names, unlike the REST API which returns
 * undefined. A single adaptSDKRecord function is shared across all three tables
 * (Activities, Services, Team Members), each of which has different fields.
 */
function safe(sdkRecord: AirtableSDKRecord, fieldName: string): unknown {
  try {
    return sdkRecord.getCellValue(fieldName);
  } catch {
    return null;
  }
}

/**
 * Linked record fields in the Airtable SDK return { id: string, name: string }[]
 * rather than bare string[]. We extract only the IDs so the existing NameMapping
 * lookup pattern (mapping[id] → displayName) works without touching any component.
 */
function extractLinkedIds(cellValue: unknown): string[] {
  if (!cellValue || !Array.isArray(cellValue)) return [];
  return (cellValue as Array<{ id: string }>).map(v => v.id);
}

function str(cellValue: unknown): string | undefined {
  if (cellValue === null || cellValue === undefined) return undefined;
  if (typeof cellValue === 'string') return cellValue;
  return String(cellValue);
}

/**
 * Extracts the display name from a single-select or multi-select cell value.
 * The Airtable SDK returns single-select as { name, color } and multi-select as
 * { name, color }[] — both produce [object Object] if passed through str().
 */
function selectName(cellValue: unknown): string | undefined {
  if (cellValue === null || cellValue === undefined) return undefined;
  if (typeof cellValue === 'string') return cellValue;
  // Single-select: { name: string, color: string }
  if (!Array.isArray(cellValue) && typeof cellValue === 'object') {
    const named = cellValue as { name?: unknown };
    if (named.name != null) return String(named.name);
  }
  // Multi-select: { name: string, color: string }[]
  if (Array.isArray(cellValue) && cellValue.length > 0) {
    return (cellValue as Array<{ name: unknown }>).map(v => String(v.name)).join(', ');
  }
  return String(cellValue);
}

/**
 * Converts an Airtable Blocks SDK Record into the AirtableRecord shape that all
 * existing components and pdfService expect. Call this once per record in a useMemo.
 */
export function adaptSDKRecord(sdkRecord: AirtableSDKRecord): AirtableRecord {
  const createdTime =
    sdkRecord.createdTime instanceof Date
      ? sdkRecord.createdTime.toISOString()
      : String(sdkRecord.createdTime ?? '');

  return {
    id: sdkRecord.id,
    createdTime,
    fields: {
      // Schedule fields
      Activity:       str(safe(sdkRecord, 'Activity')),
      From:           str(safe(sdkRecord, 'From')),
      To:             str(safe(sdkRecord, 'To')),
      Location:       selectName(safe(sdkRecord, 'Location')),
      Timings:        str(safe(sdkRecord, 'Timings')),
      Category:       selectName(safe(sdkRecord, 'Category')) ?? 'General',
      Date:           str(safe(sdkRecord, 'Date')) ?? '',
      Select:         safe(sdkRecord, 'Select') ? true : undefined,
      Serial:         safe(sdkRecord, 'Serial') != null
                        ? Number(safe(sdkRecord, 'Serial'))
                        : undefined,

      // Service list fields
      Service:          str(safe(sdkRecord, 'Service')),
      Coordinator:      extractLinkedIds(safe(sdkRecord, 'Coordinator')),
      'Team Members':   extractLinkedIds(safe(sdkRecord, 'Team Members')),
      Standby:          extractLinkedIds(safe(sdkRecord, 'Standby')),
      'Start Time':     str(safe(sdkRecord, 'Start Time')),

      // Team member fields
      Name:             str(safe(sdkRecord, 'Name')),
      Type:             selectName(safe(sdkRecord, 'Type')),
      'Team Member':    extractLinkedIds(safe(sdkRecord, 'Team Member')),
    },
  };
}
