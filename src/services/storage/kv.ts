import Storage from 'expo-sqlite/kv-store';

/** Small synchronous key-value store (SQLite-backed) for identity and flags. */
export const KV_KEYS = {
  nodeId: 'identity.nodeId',
  nick: 'identity.nick',
  permissionsAcknowledged: 'onboarding.permissionsAcknowledged',
  theme: 'settings.theme',
} as const;

export const kv = {
  get(key: string): string | null {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    Storage.setItemSync(key, value);
  },
  remove(key: string) {
    Storage.removeItemSync(key);
  },
};
