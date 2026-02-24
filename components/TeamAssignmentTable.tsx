
import React, { useMemo } from 'react';
import { AirtableRecord, TeamMember, NameMapping } from '../types';
import { Search, Filter, UserX, UserCheck, Users, Clock } from 'lucide-react';

interface TeamAssignmentTableProps {
  filteredMembers: TeamMember[];
  serviceRecords: AirtableRecord[];
  title: string;
  nameMapping: NameMapping;
  // Filter Controls
  searchTerm: string;
  onSearchChange: (val: string) => void;
  typeFilter: string;
  onTypeChange: (val: string) => void;
  statusFilter: 'all' | 'assigned' | 'unassigned';
  onStatusChange: (val: 'all' | 'assigned' | 'unassigned') => void;
  uniqueTypes: string[];
}

const TeamAssignmentTable: React.FC<TeamAssignmentTableProps> = ({ 
  filteredMembers, 
  serviceRecords, 
  title,
  nameMapping,
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  uniqueTypes
}) => {

  const serviceMap = useMemo(() => serviceRecords.reduce((acc, r) => {
    acc[r.id] = r;
    return acc;
  }, {} as Record<string, AirtableRecord>), [serviceRecords]);

  // Flatten member services into a list of rows for the table
  const getMemberRows = (member: TeamMember) => {
    const rows: { id: string; date: string; role: string; service: string; timing: string; sortValue: string; select?: boolean }[] = [];
    
    const processServices = (ids: string[], role: string) => {
      if (!ids) return;
      ids.forEach(id => {
        const record = serviceMap[id];
        if (record) {
          const timeSort = record.fields.From || record.fields["Start Time"] || record.fields.Timings || '00:00';
          const sortValue = `${record.fields.Date || '9999-99-99'}T${timeSort}`;

          rows.push({
            id: record.id,
            date: record.fields.Date || 'Unspecified',
            role: role,
            service: record.fields.Service || 'Unknown Service',
            timing: formatTiming(record.fields.Timings),
            sortValue: sortValue,
            select: record.fields.Select
          });
        }
      });
    };

    processServices(member.coordinatorServiceIds, 'Coordinator');
    processServices(member.teamMemberServiceIds, 'Team Member');
    processServices(member.standbyServiceIds, 'Standby');

    return rows.sort((a, b) => {
      return a.sortValue.localeCompare(b.sortValue);
    });
  };

  const getOrdinalDate = (dateStr: string) => {
    let cleanDateStr = dateStr;
    if (dateStr.toLowerCase().includes('th') || dateStr.toLowerCase().includes('rd') || dateStr.toLowerCase().includes('st') || dateStr.toLowerCase().includes('nd')) {
       cleanDateStr = dateStr.replace(/(st|nd|rd|th)/gi, '');
    }
    const date = new Date(cleanDateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }); 
    const month = date.toLocaleString('en-US', { month: 'short' });
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';
    return `${weekday}, ${day}${suffix} ${month}`;
  };

  const formatTiming = (timing: any) => {
    if (!timing) return '';
    const timingStr = Array.isArray(timing) ? String(timing[0]) : String(timing);
    if (!timingStr || timingStr === 'undefined' || timingStr === 'null') return '';
    return timingStr
      .replace(/am/gi, 'AM')
      .replace(/pm/gi, 'PM')
      .replace(/\s*:\s*/g, ':') 
      .replace(/\s*-\s*/g, ' - ')
      .replace(/\s+to\s+/gi, ' - ')
      .trim();
  };

  const resolveNames = (ids: string[] | undefined) => {
    if (!ids || ids.length === 0) return '-';
    return ids.map(id => nameMapping[id] || id).join(', ');
  };

  const renderTeamInfo = (recordId: string, role: string, isSelected?: boolean) => {
    const record = serviceMap[recordId];
    if (!record) return null;
    
    // Check record.fields.Select as fallback if not passed, but passing is safer if logic shifts
    // Actually, record.fields.Select is the truth.
    const selected = record.fields.Select;
    const baseColor = selected ? 'text-red-600' : 'text-slate-500';
    const labelColor = selected ? 'text-red-400' : 'text-slate-400';

    if (role === 'Team Member') {
      return (
        <div className={`text-[10px] leading-tight ${baseColor}`}>
          <span className={`font-black ${labelColor}`}>COORD:</span> {resolveNames(record.fields.Coordinator)}
        </div>
      );
    } else if (role === 'Coordinator') {
      return (
        <div className="space-y-1">
          <div className={`text-[10px] leading-tight ${baseColor}`}>
            <span className={`font-black ${labelColor}`}>TEAM:</span> {resolveNames(record.fields["Team Members"])}
          </div>
          {record.fields.Standby && record.fields.Standby.length > 0 && (
            <div className={`text-[10px] leading-tight ${baseColor}`}>
              <span className={`font-black ${labelColor}`}>STANDBY:</span> {resolveNames(record.fields.Standby)}
            </div>
          )}
        </div>
      );
    } else { // Standby
      return (
        <div className="space-y-1">
          <div className={`text-[10px] leading-tight ${baseColor}`}>
            <span className={`font-black ${labelColor}`}>COORD:</span> {resolveNames(record.fields.Coordinator)}
          </div>
          <div className={`text-[10px] leading-tight ${baseColor}`}>
            <span className={`font-black ${labelColor}`}>TEAM:</span> {resolveNames(record.fields["Team Members"])}
          </div>
        </div>
      );
    }
  };

  const resetFilters = () => {
    onSearchChange('');
    onTypeChange('All');
    onStatusChange('all');
  };

  return (
    <div className="bg-white">
      <style>{`
        .keep-together {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Filter Toolbar */}
      <div className="no-print p-6 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search member name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all text-sm font-medium"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all cursor-pointer"
            value={typeFilter}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            {uniqueTypes.map(t => <option key={t} value={t}>{t} Members</option>)}
          </select>
        </div>

        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          <button 
            onClick={() => onStatusChange('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${statusFilter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            <Users className="w-3.5 h-3.5" /> All
          </button>
          <button 
            onClick={() => onStatusChange('assigned')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${statusFilter === 'assigned' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Assigned
          </button>
          <button 
            onClick={() => onStatusChange('unassigned')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${statusFilter === 'unassigned' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}
          >
            <UserX className="w-3.5 h-3.5" /> Unassigned
          </button>
        </div>
        
        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-auto">
          {filteredMembers.length} Results
        </div>
      </div>

      <div className="bg-white p-8 md:p-12 text-slate-900 min-h-screen">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-1">
            {title}
          </h2>
          <div className="h-1.5 w-24 bg-amber-500 mx-auto mt-4 rounded-full"></div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <UserX className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-bold uppercase tracking-widest opacity-50">No members found</p>
            <button 
              onClick={resetFilters}
              className="mt-4 text-xs font-black text-amber-600 uppercase tracking-widest hover:underline no-print"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredMembers.map((member) => {
                const rows = getMemberRows(member);
                if (rows.length === 0 && statusFilter === 'assigned') return null;

                return (
                  <div key={member.id} className="keep-together">
                    <div className="flex items-center gap-3 mb-3 border-b-2 border-slate-900 pb-2">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                            {member.name.charAt(0)}
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">
                        {member.name}
                        </h3>
                        <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded uppercase tracking-wider">
                            {member.type}
                        </span>
                    </div>

                    {rows.length > 0 ? (
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="px-4 py-3 w-[40%]">Service & Role</th>
                                        <th className="px-4 py-3 w-[35%]">Team</th>
                                        <th className="px-4 py-3 w-[25%]">Date & Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((row, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-200'}>
                                            <td className="px-4 py-3 align-top">
                                                <div className={`font-bold mb-1 ${row.select ? 'text-red-600' : 'text-slate-900'}`}>{row.service}</div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide
                                                    ${row.role === 'Coordinator' ? 'bg-indigo-100 text-indigo-700' : 
                                                      row.role === 'Team Member' ? 'bg-slate-100 text-slate-600' : 
                                                      'bg-amber-100 text-amber-700'}`}>
                                                    {row.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                {renderTeamInfo(row.id, row.role)}
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <div className="font-bold text-slate-700">{getOrdinalDate(row.date)}</div>
                                                {row.timing && (
                                                    <div className={`inline-flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md text-[10px] font-black mt-1 w-fit ${row.select ? 'text-red-600' : 'text-amber-700'}`}>
                                                        <Clock className="w-3 h-3" />
                                                        {row.timing}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                            No assignments scheduled
                        </div>
                    )}
                  </div>
                );
            })}
          </div>
        )}

        <div className="mt-16 border-t border-slate-100 pt-8 flex justify-between items-center opacity-40">
             <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
               DUTY ASSIGNMENTS &bull; {new Date().toLocaleDateString()}
             </p>
        </div>
      </div>
    </div>
  );
};

export default TeamAssignmentTable;
