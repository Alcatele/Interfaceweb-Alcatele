export type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  encryption: 'none' | 'starttls' | 'ssl';
  username: string;
  password: string;
  senderName: string;
  senderEmail: string;
  alertEmail: string;
  notifyMissedCalls: boolean;
  notifyTrunkFailures: boolean;
  notifyStorageLimit: boolean;
};

const storageKey = 'pabx-cloud-smtp-settings';

const defaultSettings: SmtpSettings = {
  enabled: false,
  host: 'smtp.alcatele.com.br',
  port: 587,
  encryption: 'starttls',
  username: 'notificações@alcatele.com.br',
  password: '',
  senderName: 'Alcatele Cloud PBX',
  senderEmail: 'notificações@alcatele.com.br',
  alertEmail: 'noc@alcatele.com.br',
  notifyMissedCalls: true,
  notifyTrunkFailures: true,
  notifyStorageLimit: true,
};

export function getSmtpSettings(): SmtpSettings {
  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...(JSON.parse(stored) as SmtpSettings) };
  } catch {
    return defaultSettings;
  }
}

export function saveSmtpSettings(settings: SmtpSettings) {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}

export async function testSmtpSettings(settings: SmtpSettings) {
  await new Promise((resolve) => window.setTimeout(resolve, 700));
  return Boolean(settings.host && settings.port && settings.senderEmail);
}

