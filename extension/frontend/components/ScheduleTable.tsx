
import React from 'react';
import { GroupedData } from '../types';
import { Clock } from 'lucide-react';

interface ScheduleTableProps {
  id: string;
  data: GroupedData;
  title: string;
  // Passed from App.tsx which reads it from globalConfig — no localStorage needed.
  headerImageBase64?: string | null;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ id, data, title, headerImageBase64 }) => {
  const allRecords = Object.values(data).flatMap(dateGroup => Object.values(dateGroup).flat());
  const hasLocation = allRecords.some(r => r.fields.Location);
  const hasTimings = allRecords.some(r => r.fields.Timings);

  const getColWidths = () => {
    const weights = [
      { id: 'activity', w: 4, show: true },
      { id: 'location', w: 3, show: hasLocation },
      { id: 'timings', w: 3, show: hasTimings }
    ].filter(c => c.show);
    const total = weights.reduce((a, b) => a + b.w, 0);
    return weights.reduce((acc, curr) => {
      acc[curr.id] = `${(curr.w / total) * 100}%`;
      return acc;
    }, {} as Record<string, string>);
  };

  const colWidths = getColWidths();
  const colSpanCount = 1 + (hasLocation ? 1 : 0) + (hasTimings ? 1 : 0);

  const getOrdinalDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';
    return `${weekday}, ${day}${suffix} ${month} ${year}`;
  };

  const extractSerial = (name: string): number => {
    const match = name.match(/^\d+/);
    return match ? parseInt(match[0], 10) : 999;
  };

  const cleanCategoryName = (name: string) => name.replace(/^\d+[\.\s]*/, '').trim();

  const formatTiming = (timing: any) => {
    if (!timing) return '';
    const timingStr = Array.isArray(timing) ? String(timing[0]) : String(timing);
    if (!timingStr || timingStr === 'undefined' || timingStr === 'null') return '';
    return timingStr
      .replace(/am/gi, 'AM')
      .replace(/pm/gi, 'PM')
      .replace(/\s*:\s*/g, ':')
      .replace(/\s*-\s*/g, ' to ')
      .replace(/\s+to\s+/gi, ' to ')
      .trim();
  };

  if (Object.keys(data).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-700 font-bold text-base mb-1">No activities found</p>
        <p className="text-slate-400 text-sm max-w-xs">
          Add records to your <strong>Activities</strong> table. Each row needs a <strong>Date</strong>, <strong>Category</strong>, and <strong>Activity</strong> field.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <style>{`
        .keep-together { page-break-inside: avoid !important; break-inside: avoid !important; }
        #schedule-capture tr { page-break-inside: avoid !important; break-inside: avoid !important; }
      `}</style>

      <div id={id} className="bg-white p-6 max-w-full text-slate-900">

        {/* Header image — shown only when available from globalConfig */}
        {headerImageBase64 && (
          <div className="mb-6 w-full">
            <img src={headerImageBase64} alt="Schedule Header" className="w-full h-auto" />
          </div>
        )}

        <div className="text-center mb-6">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-1">{title}</h2>
          <div className="h-1 w-12 bg-amber-500 mx-auto mt-2 rounded-full"></div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900">
              <th className="text-left py-4 px-2 text-[10px] font-black uppercase tracking-widest text-slate-900" style={{ width: colWidths.activity }}>Activity</th>
              {hasLocation && <th className="text-center py-4 px-2 text-[10px] font-black uppercase tracking-widest text-slate-900" style={{ width: colWidths.location }}>Venue</th>}
              {hasTimings && <th className="text-right py-4 px-2 text-[10px] font-black uppercase tracking-widest text-slate-900" style={{ width: colWidths.timings }}>Timings</th>}
            </tr>
          </thead>
          <tbody>
            {Object.entries(data)
              .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
              .map(([date, categories]) => (
                <React.Fragment key={date}>
                  <tr className="keep-together">
                    <td colSpan={colSpanCount} className="pt-10 pb-4">
                      <div className="text-center">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                          {getOrdinalDate(date)}
                        </h3>
                      </div>
                    </td>
                  </tr>
                  {Object.entries(categories)
                    .sort(([a], [b]) => extractSerial(a) - extractSerial(b))
                    .map(([category, records]) => (
                      <React.Fragment key={category}>
                        <tr className="keep-together">
                          <td colSpan={colSpanCount} className="bg-slate-900 p-0">
                            <div className="py-2 px-4 text-center">
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                {cleanCategoryName(category)}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {records.map((record, index) => {
                          const isSelected = record.fields.Select;
                          return (
                            <tr key={record.id} className={`border-b border-slate-100 keep-together ${index % 2 === 1 ? 'bg-slate-200' : 'bg-white'}`}>
                              <td className="py-4 px-2 text-left align-middle">
                                <p className={`text-[12px] font-bold leading-tight ${isSelected ? 'text-red-600' : 'text-slate-900'}`}>
                                  {record.fields.Activity}
                                </p>
                              </td>
                              {hasLocation && (
                                <td className="py-4 px-2 text-center align-middle">
                                  <span className={`inline-block px-2 py-1 bg-white rounded text-[9px] font-bold uppercase shadow-sm ${isSelected ? 'text-red-600' : 'text-slate-600'}`}>
                                    {record.fields.Location}
                                  </span>
                                </td>
                              )}
                              {hasTimings && (
                                <td className="py-4 px-2 text-right align-middle">
                                  {record.fields.Timings && (
                                    <span className={`inline-flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded text-[10px] font-black uppercase whitespace-nowrap ${isSelected ? 'text-red-600' : 'text-amber-700'}`}>
                                      <Clock className="w-3 h-3" />
                                      {formatTiming(record.fields.Timings)}
                                    </span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                </React.Fragment>
              ))}
          </tbody>
        </table>

        <div className="mt-12 border-t border-slate-100 pt-6 flex justify-between items-center opacity-40">
          <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
            OFFICIAL SCHEDULE &bull; {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScheduleTable;
