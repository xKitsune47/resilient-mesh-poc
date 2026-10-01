import { AppState, AppStateStatus } from 'react-native';

import MeshPeripheral from '../../../modules/mesh-peripheral';
import { useChatStore } from '../../store/chatStore';
import { useIdentityStore } from '../../store/identityStore';
import { useMeshStore } from '../../store/meshStore';
import {
  ChatMessage,
  Conversation,
  dmConversationId,
  GENERAL_CONVERSATION_ID,
  GENERAL_GROUP_ID,
  groupConversationId,
} from '../../store/types';
import { TokenBucket } from '../../utils/RateLimiter';
import { randomId } from '../../utils/bytes';
import { createLogger } from '../../utils/logger';
import { Link, LinkManager } from '../ble/LinkManager';
import { chatRepository } from '../storage/chatRepository';
import { MeshRouter, sanitizeNick } from './MeshRouter';
import {
  AckPayload,
  BROADCAST_ID,
  ChatPayload,
  decodeJson,
  encodeJson,
  MeshPacket,
  PacketFlags,
  PacketType,
} from './packet';

const log = createLogger('MeshService');

export const MAX_MESSAGE_LENGTH = 500;
const ANNOUNCE_FOREGROUND_MS = 30_000;
const ANNOUNCE_BACKGROUND_MS = 60_000;
/** Retry schedule for messages without an ACK (DM) or not yet transmitted (group). */
const RETRY_DELAYS_MS = [4_000, 10_000, 20_000];
/** Clock skew tolerance for incoming timestamps. */
const MAX_FUTURE_SKEW_MS = 60_000;

interface Outgoing {
  message: ChatMessage;
  conversation: Conversation;
  attempt: number;
  transmitted: boolean;
  ackedBy: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
}

export type SendResult = { ok: true } | { ok: false; reason: 'empty' | 'too_long' | 'rate_limited'; retryInMs?: number };

/**
 * Application layer: chat semantics on top of the mesh router.
 *  - 1:1 messages are directed packets; the recipient answers with an ACK → "delivered".
 *  - Group messages are broadcast; every recipient ACKs, so we can show "delivered to N".
 *  - Unacknowledged DMs are retried with ForceFlood (a route may be stale), then marked failed.
 *  - Message ids are UUIDs; SQLite INSERT OR IGNORE makes delivery idempotent end to end.
 */
class MeshServiceImpl {
  private links = new LinkManager();
  private router: MeshRouter | null = null;
  private outgoing = new Map<string, Outgoing>();
  private sendLimiter = new TokenBucket(5, 1); // max burst 5, then 1 msg/s
  private unsubs: (() => void)[] = [];
  private appStateSub: { remove(): void } | null = null;
  private notificationTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  get isStarted() {
    return this.started;
  }

  async start() {
    if (this.started) return;
    const { nodeId, nick } = useIdentityStore.getState();
    if (!nodeId || !nick) throw new Error('Identity not initialised');
    this.started = true;

    await chatRepository.failPendingMessages();
    await this.ensureConversation({
      id: GENERAL_CONVERSATION_ID,
      type: 'group',
      title: '#ogólny',
      peerId: null,
    });
    await useChatStore.getState().loadConversations();

    this.router = new MeshRouter(this.links, { nodeId, nick });
    this.wireEvents(this.router);
    this.links.start(nodeId);
    this.router.start(ANNOUNCE_FOREGROUND_MS);

    // Foreground service keeps the process (JS engine + BLE) alive in the background.
    try {
      MeshPeripheral.startForegroundService('Mesh Chat', 'Szukam urządzeń w pobliżu…');
    } catch (e) {
      log.warn('Foreground service failed', e);
    }
    this.appStateSub = AppState.addEventListener('change', this.onAppState);
    useMeshStore.getState().set({ running: true });
  }

  async stop() {
    if (!this.started) return;
    this.started = false;
    this.appStateSub?.remove();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.outgoing.forEach((o) => o.timer && clearTimeout(o.timer));
    this.outgoing.clear();
    this.router?.stop();
    this.router = null;
    await this.links.stop();
    // A fresh LinkManager for a possible restart (BleManager can't be reused after destroy).
    this.links = new LinkManager();
    try {
      MeshPeripheral.stopForegroundService();
    } catch {}
    useMeshStore.getState().set({ running: false, links: [], nearby: [], nodes: [] });
  }

  private wireEvents(router: MeshRouter) {
    const mesh = useMeshStore.getState();
    const syncLinks = () => {
      mesh.set({
        links: this.links.getLinks().map((l) => ({
          id: l.id,
          kind: l.kind,
          peerNodeId: l.peerNodeId,
          peerNick: l.peerNick,
          mtu: l.mtu,
          connectedAt: l.connectedAt,
        })),
      });
      this.scheduleNotificationUpdate();
    };
    this.unsubs.push(
      this.links.on('radioChanged', (radio) => mesh.set({ radio })),
      this.links.on('nearbyChanged', (nearby) => {
        mesh.set({ nearby });
        syncLinks(); // nick/node id binding happens after HELLO
      }),
      this.links.on('linkUp', syncLinks),
      this.links.on('linkDown', syncLinks),
      router.on('nodesChanged', (nodes) => {
        mesh.set({ nodes });
        this.scheduleNotificationUpdate();
        this.refreshDmTitles(nodes);
      }),
      router.on('deliver', (packet, link) => {
        void this.onDeliver(packet, link).catch((e) => log.error('deliver failed', e));
      })
    );
    mesh.set({ radio: this.links.getRadio() });
  }

  // --------------------------------------------------------------------------------------
  // Public API used by the UI
  // --------------------------------------------------------------------------------------

  async sendMessage(conversationId: string, rawText: string): Promise<SendResult> {
    const text = rawText.trim();
    if (!text) return { ok: false, reason: 'empty' };
    if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: 'too_long' };
    if (!this.sendLimiter.tryTake()) {
      return { ok: false, reason: 'rate_limited', retryInMs: this.sendLimiter.msUntilAvailable() };
    }
    const conversation = useChatStore.getState().conversations.find((c) => c.id === conversationId);
    if (!conversation) throw new Error(`Unknown conversation ${conversationId}`);

    const { nodeId, nick } = useIdentityStore.getState();
    const message: ChatMessage = {
      id: randomId(),
      conversationId,
      senderId: nodeId,
      senderNick: nick ?? '',
      text,
      timestamp: Date.now(),
      status: 'sending',
      direction: 'out',
      deliveredCount: 0,
      hops: null,
    };
    await chatRepository.insertMessage(message);
    useChatStore.getState().addMessage(message);
    await this.touchConversation(conversation, message, false);

    this.outgoing.set(message.id, {
      message,
      conversation,
      attempt: 0,
      transmitted: false,
      ackedBy: new Set(),
      timer: null,
    });
    void this.transmit(message.id);
    return { ok: true };
  }

  /** Manual retry of a failed message (tap on the bubble). */
  async resend(messageId: string) {
    const message = await chatRepository.getMessage(messageId);
    if (!message || message.direction !== 'out') return;
    const conversation = useChatStore.getState().conversations.find((c) => c.id === message.conversationId);
    if (!conversation) return;
    await this.setStatus(message, 'sending');
    this.outgoing.set(message.id, {
      message: { ...message, status: 'sending' },
      conversation,
      attempt: 0,
      transmitted: false,
      ackedBy: new Set(),
      timer: null,
    });
    void this.transmit(message.id);
  }

  async openDirectConversation(nodeId: string, nick: string): Promise<string> {
    const id = dmConversationId(nodeId);
    await this.ensureConversation({ id, type: 'dm', title: nick || nodeId.slice(0, 8), peerId: nodeId });
    return id;
  }

  async createGroup(name: string): Promise<string> {
    const clean = sanitizeNick(name).replace(/^#/, '');
    const groupId = randomId();
    const id = groupConversationId(groupId);
    await this.ensureConversation({ id, type: 'group', title: `#${clean || 'grupa'}`, peerId: null });
    return id;
  }

  async deleteConversation(id: string) {
    if (id === GENERAL_CONVERSATION_ID) return;
    await chatRepository.deleteConversation(id);
    useChatStore.getState().removeConversation(id);
  }

  async markRead(conversationId: string) {
    const c = useChatStore.getState().conversations.find((x) => x.id === conversationId);
    if (!c || c.unread === 0) return;
    const next = { ...c, unread: 0 };
    await chatRepository.upsertConversation(next);
    useChatStore.getState().upsertConversation(next);
  }

  setNick(nick: string) {
    useIdentityStore.getState().setNick(nick);
    this.router?.setNick(nick.trim());
  }

  async clearHistory() {
    this.outgoing.forEach((o) => o.timer && clearTimeout(o.timer));
    this.outgoing.clear();
    await chatRepository.clearAll();
    useChatStore.getState().reset();
    await this.ensureConversation({ id: GENERAL_CONVERSATION_ID, type: 'group', title: '#ogólny', peerId: null });
    await useChatStore.getState().loadConversations();
  }

  rescan() {
    this.links.rescan();
  }

  getStats() {
    return this.router?.stats;
  }

  // --------------------------------------------------------------------------------------
  // Transmission, ACKs and retries
  // --------------------------------------------------------------------------------------

  private async transmit(messageId: string) {
    const out = this.outgoing.get(messageId);
    const router = this.router;
    if (!out || !router) return;
    const { message, conversation } = out;
    const isGroup = conversation.type === 'group';

    const payload: ChatPayload = { id: message.id, n: message.senderNick, t: message.text };
    if (isGroup) {
      payload.g = conversation.id.slice('group:'.length);
      payload.gn = conversation.title;
    }
    const destination = isGroup ? BROADCAST_ID : conversation.peerId!;
    // First attempt trusts the route table; retries flood in case the route went stale.
    const flags = out.attempt > 0 ? PacketFlags.ForceFlood : 0;

    let sentOn = 0;
    try {
      sentOn = await router.originate(PacketType.Chat, destination, encodeJson(payload), { flags });
    } catch (e) {
      log.warn('originate failed', e);
    }
    if (!this.outgoing.has(messageId)) return; // cleared meanwhile

    if (sentOn > 0 && !out.transmitted) {
      out.transmitted = true;
      if (out.ackedBy.size === 0) await this.setStatus(out.message, 'sent');
    }

    const needsRetry = isGroup ? !out.transmitted : out.ackedBy.size === 0;
    if (!needsRetry) {
      if (isGroup) this.scheduleCleanup(messageId);
      return;
    }
    if (out.attempt >= RETRY_DELAYS_MS.length) {
      await this.setStatus(out.message, 'failed');
      this.outgoing.delete(messageId);
      return;
    }
    out.timer = setTimeout(() => {
      out.attempt++;
      void this.transmit(messageId);
    }, RETRY_DELAYS_MS[out.attempt]);
  }

  /** Keep group messages around for a while to count ACKs, then forget them. */
  private scheduleCleanup(messageId: string) {
    const out = this.outgoing.get(messageId);
    if (!out) return;
    if (out.timer) clearTimeout(out.timer);
    out.timer = setTimeout(() => this.outgoing.delete(messageId), 120_000);
  }

  private async onAck(packet: MeshPacket) {
    const ack = decodeJson<AckPayload>(packet.payload);
    if (!ack || typeof ack.id !== 'string') return;
    const out = this.outgoing.get(ack.id);
    if (!out) return; // late ACK for a message we've already given up on / restarted
    if (out.ackedBy.has(packet.origin)) return;
    out.ackedBy.add(packet.origin);
    out.transmitted = true;
    out.message = { ...out.message, status: 'delivered', deliveredCount: out.ackedBy.size };
    await chatRepository.updateStatus(ack.id, 'delivered', out.ackedBy.size);
    useChatStore.getState().updateMessage(ack.id, out.message.conversationId, {
      status: 'delivered',
      deliveredCount: out.ackedBy.size,
    });
    if (out.conversation.type === 'dm') {
      if (out.timer) clearTimeout(out.timer);
      this.outgoing.delete(ack.id);
    } else {
      this.scheduleCleanup(ack.id);
    }
  }

  private async setStatus(message: ChatMessage, status: ChatMessage['status']) {
    message.status = status;
    await chatRepository.updateStatus(message.id, status);
    useChatStore.getState().updateMessage(message.id, message.conversationId, { status });
  }

  // --------------------------------------------------------------------------------------
  // Incoming
  // --------------------------------------------------------------------------------------

  private async onDeliver(packet: MeshPacket, _link: Link) {
    if (packet.type === PacketType.Ack) return this.onAck(packet);
    if (packet.type !== PacketType.Chat) return;

    const chat = decodeJson<ChatPayload>(packet.payload);
    if (!chat || typeof chat.id !== 'string' || typeof chat.t !== 'string') return;
    const text = chat.t.slice(0, MAX_MESSAGE_LENGTH);
    if (!text.trim()) return;
    const senderNick = sanitizeNick(chat.n) || packet.origin.slice(0, 8);
    const isBroadcast = packet.destination === BROADCAST_ID;

    // Resolve conversation: DMs are keyed by the sender, groups by group id (auto-join).
    let conversation: Conversation;
    if (isBroadcast) {
      const groupId = typeof chat.g === 'string' && /^[\w-]{1,64}$/.test(chat.g) ? chat.g : GENERAL_GROUP_ID;
      const title = groupId === GENERAL_GROUP_ID ? '#ogólny' : sanitizeNick(chat.gn) || '#grupa';
      conversation = await this.ensureConversation({
        id: groupConversationId(groupId),
        type: 'group',
        title,
        peerId: null,
      });
    } else {
      conversation = await this.ensureConversation({
        id: dmConversationId(packet.origin),
        type: 'dm',
        title: senderNick,
        peerId: packet.origin,
      });
    }

    const message: ChatMessage = {
      id: chat.id,
      conversationId: conversation.id,
      senderId: packet.origin,
      senderNick,
      text,
      timestamp: Math.min(packet.timestamp, Date.now() + MAX_FUTURE_SKEW_MS),
      status: 'delivered',
      direction: 'in',
      deliveredCount: 0,
      hops: packet.hops + 1,
    };

    const isNew = await chatRepository.insertMessage(message);
    if (isNew) {
      useChatStore.getState().addMessage(message);
      const active = useChatStore.getState().activeConversationId === conversation.id;
      await this.touchConversation(conversation, message, !active);
    }

    // Always ACK – even duplicates: our previous ACK may have been lost, causing the retry.
    const ack: AckPayload = { id: chat.id };
    void this.router?.originate(PacketType.Ack, packet.origin, encodeJson(ack));
  }

  // --------------------------------------------------------------------------------------
  // Conversations
  // --------------------------------------------------------------------------------------

  private async ensureConversation(
    c: Pick<Conversation, 'id' | 'type' | 'title' | 'peerId'>
  ): Promise<Conversation> {
    const existing = useChatStore.getState().conversations.find((x) => x.id === c.id);
    if (existing) return existing;
    const all = await chatRepository.listConversations();
    const stored = all.find((x) => x.id === c.id);
    if (stored) {
      useChatStore.getState().upsertConversation(stored);
      return stored;
    }
    const created: Conversation = {
      ...c,
      createdAt: Date.now(),
      lastMessageAt: 0,
      lastMessagePreview: '',
      unread: 0,
    };
    await chatRepository.upsertConversation(created);
    useChatStore.getState().upsertConversation(created);
    return created;
  }

  private async touchConversation(c: Conversation, m: ChatMessage, incrementUnread: boolean) {
    const current = useChatStore.getState().conversations.find((x) => x.id === c.id) ?? c;
    const preview = m.direction === 'out' ? `Ty: ${m.text}` : c.type === 'group' ? `${m.senderNick}: ${m.text}` : m.text;
    const next: Conversation = {
      ...current,
      lastMessageAt: Math.max(current.lastMessageAt, m.timestamp),
      lastMessagePreview: preview.slice(0, 120),
      unread: current.unread + (incrementUnread ? 1 : 0),
    };
    await chatRepository.upsertConversation(next);
    useChatStore.getState().upsertConversation(next);
  }

  /** Keep DM titles in sync with nicks announced in the mesh. */
  private refreshDmTitles(nodes: { nodeId: string; nick: string }[]) {
    const { conversations, upsertConversation } = useChatStore.getState();
    for (const n of nodes) {
      const c = conversations.find((x) => x.id === dmConversationId(n.nodeId));
      if (c && n.nick && c.title !== n.nick) {
        const next = { ...c, title: n.nick };
        upsertConversation(next);
        void chatRepository.upsertConversation(next);
      }
    }
  }

  // --------------------------------------------------------------------------------------
  // Background / battery
  // --------------------------------------------------------------------------------------

  private onAppState = (state: AppStateStatus) => {
    const background = state !== 'active';
    this.links.setBackground(background);
    this.router?.setAnnounceInterval(background ? ANNOUNCE_BACKGROUND_MS : ANNOUNCE_FOREGROUND_MS);
    if (!background) this.links.rescan();
  };

  private scheduleNotificationUpdate() {
    if (this.notificationTimer) return;
    this.notificationTimer = setTimeout(() => {
      this.notificationTimer = null;
      const links = this.links.getLinks().length;
      const nodes = this.router?.getNodes().length ?? 0;
      const text =
        links === 0
          ? 'Szukam urządzeń w pobliżu…'
          : `Połączenia: ${links} · węzły w sieci: ${nodes}`;
      try {
        MeshPeripheral.updateForegroundService('Mesh Chat aktywny', text);
      } catch {}
    }, 2_000);
  }
}

export const MeshService = new MeshServiceImpl();
