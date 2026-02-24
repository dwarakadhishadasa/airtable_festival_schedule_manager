
import { AppConfig, AirtableRecord, TeamMember, NameMapping, PdfData } from '../types';

declare var pdfMake: any;

// Static Header Image Asset URL
export const HEADER_IMAGE_URL = 'https://festival-schedule-formatter.netlify.app/screenshot.png';

const LOCAL_STORAGE_IMAGE_KEY = 'fest_sched_header_image_cached_v1';

// --- Image Caching Logic ---

/**
 * Attempts to fetch the header image, convert to Base64, and store in LocalStorage.
 * Should be called on app initialization.
 */
export const initHeaderImage = async () => {
  // If already cached, do nothing
  if (localStorage.getItem(LOCAL_STORAGE_IMAGE_KEY)) {
    return;
  }

  // List of URLs to try: Direct -> Proxy
  const urlsToTry = [
    HEADER_IMAGE_URL,
    // Use a CORS proxy as fallback if the direct link fails due to CORS
    `https://api.allorigins.win/raw?url=${encodeURIComponent(HEADER_IMAGE_URL)}`
  ];

  for (const url of urlsToTry) {
    try {
      console.log(`Attempting to fetch header image from: ${url}`);
      // Add credentials: 'omit' to prevent sending cookies which might trigger stricter CORS on some servers
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      
      if (!response.ok) {
        console.warn(`Fetch failed for ${url}: ${response.status}`);
        continue;
      }
      
      const blob = await response.blob();
      
      // Validate it looks like an image (size check + type check loosely)
      // Some servers return application/octet-stream for images
      if (!blob.type.startsWith('image/') && blob.size < 1000) {
        console.warn(`URL returned non-image type/size: ${blob.type} (${blob.size} bytes)`);
        continue;
      }

      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Failed to convert blob to base64'));
        };
        reader.onerror = reject;
      });

      reader.readAsDataURL(blob);
      const base64data = await base64Promise;
      
      try {
        localStorage.setItem(LOCAL_STORAGE_IMAGE_KEY, base64data);
        console.log('Header image cached successfully via', url);
        return; // Success, exit loop
      } catch (e) {
        console.warn('Failed to save header image to local storage (quota exceeded?).', e);
        return;
      }

    } catch (error) {
      console.warn(`Error fetching ${url}:`, error);
    }
  }
  
  console.warn("Could not cache header image from any source. Schedule PDF will lack header image.");
};

/**
 * Retrieves the Base64 image from LocalStorage if available.
 * Fallback: tries to fetch it live (which might fail in PDF generation due to CORS).
 */
export const getHeaderImageBase64 = async (): Promise<string | null> => {
  // 1. Try Local Storage
  const cached = localStorage.getItem(LOCAL_STORAGE_IMAGE_KEY);
  if (cached) return cached;

  // 2. Try Live Fetch (Fallback)
  // Note: We don't try the proxy here to avoid slowing down generation unexpectedly, 
  // relying on initHeaderImage to have done the job.
  return null;
};

/**
 * Manually save a user-uploaded file as the header image.
 */
export const saveHeaderImageToCache = async (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(LOCAL_STORAGE_IMAGE_KEY, reader.result as string);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Clear the cached image.
 */
export const clearHeaderImageCache = () => {
  localStorage.removeItem(LOCAL_STORAGE_IMAGE_KEY);
};

/**
 * Check if image is cached.
 */
export const isHeaderImageCached = (): boolean => {
  return !!localStorage.getItem(LOCAL_STORAGE_IMAGE_KEY);
};

// --- PDF Helpers ---

// Helper to group data
const groupData = (data: AirtableRecord[]) => {
  const grouped: Record<string, Record<string, AirtableRecord[]>> = {};
  data.forEach(record => {
    const date = record.fields.Date || 'Unspecified Date';
    if (!grouped[date]) grouped[date] = {};
    const category = record.fields.Category || 'General';
    if (!grouped[date][category]) grouped[date][category] = [];
    grouped[date][category].push(record);
  });
  
  // Sort within categories
  Object.keys(grouped).forEach(date => {
    Object.keys(grouped[date]).forEach(cat => {
      grouped[date][cat].sort((a, b) => (a.fields.From || '').localeCompare(b.fields.From || ''));
    });
  });
  return grouped;
};

// Helper: Format Timings
const formatTiming = (timing: any) => {
  if (!timing) return '';
  const str = Array.isArray(timing) ? String(timing[0]) : String(timing);
  return str.replace(/am/gi, 'AM').replace(/pm/gi, 'PM').replace(/\s*-\s*/g, ' to ').trim();
};

// Helper: Resolve Names
const resolveNames = (ids: string[] | undefined, mapping: NameMapping) => {
  if (!ids || ids.length === 0) return '-';
  return ids.map(id => mapping[id] || id).join(', ');
};

// Helper: Clean Category Name
const cleanCategoryName = (name: string) => {
  return name.replace(/^\d+[\.\s]*/, '').trim();
};

const getOrdinalDate = (dateStr: string) => {
    let cleanDateStr = dateStr;
    if (dateStr.toLowerCase().includes('th') || dateStr.toLowerCase().includes('rd') || dateStr.toLowerCase().includes('st') || dateStr.toLowerCase().includes('nd')) {
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

// Helper: Add Header Image
const addHeaderImage = (content: any[], headerImageBase64: string | null) => {
  if (headerImageBase64) {
      // Width set to 515 to fill the page width (A4 595pt - 40pt margins * 2)
      content.push({ image: headerImageBase64, width: 515, alignment: 'center', margin: [0, 0, 0, 10] });
  }
};

// --- Generators ---

const generateScheduleDef = (records: AirtableRecord[], title: string, headerImageBase64: string | null) => {
  const grouped = groupData(records);
  const sortedDates = Object.keys(grouped).sort();
  const content: any[] = [];
  
  // Header Image
  addHeaderImage(content, headerImageBase64);

  content.push({ text: title, style: 'header' });
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#f59e0b' }], margin: [0, 0, 0, 20] });

  sortedDates.forEach(date => {
    content.push({ text: getOrdinalDate(date), style: 'dateHeader', alignment: 'center', margin: [0, 10, 0, 5] });
    
    const categories = grouped[date];
    Object.keys(categories).sort().forEach(cat => {
      content.push({ 
          table: {
              widths: ['*'],
              body: [[{ text: cleanCategoryName(cat).toUpperCase(), style: 'categoryHeader', fillColor: '#0f172a', color: 'white' }]]
          },
          layout: 'noBorders',
          margin: [0, 5, 0, 0]
      });

      const catRecords = categories[cat];
      
      // Determine columns based on data
      const hasLocation = catRecords.some(r => r.fields.Location);
      const hasTimings = catRecords.some(r => r.fields.Timings);

      // Define columns: Activity is always present
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
        
        const cells = [];

        cells.push({ text: r.fields.Activity || '-', style: 'cellActivity', fillColor, color: textColor });
        
        if (hasLocation) {
          cells.push({ 
              text: (r.fields.Location || '').toUpperCase(), 
              style: 'cellLocation', 
              alignment: 'center', 
              fillColor, 
              color: isSelected ? '#dc2626' : '#475569' 
          });
        }
        
        if (hasTimings) {
          cells.push({ 
              text: formatTiming(r.fields.Timings), 
              style: 'cellTime', 
              alignment: 'right', 
              fillColor,
              color: isSelected ? '#dc2626' : '#0f172a'
          });
        }
        
        return cells;
      });

      content.push({
        table: {
          headerRows: 0,
          dontBreakRows: true,
          widths: widths,
          body: rows
        },
        layout: {
            hLineWidth: (i: number, node: any) => (i === node.table.body.length) ? 0 : 1,
            vLineWidth: () => 0,
            hLineColor: '#e2e8f0'
        },
        margin: [0, 0, 0, 10]
      });
    });
  });

  return content;
};

const generateServicesDef = (records: AirtableRecord[], mapping: NameMapping, title: string) => {
  const grouped = groupData(records);
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    // Priority: Unspecified Date first
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
          table: {
              widths: ['*'],
              body: [[{ text: cleanCategoryName(cat).toUpperCase(), style: 'categoryHeader', fillColor: '#0f172a', color: 'white' }]]
          },
          layout: 'noBorders'
      });

      const catRecords = categories[cat];

      // Dynamic Columns Logic
      const hasCoordinator = catRecords.some(r => r.fields.Coordinator && r.fields.Coordinator.length > 0);
      const hasTeam = catRecords.some(r => r.fields["Team Members"] && r.fields["Team Members"].length > 0);
      const hasStandby = catRecords.some(r => r.fields.Standby && r.fields.Standby.length > 0);

      // Define Columns with relative weights
      const colDefs = [
        { id: 'service', label: 'Service', weight: 3, align: 'left', show: true },
        { id: 'coord', label: 'Coordinator', weight: 2, align: 'center', show: hasCoordinator },
        { id: 'team', label: 'Team', weight: 3, align: 'center', show: hasTeam },
        { id: 'standby', label: 'Standby', weight: 2, align: 'right', show: hasStandby }
      ].filter(c => c.show);

      // Calculate percentage widths
      const totalWeight = colDefs.reduce((sum, c) => sum + c.weight, 0);
      const widths = colDefs.map(c => `${(c.weight / totalWeight) * 100}%`);

      // Header Row
      const headerRow = colDefs.map(c => ({
        text: c.label,
        style: 'tableHeader',
        alignment: c.align
      }));

      const tableBody: any[] = [headerRow];

      catRecords.forEach((r, idx) => {
          const timingStr = formatTiming(r.fields.Timings);
          const fillColor = idx % 2 === 1 ? '#e2e8f0' : 'white';
          const isSelected = r.fields.Select;
          const textColor = isSelected ? '#dc2626' : undefined;

          const row: any[] = [];

          // Service Column
          row.push({ 
            stack: [
                { text: r.fields.Service || '-', bold: true, color: textColor },
                timingStr ? { 
                    text: ` ${timingStr} `, 
                    fontSize: 9, 
                    bold: true,
                    color: isSelected ? '#dc2626' : '#451a03', 
                    background: '#fef3c7', 
                    margin: [0, 2, 0, 0],
                    preserveLeadingSpaces: true
                } : null
            ],
            fillColor
          });

          // Optional Columns
          if (hasCoordinator) {
            row.push({ text: resolveNames(r.fields.Coordinator, mapping), fontSize: 9, alignment: 'center', fillColor, color: textColor });
          }
          if (hasTeam) {
            row.push({ text: resolveNames(r.fields["Team Members"], mapping), fontSize: 9, alignment: 'center', fillColor, color: textColor });
          }
          if (hasStandby) {
            row.push({ text: resolveNames(r.fields.Standby, mapping), fontSize: 9, alignment: 'right', fillColor, color: textColor });
          }

          tableBody.push(row);
      });

      content.push({
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: widths,
          body: tableBody
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 15]
      });
    });
  });

  return content;
};

// --- Team Def Generator ---

const generateTeamDef = (members: TeamMember[], serviceRecords: AirtableRecord[], mapping: NameMapping, title: string) => {
  const serviceMap = serviceRecords.reduce((acc, r) => ({ ...acc, [r.id]: r }), {} as Record<string, AirtableRecord>);
  
  const content: any[] = [];
  
  // Title
  content.push({ text: title, style: 'header', alignment: 'center' });
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#f59e0b' }], margin: [0, 0, 0, 20] });

  members.forEach((member) => {
    const rows: { id: string; date: string; role: string; service: string; timing: string; sortValue: string; select?: boolean }[] = [];
    
    const process = (ids: string[], role: string) => {
        if (!ids) return;
        ids.forEach(id => {
            const r = serviceMap[id];
            if (r) {
                const timeSort = r.fields.From || r.fields["Start Time"] || r.fields.Timings || '00:00';
                const sortValue = `${r.fields.Date || '9999-99-99'}T${timeSort}`;
                
                rows.push({
                    id: r.id,
                    date: getOrdinalDate(r.fields.Date || 'Unspecified'),
                    role,
                    service: r.fields.Service || '-',
                    timing: formatTiming(r.fields.Timings),
                    sortValue,
                    select: r.fields.Select
                });
            }
        });
    };

    process(member.coordinatorServiceIds, 'Coordinator');
    process(member.teamMemberServiceIds, 'Team Member');
    process(member.standbyServiceIds, 'Standby');

    rows.sort((a, b) => {
        return a.sortValue.localeCompare(b.sortValue);
    });

    if (rows.length === 0) return;

    const tableBody: any[] = [];
    tableBody.push([
        { text: 'SERVICE & ROLE', style: 'teamTableHeader' },
        { text: 'TEAM', style: 'teamTableHeader' },
        { text: 'DATE & TIME', style: 'teamTableHeader' }
    ]);

    rows.forEach((r, idx) => {
        const fillColor = idx % 2 === 0 ? null : '#e2e8f0';
        const serviceRec = serviceMap[r.id];
        
        const infoColor = r.select ? '#dc2626' : '#64748b'; // Red or Slate-500
        const labelColor = r.select ? '#ef4444' : '#64748b'; // Red-500 or Slate-500
        
        // Construct Team Info Text (Compact / Inline)
        const teamInfoText: any[] = [];
        
        if (r.role === 'Team Member') {
            teamInfoText.push({ text: 'COORD: ', bold: true, fontSize: 8, color: labelColor });
            teamInfoText.push({ text: resolveNames(serviceRec.fields.Coordinator, mapping), fontSize: 9, color: infoColor });
        } else if (r.role === 'Coordinator') {
            teamInfoText.push({ text: 'TEAM: ', bold: true, fontSize: 8, color: labelColor });
            teamInfoText.push({ text: resolveNames(serviceRec.fields["Team Members"], mapping), fontSize: 9, color: infoColor });
            if (serviceRec.fields.Standby?.length) {
                // Add separator space for compact display
                teamInfoText.push({ text: '   STANDBY: ', bold: true, fontSize: 8, color: labelColor });
                teamInfoText.push({ text: resolveNames(serviceRec.fields.Standby, mapping), fontSize: 9, color: infoColor });
            }
        } else { // Standby
            teamInfoText.push({ text: 'COORD: ', bold: true, fontSize: 8, color: labelColor });
            teamInfoText.push({ text: resolveNames(serviceRec.fields.Coordinator, mapping), fontSize: 9, color: infoColor });
            
            teamInfoText.push({ text: '   TEAM: ', bold: true, fontSize: 8, color: labelColor });
            teamInfoText.push({ text: resolveNames(serviceRec.fields["Team Members"], mapping), fontSize: 9, color: infoColor });
        }

        const baseTextColor = r.select ? '#dc2626' : '#1e293b';

        tableBody.push([
            { 
                stack: [
                    { text: r.service, bold: true, style: 'teamTableCell', color: baseTextColor },
                    { 
                        text: r.role.toUpperCase(), 
                        fontSize: 8, 
                        bold: true, 
                        color: r.role === 'Coordinator' ? '#4f46e5' : r.role === 'Standby' ? '#d97706' : '#475569',
                        margin: [0, 2, 0, 0]
                    }
                ],
                fillColor
            },
            { 
                text: teamInfoText, // Use text array for inline/wrapping instead of stack
                fillColor,
                margin: [0, 2, 0, 2]
            },
            { 
                stack: [
                    { text: r.date, style: 'teamTableCell', color: baseTextColor },
                    r.timing ? { 
                        text: ` ${r.timing} `, 
                        fontSize: 9, 
                        bold: true,
                        color: r.select ? '#dc2626' : '#451a03', 
                        background: '#fef3c7', 
                        margin: [0, 2, 0, 0],
                        preserveLeadingSpaces: true
                    } : null
                ],
                fillColor 
            }
        ]);
    });

    const isBig = rows.length > 15;

    const memberStack = {
        stack: [
            {
                text: member.name.toUpperCase(),
                style: 'memberName',
                margin: [0, 10, 0, 5],
                color: '#0f172a',
                bold: true,
                fontSize: 14
            },
            {
                table: {
                    headerRows: 1,
                    dontBreakRows: true,
                    widths: ['40%', '35%', '25%'],
                    body: tableBody
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 15]
            }
        ],
        unbreakable: !isBig
    };

    content.push(memberStack);
  });

  return content;
};

// --- Main Export ---

export const generatePdfBlob = async (
  options: PdfData, 
  config: AppConfig
): Promise<Blob> => {
  const { viewMode, schedule, services, teamMembers, serviceRecords, nameMapping, reportOptions, attachedImages } = options;
  let content: any = [];
  
  let headerImageBase64: string | null = null;
  if (viewMode === 'schedule' || viewMode === 'full') {
    headerImageBase64 = await getHeaderImageBase64();
  }

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

      if (opts.includeSchedule) {
        parts.push(generateScheduleDef(schedule, config.pdfTitle, null));
      }
      
      if (opts.includeServices) {
        parts.push(generateServicesDef(services, nameMapping, config.servicePdfTitle));
      }
      
      if (opts.includeTeam) {
        parts.push(generateTeamDef(teamMembers, serviceRecords, nameMapping, config.teamPdfTitle));
      }

      parts.forEach((partContent, index) => {
        content.push(...partContent);
        if (index < parts.length - 1) {
          content.push({ text: '', pageBreak: 'after' });
        }
      });
      
      if (content.length === 0) {
           content.push({ text: 'No sections selected for report.', alignment: 'center', margin: [0, 50] });
      }

      // Add attached images at the very end
      if (attachedImages && attachedImages.length > 0) {
        
        attachedImages.forEach((img, idx) => {
            content.push({ text: '', pageBreak: 'after' });
            
            content.push({ 
                text: img.name, 
                style: 'header', 
                margin: [0, 0, 0, 20] 
            });
            
            content.push({
                image: img.data,
                width: 500, // Fit within standard A4 margins
                alignment: 'center',
                margin: [0, 0, 0, 20]
            });
        });
      }

  } else {
      throw new Error("Insufficient data for PDF generation");
  }

  const docDefinition = {
    content: content,
    footer: (currentPage: number, pageCount: number) => {
        return { 
            text: `Generated by FestSched • ${new Date().toLocaleDateString()} • Page ${currentPage} of ${pageCount}`, 
            alignment: 'center', 
            fontSize: 8, 
            color: '#cbd5e1',
            margin: [0, 10, 0, 0]
        };
    },
    styles: {
        header: { fontSize: 22, bold: true, alignment: 'center', color: '#0f172a' },
        subheader: { fontSize: 16, bold: true, color: '#0f172a', margin: [0, 10, 0, 5] },
        dateHeader: { fontSize: 14, bold: true, color: '#334155' },
        categoryHeader: { fontSize: 10, bold: true, color: 'white', alignment: 'center', margin: [0, 2, 0, 2] },
        tableHeader: { fontSize: 10, bold: true, color: '#0f172a', margin: [0, 2, 0, 2] },
        cellActivity: { fontSize: 10, bold: true, color: '#0f172a' },
        cellLocation: { fontSize: 9, color: '#475569', bold: true },
        cellTime: { fontSize: 9, bold: true, color: '#0f172a' },
        smallTime: { fontSize: 8 },
        memberName: { fontSize: 14, bold: true, color: '#0f172a' },
        smallDate: { fontSize: 10, bold: true, color: '#475569' },
        teamTableHeader: { fontSize: 9, bold: true, color: '#64748b', margin: [0, 2, 0, 2] },
        teamTableCell: { fontSize: 10, color: '#1e293b', margin: [0, 2, 0, 2] }
    },
    defaultStyle: {
        font: 'Roboto'
    },
    pageMargins: [40, 40, 40, 40]
  };

  return new Promise((resolve, reject) => {
    try {
        const pdfDocGenerator = pdfMake.createPdf(docDefinition);
        pdfDocGenerator.getBlob((blob: Blob) => {
            resolve(blob);
        });
    } catch (e) {
        reject(e);
    }
  });
};

export const downloadPdf = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
