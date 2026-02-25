
import React from 'react';
import { GroupedData, NameMapping } from '../types';
import { Clock } from 'lucide-react';

interface ServiceListTableProps {
  id: string;
  data: GroupedData;
  title: string;
  nameMapping: NameMapping;
}

const ServiceListTable: React.FC<ServiceListTableProps> = ({ id, data, title, nameMapping }) => {
  const allRecords = Object.values(data).flatMap(dateGroup => Object.values(dateGroup).flat());
  const hasCoordinator = allRecords.some(r => r.fields.Coordinator && r.fields.Coordinator.length > 0);
  const hasTeam = allRecords.some(r => r.fields['Team Members'] && r.fields['Team Members'].length > 0);
  const hasStandby = allRecords.some(r => r.fields.Standby && r.fields.Standby.length > 0);

  const getColWidths = () => {
    const weights = [
      { id: 'service', w: 3, show: true },
      { id: 'coord', w: 2, show: hasCoordinator },
      { id: 'team', w: 3, show: hasTeam },
      { id: 'standby', w: 2, show: hasStandby }
    ].filter(c => c.show);
    const total = weights.reduce((a, b) => a + b.w, 0);
    return weights.reduce((acc, curr) => {
      acc[curr.id] = `${(curr.w / total) * 100}%`;
      return acc;
    }, {} as Record<string, string>);
  };

  const colWidths = getColWidths();
  const colSpanCount = 1 + (hasCoordinator ? 1 : 0) + (hasTeam ? 1 : 0) + (hasStandby ? 1 : 0);

  const getOrdinalDate = (dateStr: string) => {
    let cleanDateStr = dateStr;
    if (/th|rd|st|nd/i.test(dateStr)) cleanDateStr = dateStr.replace(/(st|nd|rd|th)/gi, '');
    const date = new Date(cleanDateStr);
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

  const resolveNames = (ids: string[] | undefined) => {
    if (!ids || ids.length === 0) return '-';
    return ids.map(id => nameMapping[id] || id).join(', ');
  };

  if (allRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-700 font-bold text-base mb-1">No services found</p>
        <p className="text-slate-400 text-sm max-w-xs">
          Add records to your <strong>Services</strong> table. Each row needs a <strong>Date</strong>, <strong>Category</strong>, and <strong>Service</strong> field.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white relative">
      <style>{`
        .keep-together { page-break-inside: avoid !important; break-inside: avoid !important; }
        #service-capture tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div id={id} className="bg-white p-6 max-w-full text-slate-900">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-1">{title}</h2>
          <div className="h-1 w-12 bg-amber-500 mx-auto mt-2 rounded-full"></div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900">
              <th className="text-left py-3 px-1 text-[12px] font-black uppercase tracking-widest text-slate-900" style={{ width: colWidths.service }}>Service</th>
              {hasCoordinator && <th className="text-center py-3 px-1 text-[12px] font-black uppercase tracking-widest text-slate-900" style={{ width: colWidths.coord }}>Coordinator</th>}
              {hasTeam && <th className="text-center py-3 px-1 text-[12px] font-black uppercase tracking-widest text-slate-900" style={{ width: colWidths.team }}>Team</th>}
              {hasStandby && <th className="text-right py-3 px-1 text-[12px] font-black uppercase tracking-widest text-slate-900" style={{ width: colWidths.standby }}>Standby</th>}
            </tr>
          </thead>
          <tbody>
            {Object.entries(data)
              .sort(([dateA], [dateB]) => {
                if (dateA === 'Unspecified Date') return -1;
                if (dateB === 'Unspecified Date') return 1;
                return dateA.localeCompare(dateB);
              })
              .map(([date, categories]) => (
                <React.Fragment key={date}>
                  {date !== 'Unspecified Date' && (
                    <tr className="keep-together">
                      <td colSpan={colSpanCount} className="pt-9 pb-2 text-center">
                        <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-400">
                          {getOrdinalDate(date)}
                        </h3>
                      </td>
                    </tr>
                  )}
                  {Object.entries(categories)
                    .sort(([a], [b]) => extractSerial(a) - extractSerial(b))
                    .map(([category, records]) => (
                      <React.Fragment key={category}>
                        <tr className="keep-together">
                          <td colSpan={colSpanCount} className="bg-slate-900 p-0">
                            <div className="py-2 px-4 text-center">
                              <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                {cleanCategoryName(category)}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {records.map((record, index) => {
                          const isSelected = record.fields.Select;
                          return (
                            <tr key={record.id} className={`border-b border-slate-100 keep-together ${index % 2 === 1 ? 'bg-slate-200' : 'bg-white'}`}>
                              <td className="py-3 px-1 text-left align-top">
                                <p className={`text-[12px] font-bold leading-tight ${isSelected ? 'text-red-600' : 'text-slate-900'}`}>
                                  {record.fields.Service}
                                </p>
                                {record.fields.Timings && (
                                  <div className={`inline-flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md text-[10px] font-black uppercase mt-1.5 tracking-tight ${isSelected ? 'text-red-600' : 'text-amber-700'}`}>
                                    <Clock className="w-3 h-3" />
                                    {record.fields.Timings}
                                  </div>
                                )}
                              </td>
                              {hasCoordinator && (
                                <td className="py-3 px-1 text-center align-top">
                                  <p className={`text-[11px] font-medium leading-tight ${isSelected ? 'text-red-600' : 'text-slate-600'}`}>
                                    {resolveNames(record.fields.Coordinator)}
                                  </p>
                                </td>
                              )}
                              {hasTeam && (
                                <td className="py-3 px-1 text-center align-top">
                                  <p className={`text-[11px] font-medium leading-tight ${isSelected ? 'text-red-600' : 'text-slate-600'}`}>
                                    {resolveNames(record.fields['Team Members'])}
                                  </p>
                                </td>
                              )}
                              {hasStandby && (
                                <td className="py-3 px-1 text-right align-top">
                                  <p className={`text-[11px] font-medium leading-tight ${isSelected ? 'text-red-600' : 'text-slate-600'}`}>
                                    {resolveNames(record.fields.Standby)}
                                  </p>
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

        <div className="mt-10 border-t border-slate-100 pt-6 flex justify-between items-center opacity-30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            OFFICIAL SERVICE LIST &bull; {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServiceListTable;
