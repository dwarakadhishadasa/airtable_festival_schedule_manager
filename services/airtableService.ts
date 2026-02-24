import { AirtableResponse, AppConfig, NameMapping } from '../types';

export const fetchAirtableData = async (config: AppConfig, tableName: string): Promise<AirtableResponse> => {
  const { airtableBaseId, airtableApiKey } = config;
  
  if (!airtableBaseId || !tableName || !airtableApiKey) {
    throw new Error('Airtable configuration missing');
  }

  let allRecords: any[] = [];
  let offset: string | undefined = undefined;

  do {
    const baseUrl = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(tableName)}`;
    const url = offset ? `${baseUrl}?offset=${offset}` : baseUrl;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to fetch from Airtable: ${response.statusText}`);
    }

    const data = await response.json();
    allRecords = [...allRecords, ...(data.records || [])];
    offset = data.offset;
  } while (offset);

  return { records: allRecords };
};

export const fetchTeamMembersMapping = async (config: AppConfig): Promise<NameMapping> => {
  const tableName = "Team Members";
  try {
    const data = await fetchAirtableData(config, tableName);
    const mapping: NameMapping = {};
    data.records.forEach(record => {
      mapping[record.id] = record.fields.Name || record.id;
    });
    return mapping;
  } catch (error) {
    console.error("Failed to fetch team members mapping:", error);
    return {};
  }
};

export const fetchAirtableBaseName = async (config: AppConfig): Promise<string | null> => {
  const { airtableBaseId, airtableApiKey } = config;
  
  if (!airtableBaseId || !airtableApiKey) return null;

  try {
    const url = `https://api.airtable.com/v0/meta/bases`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${airtableApiKey}`,
      },
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    const matchingBase = data.bases?.find((b: any) => b.id === airtableBaseId);
    
    return matchingBase ? matchingBase.name : null;
  } catch (e) {
    console.error("Error fetching base name:", e);
    return null;
  }
};

export const fetchAirtableBases = async (apiKey: string): Promise<{id: string, name: string}[]> => {
  if (!apiKey) return [];

  try {
    const url = `https://api.airtable.com/v0/meta/bases`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch bases");
    
    const data = await response.json();
    return data.bases || [];
  } catch (e) {
    console.error("Error fetching bases list:", e);
    return [];
  }
};
