
import { AppConfig } from '../types';

export const sendToWhatsapp = async (config: AppConfig, pdfUrl: string, fileName: string) => {
  const { aisensyApiKey, aisensyCampaignName, whatsappRecipient } = config;

  if (!aisensyApiKey || !aisensyCampaignName || !whatsappRecipient) {
    throw new Error('AiSensy configuration missing');
  }

  const payload = {
    apiKey: aisensyApiKey,
    campaignName: aisensyCampaignName,
    destination: whatsappRecipient,
    userName: 'Festival Team',
    templateParams: [],
    media: {
      url: pdfUrl,
      filename: fileName
    }
  };

  const response = await fetch('https://backend.aisensy.com/campaign/v1/api/v2/campaign/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to send WhatsApp message: ${response.statusText}`);
  }

  return response.json();
};
