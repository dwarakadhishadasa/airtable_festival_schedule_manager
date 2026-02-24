
import React, { useState } from 'react';
import { GroupedData, NameMapping } from '../types';
import { Clock } from 'lucide-react';

// Keep this in sync with the value in extension/.env
const GEMINI_API_KEY = 'AIzaSyBk1LqHcluUWth13I2ezcgvUJcLRD9Rjrc';

interface ServiceListTableProps {
  id: string;
  data: GroupedData;
  title: string;
  nameMapping: NameMapping;
}

const ServiceListTable: React.FC<ServiceListTableProps> = ({ id, data, title, nameMapping }) => {
  const geminiApiKey = GEMINI_API_KEY;
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');

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

  const callGemini = async (promptType: 'announce' | 'analyze') => {
    if (!geminiApiKey) {
      alert('Gemini API key not set. Please add it in Settings.');
      return;
    }
    setIsLoading(true);
    setShowModal(true);
    setGeminiResult(null);
    const contextData = JSON.stringify({ data, nameMapping });
    let prompt = '';
    if (promptType === 'announce') {
      setModalTitle('✨ Draft Team Announcement');
      prompt = `You are a cheerful team coordinator. Based on the following service roster JSON, write a friendly, engaging, and clear WhatsApp/Email announcement for the team.
      - Group clearly by Date and then Service Category.
      - Use emojis to make it readable and fun.
      - Use the real names provided in the mapping.
      - Include specific timings if available.
      - End with an encouraging quote or message.
      - Format with clean spacing.
      Data: ${contextData}`;
    } else {
      setModalTitle('✨ Roster Analysis');
      prompt = `Analyse the following service roster JSON for insights.
      - Identify any potential conflicts (same person assigned to multiple roles on the same day).
      - Highlight team members with heavy workloads (appearing frequently across services).
      - Suggest any gaps if standby is empty (marked as '-' or missing).
      - Keep the tone professional, helpful, and concise.
      - Use bullet points.
      Data: ${contextData}`;
    }
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      setGeminiResult(text);
    } catch {
      setGeminiResult('Error generating content. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="bg-white relative">
      <style>{`
        .keep-together { page-break-inside: avoid !important; break-inside: avoid !important; }
        #service-capture tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* AI Actions Toolbar */}
      <div className="no-print bg-slate-50 border-b border-slate-200 p-3 flex justify-end gap-2 sticky top-0 z-10">
        <button
          onClick={() => callGemini('announce')}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:shadow-md transition-all hover:scale-105"
        >
          <span>✨ Draft Announcement</span>
        </button>
        <button
          onClick={() => callGemini('analyze')}
          className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-slate-50 transition-all hover:border-slate-300"
        >
          <span>✨ Analyse Roster</span>
        </button>
      </div>

      {/* Gemini Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                {modalTitle}
                {isLoading && <span className="animate-pulse">...</span>}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-white">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Consulting Gemini AI...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap font-medium">{geminiResult}</div>
              )}
            </div>
            {!isLoading && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button
                  onClick={() => { if (geminiResult) { navigator.clipboard.writeText(geminiResult); alert('Copied to clipboard!'); } }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors"
                >
                  Copy Text
                </button>
                <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
