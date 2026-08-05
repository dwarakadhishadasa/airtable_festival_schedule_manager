import { AppConfig, SavedViewConfig } from '../types';

const TITLE_SEPARATOR = ' - ';

const normalizeTitle = (title: string) => title.trim().toUpperCase();

export const getFestivalTitlePrefix = (config: Pick<AppConfig, 'pdfTitle' | 'servicePdfTitle' | 'teamPdfTitle'>) => {
  const titles = [config.pdfTitle, config.servicePdfTitle, config.teamPdfTitle];
  for (const title of titles) {
    const normalized = normalizeTitle(title || '');
    const separatorIndex = normalized.lastIndexOf(TITLE_SEPARATOR);
    if (separatorIndex > 0) return normalized.slice(0, separatorIndex);
  }
  return '';
};

export const formatSavedViewTitle = (
  view: Pick<SavedViewConfig, 'label' | 'pdfTitle' | 'viewType'>,
  config: Pick<AppConfig, 'pdfTitle' | 'servicePdfTitle' | 'teamPdfTitle'>,
) => {
  const title = normalizeTitle(view.pdfTitle || view.label || 'Untitled View');
  if (view.viewType === 'built-in') return title;

  const prefix = getFestivalTitlePrefix(config);
  if (!prefix || title.startsWith(`${prefix}${TITLE_SEPARATOR}`)) return title;

  return `${prefix}${TITLE_SEPARATOR}${title}`;
};
