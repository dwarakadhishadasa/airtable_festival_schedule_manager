
import React from 'react';
import { CheckCircle, XCircle, X, Circle } from 'lucide-react';

interface TableStatus {
  activitiesFound: boolean;
  servicesFound: boolean;
  teamFound: boolean;
}

interface SetupGuideProps {
  /** When true, rendered as a full-screen replacement (tables missing).
   *  When false, rendered as a slide-over modal (help button). */
  asModal?: boolean;
  tableStatus?: TableStatus;
  onClose?: () => void;
}

const REQUIRED = 'Required';
const OPTIONAL = 'Optional';

const SCHEMA = [
  {
    table: 'Activities',
    description: 'Your event programme — one row per activity or session.',
    fields: [
      { name: 'Date',     type: 'Date or Text',        note: 'e.g. 2025-01-15',                   required: REQUIRED },
      { name: 'Category', type: 'Single line text',     note: 'Groups rows, e.g. "Morning Program"', required: REQUIRED },
      { name: 'Activity', type: 'Single line text',     note: 'Name of the activity',               required: REQUIRED },
      { name: 'From',     type: 'Single line text',     note: 'Start time for sorting, e.g. "08:00"', required: OPTIONAL },
      { name: 'Location', type: 'Single line text',     note: 'Venue or hall',                      required: OPTIONAL },
      { name: 'Timings',  type: 'Single line text',     note: 'Display string, e.g. "8:00 – 9:30 AM"', required: OPTIONAL },
      { name: 'Select',   type: 'Checkbox',             note: 'Highlights row in red when checked', required: OPTIONAL },
    ],
  },
  {
    table: 'Services',
    description: 'Each service or duty, with the people assigned to it.',
    fields: [
      { name: 'Date',         type: 'Date or Text',               note: 'Date the service occurs',           required: REQUIRED },
      { name: 'Category',     type: 'Single line text',           note: 'Groups services, e.g. "Prasad"',    required: REQUIRED },
      { name: 'Service',      type: 'Single line text',           note: 'Name of the service',               required: REQUIRED },
      { name: 'Coordinator',  type: 'Linked → Team Members',      note: 'One or more coordinators',          required: OPTIONAL },
      { name: 'Team Members', type: 'Linked → Team Members',      note: 'Team members assigned',             required: OPTIONAL },
      { name: 'Standby',      type: 'Linked → Team Members',      note: 'Backup members',                    required: OPTIONAL },
      { name: 'Timings',      type: 'Single line text',           note: 'Display timing string',             required: OPTIONAL },
      { name: 'Select',       type: 'Checkbox',                   note: 'Highlights row in red when checked', required: OPTIONAL },
    ],
  },
  {
    table: 'Team Members',
    description: 'Your volunteer or staff roster.',
    fields: [
      { name: 'Name',        type: 'Single line text',        note: 'Full name',                                     required: REQUIRED },
      { name: 'Type',        type: 'Single select or Text',   note: 'Category for filtering, e.g. "FTM", "Staff"',   required: OPTIONAL },
      { name: 'Coordinator', type: 'Linked → Services',       note: 'Auto-created reverse link from Services table',  required: OPTIONAL },
      { name: 'Team Member', type: 'Linked → Services',       note: 'Auto-created reverse link from Services table',  required: OPTIONAL },
      { name: 'Standby',     type: 'Linked → Services',       note: 'Auto-created reverse link from Services table',  required: OPTIONAL },
    ],
  },
];

const TableCard: React.FC<{ schema: typeof SCHEMA[0]; found?: boolean }> = ({ schema, found }) => {
  const statusDot =
    found === undefined ? null :
    found
      ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      : <XCircle    className="w-4 h-4 text-red-400 flex-shrink-0" />;

  const borderColor = found === false ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-2xl border ${borderColor} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        {statusDot}
        <div>
          <p className="font-black text-slate-900 text-sm">{schema.table}</p>
          <p className="text-slate-400 text-[11px] mt-0.5">{schema.description}</p>
        </div>
        {found === false && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-100 px-2 py-1 rounded">
            Missing
          </span>
        )}
        {found === true && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
            Found
          </span>
        )}
      </div>
      <div className="px-5 py-3">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-slate-400 font-black uppercase tracking-widest">
              <th className="text-left py-1.5 w-[30%]">Field name</th>
              <th className="text-left py-1.5 w-[30%]">Type</th>
              <th className="text-left py-1.5 w-[10%]"></th>
              <th className="text-left py-1.5 w-[30%]">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {schema.fields.map(f => (
              <tr key={f.name}>
                <td className="py-1.5 font-bold text-slate-800">{f.name}</td>
                <td className="py-1.5 text-slate-500">{f.type}</td>
                <td className="py-1.5">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    f.required === REQUIRED
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {f.required === REQUIRED ? 'REQ' : 'OPT'}
                  </span>
                </td>
                <td className="py-1.5 text-slate-400 leading-tight">{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SetupGuide: React.FC<SetupGuideProps> = ({ asModal = false, tableStatus, onClose }) => {
  const missingCount = tableStatus
    ? [tableStatus.activitiesFound, tableStatus.servicesFound, tableStatus.teamFound].filter(v => !v).length
    : 0;

  const getTableFound = (table: string) => {
    if (!tableStatus) return undefined;
    if (table === 'Activities')   return tableStatus.activitiesFound;
    if (table === 'Services')     return tableStatus.servicesFound;
    if (table === 'Team Members') return tableStatus.teamFound;
    return undefined;
  };

  const content = (
    <div className={asModal ? '' : 'max-w-3xl mx-auto'}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {asModal && missingCount > 0 ? (
            <>
              <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded mb-3">
                <XCircle className="w-3 h-3" />
                {missingCount} table{missingCount > 1 ? 's' : ''} missing
              </div>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">Base setup required</h2>
              <p className="text-slate-500 text-sm mt-1">
                Create the tables below in your Airtable base, then reload the extension.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded mb-3">
                <Circle className="w-3 h-3" />
                Schema Reference
              </div>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">Required base structure</h2>
              <p className="text-slate-500 text-sm mt-1">
                This extension reads from three tables. Field names must match exactly (case-sensitive).
              </p>
            </>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors ml-4 flex-shrink-0"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Tip about linked fields */}
      <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-800 font-medium leading-relaxed">
        <strong>Tip:</strong> The <em>Coordinator</em>, <em>Team Member</em>, and <em>Standby</em> fields in{' '}
        <strong>Team Members</strong> are reverse-linked fields. Create the link in the{' '}
        <strong>Services</strong> table first — Airtable will automatically create the matching
        fields in <strong>Team Members</strong>.
      </div>

      {/* Table cards */}
      <div className="space-y-4">
        {SCHEMA.map(s => (
          <TableCard key={s.table} schema={s} found={getTableFound(s.table)} />
        ))}
      </div>

      <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-8">
        Field names are case-sensitive &bull; Reload after creating tables
      </p>
    </div>
  );

  // Full-screen replacement (tables missing, no modal chrome)
  if (!asModal) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
        {content}
      </div>
    );
  }

  // Slide-over modal
  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
        <div className="p-6 sm:p-8">
          {content}
        </div>
      </div>
    </div>
  );
};

export default SetupGuide;
