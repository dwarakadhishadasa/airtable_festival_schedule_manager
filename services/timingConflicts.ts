import { AirtableRecord } from '../types';

export interface AssignmentForConflict {
  id: string;
  record: AirtableRecord;
  role: string;
  service: string;
}

export interface ConflictInfo {
  assignmentId: string;
  conflictIds: string[];
  label: string;
}

interface TimedAssignment {
  id: string;
  date: string;
  start: number;
  end: number;
  service: string;
  role: string;
}

const firstValue = (value: unknown) => {
  if (Array.isArray(value)) return value[0] === undefined ? '' : String(value[0]);
  return value === undefined || value === null ? '' : String(value);
};

const normalizeMeridiem = (value?: string) => {
  if (!value) return '';
  return value.toLowerCase().replace(/\./g, '');
};

const parseTime = (value: string, fallbackMeridiem = '') => {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = normalizeMeridiem(match[3]) || fallbackMeridiem;
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null;

  let normalizedHour = hour;
  if (meridiem === 'am') {
    normalizedHour = hour === 12 ? 0 : hour;
  } else if (meridiem === 'pm') {
    normalizedHour = hour === 12 ? 12 : hour + 12;
  }

  if (normalizedHour > 23) return null;
  return normalizedHour * 60 + minute;
};

const parseTimingText = (timing: unknown) => {
  const text = firstValue(timing);
  if (!text) return null;

  const matches = Array.from(text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/gi));
  if (matches.length < 2) return null;

  const first = matches[0];
  const second = matches[1];
  const secondMeridiem = normalizeMeridiem(second[3]);
  const firstMeridiem = normalizeMeridiem(first[3]) || secondMeridiem;
  const start = parseTime(`${first[1]}${first[2] ? `:${first[2]}` : ''}${firstMeridiem ? ` ${firstMeridiem}` : ''}`);
  const end = parseTime(`${second[1]}${second[2] ? `:${second[2]}` : ''}${secondMeridiem ? ` ${secondMeridiem}` : ''}`, firstMeridiem);

  if (start === null || end === null) return null;
  return { start, end: end <= start ? end + 24 * 60 : end };
};

const getTimingRange = (record: AirtableRecord) => {
  const from = firstValue(record.fields.From || record.fields["Start Time"]);
  const to = firstValue(record.fields.To);
  const start = parseTime(from);
  const end = parseTime(to);

  if (start !== null && end !== null) {
    return { start, end: end <= start ? end + 24 * 60 : end };
  }

  return parseTimingText(record.fields.Timings);
};

const overlaps = (a: TimedAssignment, b: TimedAssignment) => {
  return a.date === b.date && a.start < b.end && b.start < a.end;
};

export const findTimingConflicts = (assignments: AssignmentForConflict[]): Record<string, ConflictInfo> => {
  const timed = assignments.flatMap((assignment): TimedAssignment[] => {
    const range = getTimingRange(assignment.record);
    const date = firstValue(assignment.record.fields.Date);
    if (!range || !date) return [];
    return [{
      id: assignment.id,
      date,
      start: range.start,
      end: range.end,
      service: assignment.service,
      role: assignment.role,
    }];
  });

  const conflicts = new Map<string, TimedAssignment[]>();

  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      if (!overlaps(timed[i], timed[j])) continue;
      conflicts.set(timed[i].id, [...(conflicts.get(timed[i].id) ?? []), timed[j]]);
      conflicts.set(timed[j].id, [...(conflicts.get(timed[j].id) ?? []), timed[i]]);
    }
  }

  return Object.fromEntries(Array.from(conflicts.entries()).map(([assignmentId, items]) => [
    assignmentId,
    {
      assignmentId,
      conflictIds: items.map(item => item.id),
      label: items.map(item => `${item.service} (${item.role})`).join(', '),
    },
  ]));
};
