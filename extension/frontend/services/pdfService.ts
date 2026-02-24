
// Import pdfmake as ES module instead of relying on the window.pdfMake CDN global.
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore — vfs_fonts has no default export types but works at runtime
import pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? pdfFonts;

import { AppConfig, AirtableRecord, TeamMember, NameMapping, PdfData } from '../types';

// --- PDF Helpers ---

const groupData = (data: AirtableRecord[]) => {
  const grouped: Record<string, Record<string, AirtableRecord[]>> = {};
  data.forEach(record => {
    const date = record.fields.Date || 'Unspecified Date';
    if (!grouped[date]) grouped[date] = {};
    const category = record.fields.Category || 'General';
    if (!grouped[date][category]) grouped[date][category] = [];
    grouped[date][category].push(record);
  });
  Object.keys(grouped).forEach(date => {
    Object.keys(grouped[date]).forEach(cat => {
      grouped[date][cat].sort((a, b) => (a.fields.From || '').localeCompare(b.fields.From || ''));
    });
  });
  return grouped;
};

const formatTiming = (timing: any) => {
  if (!timing) return '';
  const str = Array.isArray(timing) ? String(timing[0]) : String(timing);
  return str.replace(/am/gi, 'AM').replace(/pm/gi, 'PM').replace(/\s*-\s*/g, ' to ').trim();
};

const resolveNames = (ids: string[] | undefined, mapping: NameMapping) => {
  if (!ids || ids.length === 0) return '-';
  return ids.map(id => mapping[id] || id).join(', ');
};

const cleanCategoryName = (name: string) => name.replace(/^\d+[\.\s]*/, '').trim();

const getOrdinalDate = (dateStr: string) => {
  let cleanDateStr = dateStr;
  if (/th|rd|st|nd/i.test(dateStr)) {
    cleanDateStr = dateStr.replace(/(st|nd|rd|th)/gi, '');
  }
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

const addHeaderImage = (content: any[], headerImageBase64: string | null) => {
  if (headerImageBase64) {
    content.push({ image: headerImageBase64, width: 515, alignment: 'center', margin: [0, 0, 0, 10] });
  }
};

// --- Section Generators ---

const generateScheduleDef = (records: AirtableRecord[], title: string, headerImageBase64: string | null) => {
  const grouped = groupData(records);
  const sortedDates = Object.keys(grouped).sort();
  const content: any[] = [];

  addHeaderImage(content, headerImageBase64);
  content.push({ text: title, style: 'header' });
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#f59e0b' }], margin: [0, 0, 0, 20] });

  sortedDates.forEach(date => {
    content.push({ text: getOrdinalDate(date), style: 'dateHeader', alignment: 'center', margin: [0, 10, 0, 5] });
    const categories = grouped[date];
    Object.keys(categories).sort().forEach(cat => {
      content.push({
        table: { widths: ['*'], body: [[{ text: cleanCategoryName(cat).toUpperCase(), style: 'categoryHeader', fillColor: '#0f172a', color: 'white' }]] },
        layout: 'noBorders',
        margin: [0, 5, 0, 0]
      });
      const catRecords = categories[cat];
      const hasLocation = catRecords.some(r => r.fields.Location);
      const hasTimings = catRecords.some(r => r.fields.Timings);
      const colDefs = [
        { id: 'activity', weight: 4, show: true },
        { id: 'location', weight: 3, show: hasLocation },
        { id: 'timings', weight: 3, show: hasTimings }
      ].filter(c => c.show);
      const totalWeight = colDefs.reduce((a, b) => a + b.weight, 0);
      const widths = colDefs.map(c => `${(c.weight / totalWeight) * 100}%`);
      const rows = catRecords.map((r, i) => {
        const fillColor = i % 2 === 1 ? '#e2e8f0' : null;
        const isSelected = r.fields.Select;
        const textColor = isSelected ? '#dc2626' : '#0f172a';
        const cells: any[] = [{ text: r.fields.Activity || '-', style: 'cellActivity', fillColor, color: textColor }];
        if (hasLocation) cells.push({ text: (r.fields.Location || '').toUpperCase(), style: 'cellLocation', alignment: 'center', fillColor, color: isSelected ? '#dc2626' : '#475569' });
        if (hasTimings) cells.push({ text: formatTiming(r.fields.Timings), style: 'cellTime', alignment: 'right', fillColor, color: isSelected ? '#dc2626' : '#0f172a' });
        return cells;
      });
      content.push({
        table: { headerRows: 0, dontBreakRows: true, widths, body: rows },
        layout: { hLineWidth: (i: number, node: any) => (i === node.table.body.length) ? 0 : 1, vLineWidth: () => 0, hLineColor: '#e2e8f0' },
        margin: [0, 0, 0, 10]
      });
    });
  });
  return content;
};

const generateServicesDef = (records: AirtableRecord[], mapping: NameMapping, title: string) => {
  const grouped = groupData(records);
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === 'Unspecified Date') return -1;
    if (b === 'Unspecified Date') return 1;
    return a.localeCompare(b);
  });
  const content: any[] = [];
  content.push({ text: title, style: 'header' });
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#f59e0b' }], margin: [0, 0, 0, 20] });
  sortedDates.forEach(date => {
    if (date !== 'Unspecified Date') {
      content.push({ text: getOrdinalDate(date), style: 'dateHeader', alignment: 'center', margin: [0, 10, 0, 5] });
    }
    const categories = grouped[date];
    Object.keys(categories).sort().forEach(cat => {
      content.push({
        table: { widths: ['*'], body: [[{ text: cleanCategoryName(cat).toUpperCase(), style: 'categoryHeader', fillColor: '#0f172a', color: 'white' }]] },
        layout: 'noBorders'
      });
      const catRecords = categories[cat];
      const hasCoordinator = catRecords.some(r => r.fields.Coordinator && r.fields.Coordinator.length > 0);
      const hasTeam = catRecords.some(r => r.fields['Team Members'] && r.fields['Team Members'].length > 0);
      const hasStandby = catRecords.some(r => r.fields.Standby && r.fields.Standby.length > 0);
      const colDefs = [
        { id: 'service', label: 'Service', weight: 3, align: 'left', show: true },
        { id: 'coord', label: 'Coordinator', weight: 2, align: 'center', show: hasCoordinator },
        { id: 'team', label: 'Team', weight: 3, align: 'center', show: hasTeam },
        { id: 'standby', label: 'Standby', weight: 2, align: 'right', show: hasStandby }
      ].filter(c => c.show);
      const totalWeight = colDefs.reduce((sum, c) => sum + c.weight, 0);
      const widths = colDefs.map(c => `${(c.weight / totalWeight) * 100}%`);
      const headerRow = colDefs.map(c => ({ text: c.label, style: 'tableHeader', alignment: c.align }));
      const tableBody: any[] = [headerRow];
      catRecords.forEach((r, idx) => {
        const timingStr = formatTiming(r.fields.Timings);
        const fillColor = idx % 2 === 1 ? '#e2e8f0' : 'white';
        const isSelected = r.fields.Select;
        const textColor = isSelected ? '#dc2626' : undefined;
        const row: any[] = [];
        row.push({
          stack: [
            { text: r.fields.Service || '-', bold: true, color: textColor },
            timingStr ? { text: ` ${timingStr} `, fontSize: 9, bold: true, color: isSelected ? '#dc2626' : '#451a03', background: '#fef3c7', margin: [0, 2, 0, 0], preserveLeadingSpaces: true } : null
          ],
          fillColor
        });
        if (hasCoordinator) row.push({ text: resolveNames(r.fields.Coordinator, mapping), fontSize: 9, alignment: 'center', fillColor, color: textColor });
        if (hasTeam) row.push({ text: resolveNames(r.fields['Team Members'], mapping), fontSize: 9, alignment: 'center', fillColor, color: textColor });
        if (hasStandby) row.push({ text: resolveNames(r.fields.Standby, mapping), fontSize: 9, alignment: 'right', fillColor, color: textColor });
        tableBody.push(row);
      });
      content.push({ table: { headerRows: 1, dontBreakRows: true, widths, body: tableBody }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 15] });
    });
  });
  return content;
};

const generateTeamDef = (members: TeamMember[], serviceRecords: AirtableRecord[], mapping: NameMapping, title: string) => {
  const serviceMap = serviceRecords.reduce((acc, r) => ({ ...acc, [r.id]: r }), {} as Record<string, AirtableRecord>);
  const content: any[] = [];
  content.push({ text: title, style: 'header', alignment: 'center' });
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#f59e0b' }], margin: [0, 0, 0, 20] });
  members.forEach(member => {
    const rows: { id: string; date: string; role: string; service: string; timing: string; sortValue: string; select?: boolean }[] = [];
    const process = (ids: string[], role: string) => {
      if (!ids) return;
      ids.forEach(id => {
        const r = serviceMap[id];
        if (r) {
          const timeSort = r.fields.From || r.fields['Start Time'] || r.fields.Timings || '00:00';
          rows.push({ id: r.id, date: getOrdinalDate(r.fields.Date || 'Unspecified'), role, service: r.fields.Service || '-', timing: formatTiming(r.fields.Timings), sortValue: `${r.fields.Date || '9999-99-99'}T${timeSort}`, select: r.fields.Select });
        }
      });
    };
    process(member.coordinatorServiceIds, 'Coordinator');
    process(member.teamMemberServiceIds, 'Team Member');
    process(member.standbyServiceIds, 'Standby');
    rows.sort((a, b) => a.sortValue.localeCompare(b.sortValue));
    if (rows.length === 0) return;
    const tableBody: any[] = [[
      { text: 'SERVICE & ROLE', style: 'teamTableHeader' },
      { text: 'TEAM', style: 'teamTableHeader' },
      { text: 'DATE & TIME', style: 'teamTableHeader' }
    ]];
    rows.forEach((r, idx) => {
      const fillColor = idx % 2 === 0 ? null : '#e2e8f0';
      const serviceRec = serviceMap[r.id];
      const infoColor = r.select ? '#dc2626' : '#64748b';
      const labelColor = r.select ? '#ef4444' : '#64748b';
      const teamInfoText: any[] = [];
      if (r.role === 'Team Member') {
        teamInfoText.push({ text: 'COORD: ', bold: true, fontSize: 8, color: labelColor });
        teamInfoText.push({ text: resolveNames(serviceRec.fields.Coordinator, mapping), fontSize: 9, color: infoColor });
      } else if (r.role === 'Coordinator') {
        teamInfoText.push({ text: 'TEAM: ', bold: true, fontSize: 8, color: labelColor });
        teamInfoText.push({ text: resolveNames(serviceRec.fields['Team Members'], mapping), fontSize: 9, color: infoColor });
        if (serviceRec.fields.Standby?.length) {
          teamInfoText.push({ text: '   STANDBY: ', bold: true, fontSize: 8, color: labelColor });
          teamInfoText.push({ text: resolveNames(serviceRec.fields.Standby, mapping), fontSize: 9, color: infoColor });
        }
      } else {
        teamInfoText.push({ text: 'COORD: ', bold: true, fontSize: 8, color: labelColor });
        teamInfoText.push({ text: resolveNames(serviceRec.fields.Coordinator, mapping), fontSize: 9, color: infoColor });
        teamInfoText.push({ text: '   TEAM: ', bold: true, fontSize: 8, color: labelColor });
        teamInfoText.push({ text: resolveNames(serviceRec.fields['Team Members'], mapping), fontSize: 9, color: infoColor });
      }
      const baseTextColor = r.select ? '#dc2626' : '#1e293b';
      tableBody.push([
        { stack: [{ text: r.service, bold: true, style: 'teamTableCell', color: baseTextColor }, { text: r.role.toUpperCase(), fontSize: 8, bold: true, color: r.role === 'Coordinator' ? '#4f46e5' : r.role === 'Standby' ? '#d97706' : '#475569', margin: [0, 2, 0, 0] }], fillColor },
        { text: teamInfoText, fillColor, margin: [0, 2, 0, 2] },
        { stack: [{ text: r.date, style: 'teamTableCell', color: baseTextColor }, r.timing ? { text: ` ${r.timing} `, fontSize: 9, bold: true, color: r.select ? '#dc2626' : '#451a03', background: '#fef3c7', margin: [0, 2, 0, 0], preserveLeadingSpaces: true } : null], fillColor }
      ]);
    });
    content.push({ stack: [{ text: member.name.toUpperCase(), style: 'memberName', margin: [0, 10, 0, 5], color: '#0f172a', bold: true, fontSize: 14 }, { table: { headerRows: 1, dontBreakRows: true, widths: ['40%', '35%', '25%'], body: tableBody }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 15] }], unbreakable: rows.length <= 15 });
  });
  return content;
};

// --- Main Export ---

/**
 * Builds the pdfmake docDefinition and immediately triggers a browser download
 * via pdfmake's built-in .download() method.
 *
 * We use .download() instead of .getBlob() + URL.createObjectURL() because
 * pdfmake's getBlob() callback never fires inside the Airtable extension iframe
 * (the promise hangs indefinitely). pdfmake's .download() bypasses that entirely.
 *
 * headerImageBase64 is passed directly from globalConfig (via App.tsx) instead of
 * being fetched from localStorage as in the PWA version.
 */
export const generateAndDownloadPdf = (
  options: PdfData,
  config: AppConfig,
  headerImageBase64: string | null = null,
  filename: string
): void => {
  const { viewMode, schedule, services, teamMembers, serviceRecords, nameMapping, reportOptions, attachedImages } = options;
  let content: any[] = [];

  if (viewMode === 'schedule' && schedule) {
    content = generateScheduleDef(schedule, config.pdfTitle, headerImageBase64);
  } else if (viewMode === 'services' && services && nameMapping) {
    content = generateServicesDef(services, nameMapping, config.servicePdfTitle);
  } else if (viewMode === 'team' && teamMembers && serviceRecords && nameMapping) {
    content = generateTeamDef(teamMembers, serviceRecords, nameMapping, config.teamPdfTitle);
  } else if (viewMode === 'full' && schedule && services && teamMembers && serviceRecords && nameMapping) {
    const opts = reportOptions || { includeSchedule: true, includeServices: true, includeTeam: true };
    addHeaderImage(content, headerImageBase64);
    const parts = [];
    if (opts.includeSchedule) parts.push(generateScheduleDef(schedule, config.pdfTitle, null));
    if (opts.includeServices) parts.push(generateServicesDef(services, nameMapping, config.servicePdfTitle));
    if (opts.includeTeam) parts.push(generateTeamDef(teamMembers, serviceRecords, nameMapping, config.teamPdfTitle));
    parts.forEach((partContent, index) => {
      content.push(...partContent);
      if (index < parts.length - 1) content.push({ text: '', pageBreak: 'after' });
    });
    if (content.length === 0) content.push({ text: 'No sections selected for report.', alignment: 'center', margin: [0, 50] });
    if (attachedImages && attachedImages.length > 0) {
      attachedImages.forEach(img => {
        content.push({ text: '', pageBreak: 'after' });
        content.push({ text: img.name, style: 'header', margin: [0, 0, 0, 20] });
        content.push({ image: img.data, width: 500, alignment: 'center', margin: [0, 0, 0, 20] });
      });
    }
  } else {
    throw new Error('Insufficient data for PDF generation');
  }

  const docDefinition = {
    content,
    footer: (currentPage: number, pageCount: number) => ({
      text: `Generated by FestSched • ${new Date().toLocaleDateString()} • Page ${currentPage} of ${pageCount}`,
      alignment: 'center', fontSize: 8, color: '#cbd5e1', margin: [0, 10, 0, 0]
    }),
    styles: {
      header: { fontSize: 22, bold: true, alignment: 'center', color: '#0f172a' },
      subheader: { fontSize: 16, bold: true, color: '#0f172a', margin: [0, 10, 0, 5] },
      dateHeader: { fontSize: 14, bold: true, color: '#334155' },
      categoryHeader: { fontSize: 10, bold: true, color: 'white', alignment: 'center', margin: [0, 2, 0, 2] },
      tableHeader: { fontSize: 10, bold: true, color: '#0f172a', margin: [0, 2, 0, 2] },
      cellActivity: { fontSize: 10, bold: true, color: '#0f172a' },
      cellLocation: { fontSize: 9, color: '#475569', bold: true },
      cellTime: { fontSize: 9, bold: true, color: '#0f172a' },
      memberName: { fontSize: 14, bold: true, color: '#0f172a' },
      teamTableHeader: { fontSize: 9, bold: true, color: '#64748b', margin: [0, 2, 0, 2] },
      teamTableCell: { fontSize: 10, color: '#1e293b', margin: [0, 2, 0, 2] }
    },
    defaultStyle: { font: 'Roboto' },
    pageMargins: [40, 40, 40, 40]
  };

  (pdfMake as any).createPdf(docDefinition).download(filename);
};
