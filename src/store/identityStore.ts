import { create } from 'zustand';

import { KV_KEYS, kv } from '../services/storage/kv';
import { randomId } from '../utils/bytes';

export const NICK_MAX = 24;

interface IdentityState {
  /** Persistent UUID of this device in the mesh. */
  nodeId: string;
  nick: string | null;
  permissionsAcknowledged: boolean;
  load: () => void;
  setNick: (nick: string) => void;
  setPermissionsAcknowledged: () => void;
}

export const validateNick = (raw: string): string | null => {
  const nick = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (nick.length < 2) return 'Nick musi mieć co najmniej 2 znaki.';
  if (nick.length > NICK_MAX) return `Nick może mieć maksymalnie ${NICK_MAX} znaki.`;
  return null;
};

export const useIdentityStore = create<IdentityState>((set) => ({
  nodeId: '',
  nick: null,
  permissionsAcknowledged: false,

  /** Loads identity synchronously; generates the device UUID on first launch. */
  load: () => {
    let nodeId = kv.get(KV_KEYS.nodeId);
    if (!nodeId) {
      nodeId = randomId();
      kv.set(KV_KEYS.nodeId, nodeId);
    }
    set({
      nodeId,
      nick: kv.get(KV_KEYS.nick),
      permissionsAcknowledged: kv.get(KV_KEYS.permissionsAcknowledged) === '1',
    });
  },

  setNick: (nick) => {
    const clean = nick.trim();
    kv.set(KV_KEYS.nick, clean);
    set({ nick: clean });
  },

  setPermissionsAcknowledged: () => {
    kv.set(KV_KEYS.permissionsAcknowledged, '1');
    set({ permissionsAcknowledged: true });
  },
}));
