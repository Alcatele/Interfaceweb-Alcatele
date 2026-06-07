export type AccessSettings = {
  adminCanViewRecordings: boolean;
};

const storageKey = 'pabx-cloud-access-settings';

const defaultSettings: AccessSettings = {
  adminCanViewRecordings: true,
};

export function getAccessSettings(): AccessSettings {
  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...(JSON.parse(stored) as AccessSettings) };
  } catch {
    return defaultSettings;
  }
}

export function saveAccessSettings(settings: AccessSettings) {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}
