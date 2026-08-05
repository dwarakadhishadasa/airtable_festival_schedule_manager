
import React, { useEffect } from 'react';
import { useBase, useRecords } from '@airtable/blocks/ui';
import { Record as AirtableSDKRecord } from '@airtable/blocks/models';
import { TabConfig } from '../types';
import GroupedTableView from './GroupedTableView';
import LinkedPerItemView from './LinkedPerItemView';

interface TabContentProps {
  tab: TabConfig;
  isActive: boolean;
  onRecordsUpdate: (tabId: string, primary: AirtableSDKRecord[], detail?: AirtableSDKRecord[]) => void;
}

// ─── Grouped wrapper (calls useRecords once) ────────────────────────────────

interface GroupedInnerProps {
  tab: TabConfig;
  isActive: boolean;
  onRecordsUpdate: (tabId: string, primary: AirtableSDKRecord[]) => void;
}

const GroupedInner: React.FC<GroupedInnerProps> = ({ tab, isActive, onRecordsUpdate }) => {
  const base = useBase();
  const cfg = tab.groupedConfig!;
  const table = base.getTableByNameIfExists(cfg.tableName);
  const view = cfg.viewName && table ? table.getViewByNameIfExists(cfg.viewName) : null;
  const records = useRecords(view ?? table) ?? [];

  useEffect(() => {
    onRecordsUpdate(tab.id, records);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  return (
    <div style={{ display: isActive ? undefined : 'none' }}>
      <GroupedTableView
        id={`tab-capture-${tab.id}`}
        sdkRecords={records}
        config={cfg}
        title={tab.pdfTitle || tab.label}
      />
    </div>
  );
};

// ─── Linked-per-item wrapper (calls useRecords twice) ───────────────────────

interface LinkedInnerProps {
  tab: TabConfig;
  isActive: boolean;
  onRecordsUpdate: (tabId: string, primary: AirtableSDKRecord[], detail: AirtableSDKRecord[]) => void;
}

const LinkedInner: React.FC<LinkedInnerProps> = ({ tab, isActive, onRecordsUpdate }) => {
  const base = useBase();
  const cfg = tab.linkedConfig!;
  const primaryTable = base.getTableByNameIfExists(cfg.primaryTableName);
  const detailTable = base.getTableByNameIfExists(cfg.detailTableName);
  const primaryView = cfg.primaryViewName && primaryTable ? primaryTable.getViewByNameIfExists(cfg.primaryViewName) : null;
  const detailView = cfg.detailViewName && detailTable ? detailTable.getViewByNameIfExists(cfg.detailViewName) : null;
  const primaryRecords = useRecords(primaryView ?? primaryTable) ?? [];
  const detailRecords = useRecords(detailView ?? detailTable) ?? [];

  useEffect(() => {
    onRecordsUpdate(tab.id, primaryRecords, detailRecords);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryRecords, detailRecords]);

  return (
    <div style={{ display: isActive ? undefined : 'none' }}>
      <LinkedPerItemView
        id={`tab-capture-${tab.id}`}
        primaryRecords={primaryRecords}
        detailRecords={detailRecords}
        config={cfg}
        title={tab.pdfTitle || tab.label}
      />
    </div>
  );
};

// ─── Public dispatcher ───────────────────────────────────────────────────────

const TabContent: React.FC<TabContentProps> = ({ tab, isActive, onRecordsUpdate }) => {
  if (tab.viewType === 'grouped' && tab.groupedConfig) {
    return (
      <GroupedInner
        tab={tab}
        isActive={isActive}
        onRecordsUpdate={(id, primary) => onRecordsUpdate(id, primary)}
      />
    );
  }
  if (tab.viewType === 'linked-per-item' && tab.linkedConfig) {
    return (
      <LinkedInner
        tab={tab}
        isActive={isActive}
        onRecordsUpdate={(id, primary, detail) => onRecordsUpdate(id, primary, detail)}
      />
    );
  }
  return (
    <div
      style={{ display: isActive ? undefined : 'none' }}
      className="flex items-center justify-center py-24 text-slate-400 font-bold text-sm"
    >
      This tab is not configured yet. Open Settings to finish setup.
    </div>
  );
};

export default TabContent;
