
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore — vfs_fonts has no default export types but works at runtime
import pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? pdfFonts;

import { Record as AirtableSDKRecord } from '@airtable/blocks/models';
import {
  TabConfig, GroupedViewConfig, LinkedPerItemConfig,
  ColumnConfig, DetailColumnConfig, StackedFieldConfig,
} from '../types';
import {
  safeStr, safeLinkedNames, safeLinkedIds, safeCheckbox,
  getOrdinalDate, cleanCategoryName,
} from './sdkHelpers';

// ─── Shared style definitions ─────────────────────────────────────────────────

const STYLES = {
  header:         { fontSize: 22, bold: true, alignment: 'center', color: '#0f172a' },
  dateHeader:     { fontSize: 13, bold: true, color: '#94a3b8', alignment: 'center' },
  categoryHeader: { fontSize: 10, bold: true, color: 'white',   alignment: 'center', margin: [0, 2, 0, 2] },
  tableHeader:    { fontSize: 10, bold: true, color: '#0f172a', margin: [0, 2, 0, 2] },
};

function headerBar(title: string): any[] {
  return [
    { text: title, style: 'header' },
    {
      canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#f59e0b' }],
      margin: [0, 0, 0, 20],
    },
  ];
}

// ─── Backward-compat stacked field helpers ────────────────────────────────────

function getColumnStackedFields(col: ColumnConfig): StackedFieldConfig[] {
  if (col.stackedFields && col.stackedFields.length > 0) return col.stackedFields;
  if (col.secondaryFieldName && col.secondaryTreatment) {
    return [{ fieldName: col.secondaryFieldName, treatment: col.secondaryTreatment }];
  }
  return [];
}

function getDetailStackedFields(col: DetailColumnConfig): StackedFieldConfig[] {
  if (col.stackedFields && col.stackedFields.length > 0) return col.stackedFields;
  if (col.secondaryFieldName && col.secondaryTreatment) {
    return [{
      fieldName: col.secondaryFieldName,
      treatment: col.secondaryTreatment,
      showInlineFieldName: col.secondaryShowInlineFieldName,
    }];
  }
  return [];
}

// ─── Generic grouped-table field node ─────────────────────────────────────────

function buildFieldNode(
  record: AirtableSDKRecord,
  fieldName: string,
  treatment: string,
  isSelected: boolean,
  fillColor: string | null,
  textColor: string | undefined,
  secondary: boolean,
  overrideFontSize?: number,
  overrideFontWeight?: 'normal' | 'bold',
): any {
  const fontSize = overrideFontSize ?? (secondary ? 8 : 10);
  const color = textColor ?? (secondary ? '#64748b' : '#0f172a');
  const isBold = overrideFontWeight === 'bold';

  if (treatment === 'text') {
    return { text: safeStr(record, fieldName) || '-', fontSize, bold: isBold, color, fillColor, margin: secondary ? [0, 2, 0, 0] : undefined };
  }
  if (treatment === 'linked-names') {
    const lnSize = overrideFontSize ?? (secondary ? 7 : 9);
    return { text: safeLinkedNames(record, fieldName), fontSize: lnSize, bold: isBold, color, fillColor, margin: secondary ? [0, 2, 0, 0] : undefined };
  }
  // 'highlight' treatment — also handles legacy 'timing' values from old saved configs
  if (treatment === 'highlight' || treatment === 'timing') {
    const t = safeStr(record, fieldName);
    if (!t) return { text: '—', fontSize, color: '#94a3b8', fillColor };
    const hSize = overrideFontSize ?? (secondary ? 7 : 9);
    return {
      text: ` ${t} `,
      fontSize: hSize,
      bold: overrideFontWeight !== 'normal',
      color: isSelected ? '#dc2626' : '#451a03',
      background: '#fef3c7',
      preserveLeadingSpaces: true,
      margin: secondary ? [0, 2, 0, 0] : undefined,
    };
  }
  return { text: '', fillColor };
}

// ─── Grouped table PDF content ────────────────────────────────────────────────

function generateGroupedContent(
  records: AirtableSDKRecord[],
  config: GroupedViewConfig,
  title: string,
  headerImageBase64: string | null,
): any[] {
  const content: any[] = [];

  if (headerImageBase64) {
    content.push({ image: headerImageBase64, width: 515, alignment: 'center', margin: [0, 0, 0, 10] });
  }
  content.push(...headerBar(title));

  const visibleColumns = config.columns.filter((c: ColumnConfig) => c.treatment !== 'checkbox-highlight');
  const highlightCol = config.columns.find((c: ColumnConfig) => c.treatment === 'checkbox-highlight');
  const hasSecondary = !!config.secondaryGroupField;

  const totalWeight = visibleColumns.reduce((s: number, c: ColumnConfig) => s + c.widthWeight, 0) || 1;
  const widths = visibleColumns.map((c: ColumnConfig) => `${(c.widthWeight / totalWeight) * 100}%`);

  // Group records
  const grouped: Record<string, Record<string, AirtableSDKRecord[]>> = {};
  records.forEach(record => {
    const pk = config.primaryGroupField
      ? safeStr(record, config.primaryGroupField) || 'Unspecified'
      : 'All';
    const sk = hasSecondary
      ? safeStr(record, config.secondaryGroupField) || 'General'
      : '_all';
    if (!grouped[pk]) grouped[pk] = {};
    if (!grouped[pk][sk]) grouped[pk][sk] = [];
    grouped[pk][sk].push(record);
  });

  if (config.sortField) {
    Object.values(grouped).forEach(sg =>
      Object.values(sg).forEach(recs =>
        recs.sort((a, b) => safeStr(a, config.sortField).localeCompare(safeStr(b, config.sortField)))
      )
    );
  }

  const sortedPrimary = Object.keys(grouped).sort((a, b) => {
    if (a === 'Unspecified') return 1;
    if (b === 'Unspecified') return -1;
    return a.localeCompare(b);
  });

  const makeHeaderRow = () => visibleColumns.map((col: ColumnConfig) => ({
    text: col.label,
    style: 'tableHeader',
    alignment: col.alignment,
  }));

  sortedPrimary.forEach(pk => {
    if (pk !== 'All') {
      content.push({
        text: getOrdinalDate(pk),
        style: 'dateHeader',
        margin: [0, 10, 0, 5],
      });
    }

    Object.entries(grouped[pk])
      .sort(([a], [b]) => {
        const na = parseInt(a.match(/^\d+/)?.[0] ?? '999', 10);
        const nb = parseInt(b.match(/^\d+/)?.[0] ?? '999', 10);
        return na !== nb ? na - nb : a.localeCompare(b);
      })
      .forEach(([sk, recs]) => {
        if (hasSecondary) {
          content.push({
            table: { widths: ['*'], body: [[{ text: cleanCategoryName(sk).toUpperCase(), style: 'categoryHeader', fillColor: '#0f172a', color: 'white' }]] },
            layout: 'noBorders',
            margin: [0, 5, 0, 0],
          });
        }

        const tableBody: any[] = [makeHeaderRow()];
        recs.forEach((record, idx) => {
          const isSelected = highlightCol ? safeCheckbox(record, highlightCol.fieldName) : false;
          const fillColor = idx % 2 === 1 ? '#e2e8f0' : null;
          const textColor = isSelected ? '#dc2626' : undefined;

          const row = visibleColumns.map((col: ColumnConfig) => {
            const primaryNode = buildFieldNode(record, col.fieldName, col.treatment, isSelected, fillColor, textColor, false, col.fontSize, col.fontWeight);
            const stackedFields = getColumnStackedFields(col);
            if (stackedFields.length > 0) {
              const stackNodes = stackedFields.map(sf =>
                buildFieldNode(record, sf.fieldName, sf.treatment, isSelected, fillColor, textColor, true, sf.fontSize, sf.fontWeight)
              );
              return { stack: [primaryNode, ...stackNodes], alignment: col.alignment, fillColor };
            }
            return { ...primaryNode, alignment: col.alignment };
          });

          tableBody.push(row);
        });

        content.push({
          table: { headerRows: 1, dontBreakRows: true, widths, body: tableBody },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 10],
        });
      });
  });

  return content;
}

// ─── Detail field node helper (for linked-per-item PDF) ───────────────────────

function buildDetailFieldNode(
  record: AirtableSDKRecord,
  col: Pick<DetailColumnConfig | StackedFieldConfig, 'fieldName' | 'treatment' | 'showInlineFieldName' | 'fontSize' | 'fontWeight'>,
  linkLabel: string,
  fillColor: string | null,
  secondary: boolean,
): any {
  if (col.treatment === 'link-label') {
    const fSize = col.fontSize ?? (secondary ? 7 : 9);
    return {
      text: linkLabel,
      fontSize: fSize,
      bold: col.fontWeight !== 'normal',
      color: '#475569',
      fillColor,
      margin: secondary ? [0, 2, 0, 0] : undefined,
    };
  }

  const fontSize = col.fontSize ?? (secondary ? 8 : 10);
  const color = secondary ? '#64748b' : '#0f172a';
  const isBold = col.fontWeight === 'bold';
  const prefixRun = col.showInlineFieldName
    ? { text: col.fieldName.toUpperCase() + ': ', fontSize: Math.max(6, fontSize - 2), color: '#94a3b8', bold: true }
    : null;

  if (col.treatment === 'text') {
    const val = safeStr(record, col.fieldName) || '-';
    if (prefixRun) {
      return { text: [prefixRun, { text: val, fontSize, color, bold: isBold }], fillColor, margin: secondary ? [0, 2, 0, 0] : undefined };
    }
    return { text: val, fontSize, bold: isBold, color, fillColor, margin: secondary ? [0, 2, 0, 0] : undefined };
  }

  if (col.treatment === 'linked-names') {
    const val = safeLinkedNames(record, col.fieldName);
    const lnSize = col.fontSize ?? (secondary ? 7 : 9);
    if (prefixRun) {
      return { text: [{ ...prefixRun, fontSize: Math.max(6, lnSize - 2) }, { text: val, fontSize: lnSize, color, bold: isBold }], fillColor, margin: secondary ? [0, 2, 0, 0] : undefined };
    }
    return { text: val, fontSize: lnSize, bold: isBold, color, fillColor, margin: secondary ? [0, 2, 0, 0] : undefined };
  }

  // 'highlight' treatment — also handles legacy 'timing' values
  if (col.treatment === 'highlight' || (col.treatment as string) === 'timing') {
    const t = safeStr(record, col.fieldName);
    if (!t) return { text: '—', fontSize, color: '#94a3b8', fillColor };
    const hSize = col.fontSize ?? (secondary ? 7 : 9);
    const highlightNode = {
      text: ` ${t} `,
      fontSize: hSize,
      bold: col.fontWeight !== 'normal',
      color: '#451a03',
      background: '#fef3c7',
      preserveLeadingSpaces: true,
    };
    if (prefixRun) {
      return { text: [{ ...prefixRun, fontSize: Math.max(6, hSize - 2) }, highlightNode], fillColor, margin: secondary ? [0, 2, 0, 0] : undefined };
    }
    return { ...highlightNode, fillColor, margin: secondary ? [0, 2, 0, 0] : undefined };
  }

  return { text: '', fillColor };
}

// ─── Linked-per-item PDF content ──────────────────────────────────────────────

function generateLinkedContent(
  primaryRecords: AirtableSDKRecord[],
  detailRecords: AirtableSDKRecord[],
  config: LinkedPerItemConfig,
  title: string,
): any[] {
  const content: any[] = [];
  content.push(...headerBar(title));

  // Normalize for backward compatibility
  const detailColumns = config.detailColumns ?? [];
  const linkFields = config.linkFields ?? [];

  if (!detailColumns.length) return content;

  const detailMap: Record<string, AirtableSDKRecord> = {};
  detailRecords.forEach(r => { detailMap[r.id] = r; });

  const sorted = [...primaryRecords].sort((a, b) =>
    safeStr(a, config.nameField).localeCompare(safeStr(b, config.nameField))
  );

  const gf = config.detailGroupByField;
  const colCount = detailColumns.length;
  const totalWeight = detailColumns.reduce((s, c) => s + (c.widthWeight ?? 1), 0) || 1;
  const colWidths = detailColumns.map(c => `${((c.widthWeight ?? 1) / totalWeight) * 100}%`);

  const makeHeaderRow = () => detailColumns.map(col => ({
    text: col.label,
    style: 'tableHeader',
    alignment: col.alignment ?? 'left',
  }));

  sorted.forEach(record => {
    const name = safeStr(record, config.nameField);
    if (!name) return;

    const rows: { detailRecord: AirtableSDKRecord; linkLabel: string; sortValue: string }[] = [];
    linkFields.forEach(lf => {
      safeLinkedIds(record, lf.fieldName).forEach(id => {
        const detail = detailMap[id];
        if (!detail) return;
        const sortVal = config.detailSortField ? safeStr(detail, config.detailSortField) : '9999';
        rows.push({ detailRecord: detail, linkLabel: lf.label, sortValue: sortVal });
      });
    });
    rows.sort((a, b) => a.sortValue.localeCompare(b.sortValue));
    if (rows.length === 0) return;

    // Build groups
    const buildGroups = () => {
      if (!gf) return [{ label: '', rows }];
      const map: Record<string, typeof rows> = {};
      rows.forEach(row => {
        const key = safeStr(row.detailRecord, gf) || 'Other';
        if (!map[key]) map[key] = [];
        map[key].push(row);
      });
      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, groupRows]) => ({ label, rows: groupRows }));
    };

    const tableBody: any[] = [makeHeaderRow()];
    let globalIdx = 0;

    buildGroups().forEach(({ label: groupLabel, rows: groupRows }) => {
      if (gf && groupLabel) {
        tableBody.push([
          {
            text: groupLabel.toUpperCase(),
            colSpan: colCount,
            bold: true, fontSize: 9, color: 'white', fillColor: '#1e293b',
            margin: [0, 2, 0, 2],
          },
          ...Array(colCount - 1).fill({}),
        ]);
      }
      groupRows.forEach(row => {
        const fillColor = globalIdx % 2 === 0 ? null : '#e2e8f0';
        globalIdx++;
        const dataRow = detailColumns.map(col => {
          const primary = buildDetailFieldNode(row.detailRecord, col, row.linkLabel, fillColor, false);
          const stackedFields = getDetailStackedFields(col);
          if (stackedFields.length > 0) {
            const stackNodes = stackedFields.map(sf =>
              buildDetailFieldNode(row.detailRecord, sf, row.linkLabel, fillColor, true)
            );
            return { stack: [primary, ...stackNodes], alignment: col.alignment ?? 'left', fillColor };
          }
          return { ...primary, alignment: col.alignment ?? 'left' };
        });
        tableBody.push(dataRow);
      });
    });

    content.push({
      stack: [
        { text: name.toUpperCase(), bold: true, fontSize: 13, color: '#0f172a', margin: [0, 10, 0, 4] },
        {
          table: { headerRows: 1, dontBreakRows: true, widths: colWidths, body: tableBody },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 10],
        },
      ],
      unbreakable: rows.length <= 12,
    });
  });

  return content;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function downloadTabPdf(
  tab: TabConfig,
  primaryRecords: AirtableSDKRecord[],
  detailRecords: AirtableSDKRecord[] | undefined,
  headerImageBase64: string | null,
): void {
  let content: any[];

  if (tab.viewType === 'grouped' && tab.groupedConfig) {
    content = generateGroupedContent(primaryRecords, tab.groupedConfig, tab.pdfTitle || tab.label, headerImageBase64);
  } else if (tab.viewType === 'linked-per-item' && tab.linkedConfig) {
    content = generateLinkedContent(primaryRecords, detailRecords ?? [], tab.linkedConfig, tab.pdfTitle || tab.label);
  } else {
    throw new Error('Tab is not fully configured for PDF generation');
  }

  buildAndDownload(content, `${tab.pdfTitle || tab.label}.pdf`);
}

export function downloadFullReport(
  parts: Array<{ tab: TabConfig; primary: AirtableSDKRecord[]; detail?: AirtableSDKRecord[] }>,
  attachedImages: Array<{ name: string; data: string }>,
  headerImageBase64: string | null,
): void {
  const content: any[] = [];

  if (headerImageBase64) {
    content.push({ image: headerImageBase64, width: 515, alignment: 'center', margin: [0, 0, 0, 10] });
  }

  parts.forEach((part, i) => {
    let sectionContent: any[];
    if (part.tab.viewType === 'grouped' && part.tab.groupedConfig) {
      sectionContent = generateGroupedContent(part.primary, part.tab.groupedConfig, part.tab.pdfTitle || part.tab.label, null);
    } else if (part.tab.viewType === 'linked-per-item' && part.tab.linkedConfig) {
      sectionContent = generateLinkedContent(part.primary, part.detail ?? [], part.tab.linkedConfig, part.tab.pdfTitle || part.tab.label);
    } else {
      return;
    }
    content.push(...sectionContent);
    if (i < parts.length - 1) content.push({ text: '', pageBreak: 'after' });
  });

  if (content.length === 0) {
    content.push({ text: 'No sections selected for report.', alignment: 'center', margin: [0, 50] });
  }

  attachedImages.forEach(img => {
    content.push({ text: '', pageBreak: 'after' });
    content.push({ text: img.name, style: 'header', margin: [0, 0, 0, 20] });
    content.push({ image: img.data, width: 500, alignment: 'center', margin: [0, 0, 0, 20] });
  });

  const filename = parts[0]?.tab.pdfTitle || parts[0]?.tab.label || 'full-report';
  buildAndDownload(content, `${filename}.pdf`);
}

function buildAndDownload(content: any[], filename: string): void {
  const docDefinition = {
    content,
    footer: (currentPage: number, pageCount: number) => ({
      text: `Generated by FestSched • ${new Date().toLocaleDateString()} • Page ${currentPage} of ${pageCount}`,
      alignment: 'center', fontSize: 8, color: '#cbd5e1', margin: [0, 10, 0, 0],
    }),
    styles: STYLES,
    defaultStyle: { font: 'Roboto' },
    pageMargins: [40, 40, 40, 40],
  };
  (pdfMake as any).createPdf(docDefinition).download(filename);
}
