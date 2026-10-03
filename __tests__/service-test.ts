import nacl from 'tweetnacl';

import * as ca from '../scripts/authority-ca';
import type { Link } from '../src/services/ble/LinkManager';
import { identityQr, parseIdentityQr } from '../src/services/crypto/cert';
import { deriveIdentity, type IdentityKeys } from '../src/services/crypto/keys';
import type { ChatMessage, Conversation } from '../src/store/types';
import { Emitter } from '../src/utils/Emitter';
import { toBase64, toHex, utf8Decode } from '../src/utils/bytes';

/**
 * End-to-end tests of the application layer: several complete nodes (MeshService + router +
 * stores + crypto), each in its own module registry, talking over an in-memory "radio".
 * Only the device-bound edges are replaced: BLE links, SecureStore/SQLite and the native module.
 */

jest.setTimeout(120_000);

// babel-preset-expo leaves `import()` alone, so the isolated registries are filled with require().
declare const require: (id: string) => unknown;

const nodeCrypto = jest.requireActual('crypto');
const root = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(201));

class FakeLinks extends Emitter<{
  linkUp: [Link];
  linkDown: [Link];
  packet: [Link, Uint8Array];
  nearbyChanged: [unknown[]];
  radioChanged: [unknown];
}> {
  links = new Map<string, Link>();
  remotes = new Map<string, FakeLinks>();
  /** Number of upcoming transmissions that get lost on the air (the sender still sees success). */
  drop = 0;

  start() {}
  async stop() {}
  rescan() {}
  setBackground() {}
  getRadio = () => ({ bluetooth: 'PoweredOn', scanning: false, advertising: true, peripheralSupported: true, error: null });
  getLinks = () => [...this.links.values()];
  getLink = (id: string) => this.links.get(id);

  async send(linkId: string, raw: Uint8Array) {
    const remote = this.remotes.get(linkId);
    if (!remote || !this.links.has(linkId)) return false;
    if (this.drop > 0) {
      this.drop--;
      return true;
    }
    setTimeout(() => {
      const link = remote.links.get(linkId);
      if (link) remote.emit('packet', link, raw.slice());
    }, 1);
    return true;
  }

  bindPeer(linkId: string, _me: string, peerNodeId: string, nick: string) {
    const link = this.links.get(linkId);
    if (!link) return false;
    if (link.peerNodeId) return link.peerNodeId === peerNodeId;
    link.peerNodeId = peerNodeId;
    link.peerNick = nick;
    return true;
  }

  closeLink(linkId: string) {
    const link = this.links.get(linkId);
    if (!link) return;
    this.links.delete(linkId);
    this.emit('linkDown', link);
  }

  penalize(linkId: string) {
    this.closeLink(linkId);
  }
}

let linkCounter = 0;
function connect(a: TestNode, b: TestNode) {
  const id = `link${++linkCounter}`;
  for (const [self, other] of [
    [a.links, b.links],
    [b.links, a.links],
  ]) {
    self.links.set(id, { id, kind: 'central', address: id, mtu: 517, connectedAt: Date.now() });
    self.remotes.set(id, other);
  }
  a.links.emit('linkUp', a.links.links.get(id)!);
  b.links.emit('linkUp', b.links.links.get(id)!);
}

function memoryChatRepository() {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, ChatMessage>();
  return {
    listConversations: async () => [...conversations.values()],
    upsertConversation: async (c: Conversation) => void conversations.set(c.id, { ...c }),
    deleteConversation: async (id: string) => void conversations.delete(id),
    listMessages: async (conversationId: string) =>
      [...messages.values()].filter((m) => m.conversationId === conversationId).sort((x, y) => x.timestamp - y.timestamp),
    insertMessage: async (m: ChatMessage) => {
      if (messages.has(m.id)) return false;
      messages.set(m.id, { ...m });
      return true;
    },
    messageExists: async (id: string) => messages.has(id),
    getMessage: async (id: string) => messages.get(id) ?? null,
    updateStatus: async (id: string, status: ChatMessage['status'], deliveredCount?: number) => {
      const m = messages.get(id);
      if (m) messages.set(id, { ...m, status, deliveredCount: deliveredCount ?? m.deliveredCount });
    },
    failPendingMessages: async () => {},
    clearAll: async () => {
      conversations.clear();
      messages.clear();
    },
    messages,
  };
}

interface TestNode {
  id: string;
  nick: string;
  keys: IdentityKeys;
  links: FakeLinks;
  repo: ReturnType<typeof memoryChatRepository>;
  service: (typeof import('../src/services/mesh/MeshService'))['MeshService'];
  contacts: (typeof import('../src/store/contactsStore'))['useContactsStore'];
  trustLevel: (typeof import('../src/store/contactsStore'))['trustLevel'];
  verify: (typeof import('../src/store/verifyStore'))['useVerifyStore'];
  alerts: (typeof import('../src/store/alertStore'))['useAlertStore'];
  chats: (typeof import('../src/store/chatStore'))['useChatStore'];
  identity: (typeof import('../src/store/identityStore'))['useIdentityStore'];
  /** This node's own crypto / packet modules (module state is per node). */
  e2e: typeof import('../src/services/crypto/e2e');
  packet: typeof import('../src/services/mesh/packet');
  /** Delivers an AppState change to this node's MeshService. */
  appState: (state: 'active' | 'background') => void;
}

const nodes: TestNode[] = [];

/** Boots one complete node in an isolated module registry. */
async function boot(seedByte: number, nick: string): Promise<TestNode> {
  const keys = deriveIdentity(new Uint8Array(32).fill(seedByte));
  const links = new FakeLinks();
  const repo = memoryChatRepository();
  const kvData = new Map<string, string>([['identity.nick', nick]]);
  let node!: TestNode;

  jest.isolateModules(() => {
    jest.doMock('../src/utils/random', () => ({
      randomBytes: (n: number) => new Uint8Array(nodeCrypto.randomBytes(n)),
      randomId: () => nodeCrypto.randomUUID(),
    }));
    jest.doMock('../src/services/crypto/identity', () => ({
      getIdentityKeys: () => keys,
      signBytes: (m: Uint8Array) => nacl.sign.detached(m, keys.sign.secretKey),
      loadIdentity: () => ({
        status: 'ready',
        nodeId: keys.nodeId,
        signPublicKey: toBase64(keys.sign.publicKey),
        boxPublicKey: toBase64(keys.box.publicKey),
      }),
      createIdentity: () => {
        throw new Error('not used in tests');
      },
    }));
    jest.doMock('../src/services/crypto/trustAnchors', () => ({
      TRUST_ANCHORS: { roots: [toBase64(root.publicKey)], revokedSerials: [], revokedKeys: [] },
    }));
    jest.doMock('../src/services/storage/kv', () => ({
      KV_KEYS: {
        identityCreated: 'identity.created',
        cert: 'identity.cert',
        dbCreated: 'db.created',
        nick: 'identity.nick',
        permissionsAcknowledged: 'onboarding.permissionsAcknowledged',
        theme: 'settings.theme',
      },
      kv: {
        get: (k: string) => kvData.get(k) ?? null,
        set: (k: string, v: string) => void kvData.set(k, v),
        remove: (k: string) => void kvData.delete(k),
        keys: () => [...kvData.keys()],
      },
    }));
    jest.doMock('../src/services/storage/db', () => ({
      resetDatabase: async () => {},
      isDatabaseEncrypted: () => true,
      DatabaseKeyError: class DatabaseKeyError extends Error {},
    }));
    jest.doMock('../src/services/storage/chatRepository', () => ({ chatRepository: repo }));
    jest.doMock('../src/services/storage/contactsRepository', () => ({
      contactsRepository: { list: async () => [], upsert: async () => {} },
    }));
    jest.doMock('../src/services/storage/alertRepository', () => ({
      alertRepository: { list: async () => [], replaceAll: async () => {} },
    }));
    jest.doMock('../src/services/ble/LinkManager', () => ({
      LinkManager: function LinkManager() {
        return links;
      },
    }));
    jest.doMock('../modules/mesh-peripheral', () => ({
      __esModule: true,
      default: { startForegroundService() {}, stopForegroundService() {}, updateForegroundService() {} },
    }));
    jest.doMock('react-native-ble-plx', () => ({ State: { Unknown: 'Unknown', PoweredOn: 'PoweredOn' } }));
    jest.doMock('expo-local-authentication', () => ({
      SecurityLevel: { NONE: 0 },
      getEnrolledLevelAsync: async () => 3,
      authenticateAsync: async () => ({ success: true }),
    }));

    const { MeshService } = require('../src/services/mesh/MeshService') as typeof import('../src/services/mesh/MeshService');
    const { useContactsStore, trustLevel } = require('../src/store/contactsStore') as typeof import('../src/store/contactsStore');
    const { useVerifyStore } = require('../src/store/verifyStore') as typeof import('../src/store/verifyStore');
    const { useAlertStore } = require('../src/store/alertStore') as typeof import('../src/store/alertStore');
    const { useChatStore } = require('../src/store/chatStore') as typeof import('../src/store/chatStore');
    const { useIdentityStore } = require('../src/store/identityStore') as typeof import('../src/store/identityStore');
    const e2e = require('../src/services/crypto/e2e') as typeof import('../src/services/crypto/e2e');
    const packet = require('../src/services/mesh/packet') as typeof import('../src/services/mesh/packet');
    const { AppState } = require('react-native') as { AppState: { addEventListener: jest.Mock } };
    useIdentityStore.getState().load();
    node = {
      id: keys.nodeId,
      nick,
      keys,
      links,
      repo,
      service: MeshService,
      contacts: useContactsStore,
      trustLevel,
      verify: useVerifyStore,
      alerts: useAlertStore,
      chats: useChatStore,
      identity: useIdentityStore,
      e2e,
      packet,
      // MeshService registers its listener in start(); the registry's AppState is a jest mock.
      appState: (state) => {
        const listener = AppState.addEventListener.mock.calls.filter(([event]) => event === 'change').at(-1)?.[1];
        listener(state);
      },
    };
  });

  await node.service.start();
  nodes.push(node);
  return node;
}

const settle = (ms = 3_000) => jest.advanceTimersByTimeAsync(ms);
const trust = (on: TestNode, of: TestNode) => on.trustLevel(on.contacts.getState(), of.id);
const messagesOn = (n: TestNode) => [...n.repo.messages.values()];

/** The code currently on `owner`'s screen (or the bare public key when no offer is open). */
const codeOn = (owner: TestNode) =>
  identityQr(toBase64(owner.keys.sign.publicKey), owner.verify.getState().machine.offer?.token);

/**
 * `scanner` reads `code` on the verify screen of its conversation with `conversationPeer`.
 * Returns the app's verdict and whether the owner of the code confirmed.
 */
function scan(scanner: TestNode, conversationPeer: TestNode, code: string) {
  const outcome = scanner.service.scanVerificationCode(conversationPeer.id, code);
  const confirmed = outcome.result === 'match' && outcome.confirmation ? outcome.confirmation : Promise.resolve(null);
  return { result: outcome.result, confirmed };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1_800_000_000_000);
});

afterEach(async () => {
  for (const n of nodes.splice(0)) await n.service.stop();
  jest.useRealTimers();
  jest.resetModules();
});

describe('1:1 messages between two complete nodes', () => {
  it('are encrypted on the wire, delivered through a relay and acknowledged', async () => {
    const [alice, relay, bob] = [await boot(1, 'Alicja'), await boot(2, 'Relay'), await boot(3, 'Bob')];
    connect(alice, relay);
    connect(relay, bob);
    await settle(5_000);

    const wire: Uint8Array[] = [];
    relay.links.on('packet', (_l, raw) => wire.push(raw));

    const conversationId = await alice.service.openDirectConversation(bob.id, 'Bob');
    expect(await alice.service.sendMessage(conversationId, 'Zbiórka o 15:00 pod szkołą')).toEqual({ ok: true });
    await settle();

    const received = messagesOn(bob);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ text: 'Zbiórka o 15:00 pod szkołą', senderId: alice.id, senderNick: 'Alicja', authority: null });
    expect(messagesOn(alice)[0]).toMatchObject({ status: 'delivered' });
    // The relay carried it but stored nothing and never saw the text.
    expect(messagesOn(relay)).toHaveLength(0);
    expect(wire.length).toBeGreaterThan(0);
    for (const raw of wire) expect(utf8Decode(raw)).not.toContain('Zbiórka');
    // Nobody is verified just because they talked.
    expect(trust(bob, alice)).toBe('unverified');
  });
});

describe('one-scan mutual verification', () => {
  it('verifies both sides when the peer scans a code opened from the chat with them', async () => {
    const [alice, bob] = [await boot(1, 'Alicja'), await boot(2, 'Bob')];
    connect(alice, bob);
    await settle();
    await alice.service.openDirectConversation(bob.id, 'Bob');
    await bob.service.openDirectConversation(alice.id, 'Alicja');

    bob.service.openVerificationOffer(alice.id);
    const { result, confirmed } = scan(alice, bob, codeOn(bob));
    await settle(500);

    expect(result).toBe('match');
    await expect(confirmed).resolves.toBe(true);
    expect(trust(alice, bob)).toBe('verified');
    expect(trust(bob, alice)).toBe('verified');
    expect(bob.verify.getState().outcome).toMatchObject({ kind: 'verified', peerId: alice.id, by: alice.id });
    expect(bob.verify.getState().machine.offer).toBeNull(); // single use
    expect(bob.contacts.getState().contacts[alice.id].nick).toBe('Alicja');
  });

  it('does not verify an onlooker who read the code, and tells the owner', async () => {
    const [alice, bob, mallory] = [await boot(1, 'Alicja'), await boot(2, 'Bob'), await boot(66, 'Alicja')];
    connect(alice, bob);
    connect(mallory, bob);
    await settle();
    await bob.service.openDirectConversation(alice.id, 'Alicja');

    await alice.service.openDirectConversation(bob.id, 'Bob');
    await mallory.service.openDirectConversation(bob.id, 'Bob');

    bob.service.openVerificationOffer(alice.id);
    const code = codeOn(bob);
    // Mallory photographed the screen and is faster than Alice.
    const stolen = scan(mallory, bob, code);
    await settle(200);
    const honest = scan(alice, bob, code);
    await settle(60_000);

    await expect(stolen.confirmed).resolves.toBe(false);
    await expect(honest.confirmed).resolves.toBe(false);
    expect(trust(bob, mallory)).toBe('unverified');
    expect(trust(bob, alice)).toBe('unverified');
    expect(bob.verify.getState().outcome).toMatchObject({ kind: 'conflict', peerId: alice.id, by: mallory.id });
    // Each scanner did check Bob's key with its own camera – that part stands on their phones.
    expect(trust(alice, bob)).toBe('verified');
  });

  it('undoes the verification of an impostor chat when the real person scans the same code', async () => {
    // Bob has been chatting with "Alicja" who is really Mallory, and opens the code from that chat.
    const [alice, bob, mallory] = [await boot(1, 'Alicja'), await boot(2, 'Bob'), await boot(66, 'Alicja')];
    connect(alice, bob);
    connect(mallory, bob);
    await settle();
    await bob.service.openDirectConversation(mallory.id, 'Alicja');
    await alice.service.openDirectConversation(bob.id, 'Bob');
    await mallory.service.openDirectConversation(bob.id, 'Bob');

    bob.service.openVerificationOffer(mallory.id);
    const code = codeOn(bob);
    const impostor = scan(mallory, bob, code);
    await settle(500);
    await expect(impostor.confirmed).resolves.toBe(true);
    expect(trust(bob, mallory)).toBe('verified');

    // The person actually standing there scans the code (still on Bob's screen) with her own phone.
    const real = scan(alice, bob, code);
    await settle(60_000);

    expect(real.result).toBe('match');
    await expect(real.confirmed).resolves.toBe(false);
    expect(trust(bob, mallory)).toBe('unverified');
    expect(trust(bob, alice)).toBe('unverified');
    expect(bob.verify.getState().outcome).toMatchObject({ kind: 'conflict', peerId: mallory.id, by: alice.id });
  });

  it('raises the conflict even when the scanner is talking to the impostor too', async () => {
    // Full man in the middle: Alice's chat "Bob" and Bob's chat "Alicja" are both Mallory's node.
    const [alice, bob, mallory] = [await boot(1, 'Alicja'), await boot(2, 'Bob'), await boot(66, 'Alicja')];
    connect(alice, bob);
    connect(mallory, bob);
    connect(mallory, alice);
    await settle();
    await bob.service.openDirectConversation(mallory.id, 'Alicja');
    await alice.service.openDirectConversation(mallory.id, 'Bob');
    await mallory.service.openDirectConversation(bob.id, 'Bob');

    bob.service.openVerificationOffer(mallory.id);
    const code = codeOn(bob);
    const impostor = scan(mallory, bob, code);
    await settle(500);
    await expect(impostor.confirmed).resolves.toBe(true);
    expect(trust(bob, mallory)).toBe('verified');

    // Alice scans from her chat with "Bob" (really Mallory): the key does not match, she is
    // warned – and her phone still tells the owner of the code that it was read.
    const real = scan(alice, mallory, code);
    await settle(5_000);

    expect(real.result).toBe('mismatch');
    expect(trust(alice, mallory)).toBe('unverified');
    expect(trust(alice, bob)).toBe('unverified');
    expect(trust(bob, mallory)).toBe('unverified');
    expect(bob.verify.getState().outcome).toMatchObject({ kind: 'conflict', peerId: mallory.id, by: alice.id });
  });

  it('keeps an older verification, and only that, when an onlooker shows up after the honest scan', async () => {
    const [alice, bob, mallory] = [await boot(1, 'Alicja'), await boot(2, 'Bob'), await boot(66, 'Ktoś')];
    connect(alice, bob);
    connect(mallory, bob);
    await settle();
    await bob.service.openDirectConversation(alice.id, 'Alicja');
    await alice.service.openDirectConversation(bob.id, 'Bob');
    await mallory.service.openDirectConversation(bob.id, 'Bob');
    const lastWeek = Date.now() - 7 * 86_400_000;
    bob.service.markVerified(alice.id, lastWeek);

    bob.service.openVerificationOffer(alice.id);
    const code = codeOn(bob);
    await settle(100);
    const honest = scan(alice, bob, code);
    await settle(500);
    await expect(honest.confirmed).resolves.toBe(true);
    expect(bob.contacts.getState().contacts[alice.id].verifiedAt).toBeGreaterThan(lastWeek);

    scan(mallory, bob, code);
    await settle(1_000);
    // The code no longer counts, but what Bob checked himself last week does.
    expect(bob.verify.getState().outcome).toMatchObject({ kind: 'conflict', peerId: alice.id, by: mallory.id });
    expect(bob.contacts.getState().contacts[alice.id].verifiedAt).toBe(lastWeek);
    expect(trust(bob, mallory)).toBe('unverified');
  });

  it('never overrides what the user decided by hand after the code was accepted', async () => {
    const [alice, bob, mallory] = [await boot(1, 'Alicja'), await boot(2, 'Bob'), await boot(66, 'Ktoś')];
    connect(alice, bob);
    connect(mallory, bob);
    await settle();
    await bob.service.openDirectConversation(alice.id, 'Alicja');
    await alice.service.openDirectConversation(bob.id, 'Bob');
    await mallory.service.openDirectConversation(bob.id, 'Bob');
    bob.service.markVerified(alice.id, Date.now() - 7 * 86_400_000);

    // Undo wins: neither a late conflict nor a retry brings the badge back.
    bob.service.openVerificationOffer(alice.id);
    const first = codeOn(bob);
    const accepted = scan(alice, bob, first);
    await settle(500);
    await expect(accepted.confirmed).resolves.toBe(true);
    bob.service.clearVerification(alice.id);
    scan(mallory, bob, first);
    await settle(1_000);
    expect(trust(bob, alice)).toBe('unverified');
    expect(bob.verify.getState().outcome).toBeNull();

    // An own scan wins too: a conflict only undoes the timestamp the code itself wrote.
    bob.service.openVerificationOffer(alice.id);
    const second = codeOn(bob);
    scan(alice, bob, second);
    await settle(500);
    jest.advanceTimersByTime(1_000);
    bob.service.markVerified(alice.id); // Bob scanned Alice's key himself in the meantime
    scan(mallory, bob, second);
    await settle(1_000);
    expect(bob.verify.getState().outcome).toMatchObject({ kind: 'conflict' });
    expect(trust(bob, alice)).toBe('verified');
  });

  it('gets through when the first proof or the first acknowledgement is lost', async () => {
    const [alice, bob] = [await boot(1, 'Alicja'), await boot(2, 'Bob')];
    connect(alice, bob);
    await settle();
    await bob.service.openDirectConversation(alice.id, 'Alicja');
    await alice.service.openDirectConversation(bob.id, 'Bob');

    // The proof itself is lost: the retry four seconds later lands.
    bob.service.openVerificationOffer(alice.id);
    alice.links.drop = 1;
    const lostProof = scan(alice, bob, codeOn(bob));
    await settle(1_000);
    expect(trust(bob, alice)).toBe('unverified');
    await settle(5_000);
    await expect(lostProof.confirmed).resolves.toBe(true);
    expect(trust(bob, alice)).toBe('verified');

    // The acknowledgement is lost: Bob answers the repeated proof again without changing anything.
    await settle(70_000);
    const since = bob.contacts.getState().contacts[alice.id].verifiedAt;
    bob.service.openVerificationOffer(alice.id);
    bob.links.drop = 1;
    const lostAck = scan(alice, bob, codeOn(bob));
    await settle(1_000);
    const granted = bob.contacts.getState().contacts[alice.id].verifiedAt;
    expect(granted).toBeGreaterThan(since!);
    await settle(5_000);
    await expect(lostAck.confirmed).resolves.toBe(true);
    expect(bob.contacts.getState().contacts[alice.id].verifiedAt).toBe(granted);
  });

  it('does not let a third node confirm on behalf of the owner of the code', async () => {
    const [alice, bob, mallory] = [await boot(1, 'Alicja'), await boot(2, 'Bob'), await boot(66, 'Ktoś')];
    connect(alice, bob);
    connect(mallory, alice);
    await settle();
    await alice.service.openDirectConversation(bob.id, 'Bob');

    // Bob's code was withdrawn, so he will never confirm. Mallory knows the token and tries to.
    bob.service.openVerificationOffer(alice.id);
    const code = codeOn(bob);
    const token = parseIdentityQr(code)!.token!;
    bob.service.closeVerificationOffer();
    const outcome = scan(alice, bob, code);
    await settle(500);
    const forged = mallory.e2e.sealJson(alice.id, { y: 'a', id: token, from: mallory.id, to: alice.id });
    expect(forged).not.toBeNull();
    const router = (mallory.service as unknown as { router: { originate: (t: number, d: string, p: Uint8Array) => Promise<number> } }).router;
    await router.originate(mallory.packet.PacketType.Ack, alice.id, mallory.packet.encodeJson(forged));
    await settle(60_000);

    await expect(outcome.confirmed).resolves.toBe(false);
  });

  it('accepts no proof once the code was withdrawn, expired, or the app went to the background', async () => {
    const [alice, bob] = [await boot(1, 'Alicja'), await boot(2, 'Bob')];
    connect(alice, bob);
    await settle();
    await bob.service.openDirectConversation(alice.id, 'Alicja');

    bob.service.openVerificationOffer(alice.id);
    const shown = bob.verify.getState().machine.offer!.token;
    bob.appState('background');
    expect(bob.verify.getState().machine.offer).toBeNull();
    bob.appState('active');
    const afterBackground = alice.service.sendVerificationProof(bob.id, shown);
    await settle(60_000);
    await expect(afterBackground).resolves.toBe(false);

    bob.service.openVerificationOffer(alice.id);
    const token = bob.verify.getState().machine.offer!.token;
    bob.service.closeVerificationOffer();
    const late = alice.service.sendVerificationProof(bob.id, token);
    await settle(60_000);
    await expect(late).resolves.toBe(false);

    bob.service.openVerificationOffer(alice.id);
    const second = bob.verify.getState().machine.offer!.token;
    await settle(3 * 60_000); // longer than the code lives
    const expired = alice.service.sendVerificationProof(bob.id, second);
    await settle(60_000);
    await expect(expired).resolves.toBe(false);
    expect(trust(bob, alice)).toBe('unverified');
    expect(bob.verify.getState().outcome).toBeNull();
  });

  it('treats the public key code as a one-sided check, and rejects anything that is not a key', async () => {
    const [alice, bob, carol] = [await boot(1, 'Alicja'), await boot(2, 'Bob'), await boot(4, 'Karol')];
    connect(alice, bob);
    await settle();
    await alice.service.openDirectConversation(bob.id, 'Bob');

    expect(alice.service.scanVerificationCode(bob.id, 'https://example.com/MC1:ID:abc').result).toBe('not_a_key');
    expect(alice.service.scanVerificationCode(bob.id, codeOn(carol)).result).toBe('mismatch');
    expect(trust(alice, bob)).toBe('unverified');

    // Bob shows the code from Settings → Mój klucz: no token, nothing to send back.
    const plain = alice.service.scanVerificationCode(bob.id, codeOn(bob));
    expect(plain).toEqual({ result: 'match', confirmation: null });
    await settle();
    expect(trust(alice, bob)).toBe('verified');
    expect(trust(bob, alice)).toBe('unverified');

    alice.service.clearVerification(bob.id);
    expect(trust(alice, bob)).toBe('unverified');
  });
});

describe('authority accounts', () => {
  const certify = (node: TestNode, name: string) =>
    ca.issueCert(root.secretKey, {
      devicePublicKey: node.keys.sign.publicKey,
      name,
      notBefore: Date.now() - 3_600_000,
      notAfter: Date.now() + 30 * 86_400_000,
      serial: toHex(new Uint8Array(8).fill(9)),
    }).cert;

  it('reach everyone with an alert and are marked official in private messages', async () => {
    const [office, relay, citizen] = [await boot(10, 'dyzurny'), await boot(2, 'Relay'), await boot(3, 'Ola')];
    await expect(office.service.installCert(certify(office, 'Urząd Miasta – WZK'))).resolves.toEqual({
      ok: true,
      name: 'Urząd Miasta – WZK',
    });
    connect(office, relay);
    connect(relay, citizen);
    await settle(5_000);

    await expect(office.service.sendAlert('Ewakuacja', 'Punkt zbiórki: szkoła nr 3', 6 * 3_600_000)).resolves.toEqual({ ok: true });
    await settle();
    for (const n of [relay, citizen]) {
      expect(n.alerts.getState().alerts).toMatchObject([
        { origin: office.id, authority: 'Urząd Miasta – WZK', headline: 'Ewakuacja', cancelled: false },
      ]);
      expect(trust(n, office)).toBe('official');
    }

    const conversationId = await office.service.openDirectConversation(citizen.id, 'Ola');
    await office.service.sendMessage(conversationId, 'Proszę zostać w domu.');
    await settle();
    expect(messagesOn(citizen)).toMatchObject([{ text: 'Proszę zostać w domu.', authority: 'Urząd Miasta – WZK' }]);
    // The conversation is named after the certificate, not after the self-chosen nick.
    expect(citizen.chats.getState().conversations[0].title).toBe('Urząd Miasta – WZK');

    const [alert] = office.alerts.getState().alerts;
    await expect(office.service.cancelAlert(alert.id)).resolves.toEqual({ ok: true });
    await settle();
    expect(citizen.alerts.getState().alerts).toMatchObject([{ id: alert.id, cancelled: true }]);
  });

  it('cannot be claimed without a certificate for this very device', async () => {
    const [citizen, other] = [await boot(3, 'Urząd Miasta'), await boot(10, 'dyzurny')];
    await expect(citizen.service.sendAlert('Fałszywy', '', 3_600_000)).resolves.toEqual({ ok: false, reason: 'not_authority' });
    // A certificate issued to somebody else's key is refused.
    await expect(citizen.service.installCert(certify(other, 'Urząd Miasta'))).resolves.toEqual({ ok: false, reason: 'subject' });
    // So is one signed by a key the app does not trust.
    const rogueRoot = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(77));
    const rogue = ca.issueCert(rogueRoot.secretKey, {
      devicePublicKey: citizen.keys.sign.publicKey,
      name: 'Urząd Miasta',
      notBefore: Date.now() - 1,
      notAfter: Date.now() + 86_400_000,
      serial: '00000000000000aa',
    }).cert;
    await expect(citizen.service.installCert(rogue)).resolves.toEqual({ ok: false, reason: 'signature' });
    expect(citizen.identity.getState().authority).toBeNull();

    // A nick that sounds official earns no badge.
    connect(citizen, other);
    await settle();
    expect(trust(other, citizen)).toBe('unverified');
  });
});
