import { Emitter } from '../../utils/Emitter';
import { KeyedRateLimiter } from '../../utils/RateLimiter';
import { randomBytes, toHex } from '../../utils/bytes';
import { createLogger } from '../../utils/logger';
import { jitter } from '../../utils/time';
import type { Link, LinkManager } from '../ble/LinkManager';
import {
  AnnouncePayload,
  BROADCAST_ID,
  decodeJson,
  decodePacket,
  DEFAULT_TTL,
  encodeJson,
  encodePacket,
  HelloPayload,
  MeshPacket,
  PacketFlags,
  PacketType,
  PROTOCOL_VERSION,
  rewriteForRelay,
} from './packet';
import { SeenCache } from './SeenCache';

const log = createLogger('Router');

/** How long a node stays in the table without being heard from (announce period x3). */
const ROUTE_TTL_MS = 100_000;
/** A worse route replaces the current one if the current one hasn't been refreshed for this long. */
const ROUTE_STALE_MS = 35_000;

export interface MeshNode {
  nodeId: string;
  nick: string;
  /** Link used to reach the node (the first hop). */
  nextHopLinkId: string;
  hops: number;
  lastSeen: number;
  /** Highest announce sequence number seen – older announces are ignored. */
  lastSeq: number;
  direct: boolean;
}

type RouterEvents = {
  /** A packet addressed to us (or broadcast) that passed all checks. */
  deliver: [MeshPacket, Link];
  nodesChanged: [MeshNode[]];
};

export interface RouterStats {
  received: number;
  relayed: number;
  dropped: number;
  duplicates: number;
}

/**
 * Network layer of the mesh.
 *
 * Routing strategy — "controlled flooding with opportunistic unicast":
 *  1. Every packet carries a random packetId. Each node processes / relays a packetId
 *     at most once (SeenCache) → loops are impossible, cycles in the topology are fine.
 *  2. TTL bounds how far a packet travels; relays decrement it and stop at 1.
 *  3. Broadcasts (group chat, announces) are flooded to all links except the one they came in on,
 *     with a small random delay so neighbours don't all transmit at the same instant.
 *  4. Periodic ANNOUNCE floods let every node learn, for every origin, which link delivered
 *     that origin's packets with the fewest hops (reverse-path learning, like AODV/DSDV-lite).
 *     Directed packets (DMs, ACKs) are unicast along that next hop; if no route is known
 *     (or the sender sets ForceFlood on a retry) they fall back to flooding.
 *  5. Per-origin sequence numbers make announce processing monotonic (stale announces
 *     that arrive over a longer path are ignored).
 *  6. Token buckets per link and per origin drop floods from misbehaving nodes *before*
 *     they are relayed, so one spammer cannot saturate the whole mesh.
 */
export class MeshRouter extends Emitter<RouterEvents> {
  private seen = new SeenCache();
  private routes = new Map<string, MeshNode>();
  /** Seeded from wall-clock seconds so it keeps increasing across app restarts. */
  private seq = Math.floor(Date.now() / 1000);
  private linkLimiter = new KeyedRateLimiter(60, 25); // raw packets per link
  private originLimiter = new KeyedRateLimiter(15, 1); // chat/ack packets per origin
  private announceLimiter = new KeyedRateLimiter(2, 0.2); // announces per origin
  private announceTimer: ReturnType<typeof setInterval> | null = null;
  private expiryTimer: ReturnType<typeof setInterval> | null = null;
  private unsubs: (() => void)[] = [];
  readonly stats: RouterStats = { received: 0, relayed: 0, dropped: 0, duplicates: 0 };

  constructor(
    private readonly links: LinkManager,
    private readonly identity: { nodeId: string; nick: string }
  ) {
    super();
  }

  start(announceIntervalMs: number) {
    this.unsubs.push(
      this.links.on('packet', (link, raw) => this.onPacket(link, raw)),
      this.links.on('linkUp', (link) => this.onLinkUp(link)),
      this.links.on('linkDown', (link) => this.onLinkDown(link))
    );
    this.setAnnounceInterval(announceIntervalMs);
    this.expiryTimer = setInterval(() => this.expireRoutes(), 10_000);
  }

  stop() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.announceTimer) clearInterval(this.announceTimer);
    if (this.expiryTimer) clearInterval(this.expiryTimer);
    this.routes.clear();
  }

  setNick(nick: string) {
    this.identity.nick = nick;
    void this.announce();
  }

  setAnnounceInterval(ms: number) {
    if (this.announceTimer) clearInterval(this.announceTimer);
    this.announceTimer = setInterval(() => void this.announce(), ms);
  }

  getNodes(): MeshNode[] {
    return [...this.routes.values()].sort((a, b) => a.hops - b.hops || a.nick.localeCompare(b.nick));
  }

  getNode(nodeId: string): MeshNode | undefined {
    return this.routes.get(nodeId);
  }

  // --------------------------------------------------------------------------------------
  // Origination
  // --------------------------------------------------------------------------------------

  /**
   * Creates and transmits a new packet authored by this node.
   * @returns number of links the packet was handed to (0 = not transmitted at all).
   */
  async originate(
    type: PacketType,
    destination: string,
    payload: Uint8Array,
    opts: { ttl?: number; flags?: number; onlyLinkId?: string } = {}
  ): Promise<number> {
    const packet: MeshPacket = {
      version: PROTOCOL_VERSION,
      type,
      ttl: opts.ttl ?? DEFAULT_TTL[type],
      hops: 0,
      flags: opts.flags ?? 0,
      packetId: toHex(randomBytes(8)),
      origin: this.identity.nodeId,
      destination,
      seq: this.nextSeq(),
      timestamp: Date.now(),
      payload,
    };
    const raw = encodePacket(packet);
    this.seen.checkAndAdd(packet.packetId); // never process our own packet when it echoes back
    const targets = opts.onlyLinkId
      ? this.links.getLinks().filter((l) => l.id === opts.onlyLinkId)
      : this.selectTargets(packet, null);
    const results = await Promise.all(targets.map((l) => this.links.send(l.id, raw)));
    return results.filter(Boolean).length;
  }

  announce() {
    if (this.links.getLinks().length === 0) return Promise.resolve(0);
    const payload: AnnouncePayload = { n: this.identity.nick };
    return this.originate(PacketType.Announce, BROADCAST_ID, encodeJson(payload));
  }

  private nextSeq() {
    this.seq = (this.seq + 1) >>> 0;
    return this.seq;
  }

  // --------------------------------------------------------------------------------------
  // Receive path
  // --------------------------------------------------------------------------------------

  private onPacket(link: Link, raw: Uint8Array) {
    this.stats.received++;
    // (1) Per-link flood protection – checked before any parsing work.
    if (!this.linkLimiter.tryTake(link.id)) return this.drop('link rate limit', link.id);

    const p = decodePacket(raw);
    if (!p) return this.drop('malformed', link.id);
    if (p.origin === this.identity.nodeId) return; // our own packet came back around

    // (2) Duplicate suppression: the heart of loop-free flooding.
    if (this.seen.checkAndAdd(p.packetId)) {
      this.stats.duplicates++;
      return;
    }

    // HELLO is link-local: it binds the physical link to a node identity and is never relayed.
    if (p.type === PacketType.Hello) {
      if (p.hops !== 0) return this.drop('relayed hello', link.id);
      const hello = decodeJson<HelloPayload>(p.payload);
      const nick = sanitizeNick(hello?.n);
      this.links.bindPeer(link.id, this.identity.nodeId, p.origin, nick);
      this.learnRoute(p.origin, link, 1, p.seq, nick);
      return;
    }

    // (3) Per-origin rate limiting – excess traffic is neither delivered nor relayed.
    const limiter = p.type === PacketType.Announce ? this.announceLimiter : this.originLimiter;
    if (!limiter.tryTake(p.origin)) return this.drop('origin rate limit', p.origin);

    // (4) Reverse-path route learning.
    const hopsToOrigin = p.hops + 1;
    if (p.type === PacketType.Announce) {
      const a = decodeJson<AnnouncePayload>(p.payload);
      this.learnRoute(p.origin, link, hopsToOrigin, p.seq, sanitizeNick(a?.n));
    } else {
      this.learnRoute(p.origin, link, hopsToOrigin, undefined, undefined);
    }

    const isBroadcast = p.destination === BROADCAST_ID;
    const isForMe = p.destination === this.identity.nodeId;

    if ((isBroadcast || isForMe) && p.type !== PacketType.Announce) this.emit('deliver', p, link);

    // (5) Relay, unless it was for us only or TTL is exhausted.
    if (!isForMe && p.ttl > 1) this.relay(p, raw, link);
  }

  private relay(p: MeshPacket, raw: Uint8Array, from: Link) {
    const out = rewriteForRelay(raw);
    const targets = this.selectTargets(p, from.id);
    if (targets.length === 0) return;
    // Broadcast storms: random back-off de-synchronises neighbours that heard the same packet.
    const delay = p.destination === BROADCAST_ID ? jitter(15, 90) : jitter(0, 10);
    setTimeout(() => {
      for (const l of targets) {
        void this.links.send(l.id, out).then((ok) => ok && this.stats.relayed++);
      }
    }, delay);
  }

  /** Chooses outgoing links: unicast along a known route, otherwise flood (split horizon). */
  private selectTargets(p: MeshPacket, fromLinkId: string | null): Link[] {
    const all = this.links
      .getLinks()
      .filter((l) => l.id !== fromLinkId && l.peerNodeId !== p.origin);
    if (p.destination === BROADCAST_ID) return all;

    const direct = all.find((l) => l.peerNodeId === p.destination);
    if (direct) return [direct];

    if (!(p.flags & PacketFlags.ForceFlood)) {
      const route = this.routes.get(p.destination);
      if (route && route.nextHopLinkId !== fromLinkId) {
        const next = all.find((l) => l.id === route.nextHopLinkId);
        if (next) return [next];
      }
    }
    return all;
  }

  // --------------------------------------------------------------------------------------
  // Route table
  // --------------------------------------------------------------------------------------

  private learnRoute(nodeId: string, via: Link, hops: number, seq?: number, nick?: string) {
    const now = Date.now();
    const current = this.routes.get(nodeId);
    const direct = via.peerNodeId === nodeId;

    if (current && seq !== undefined && seq < current.lastSeq) return; // stale announce
    const better =
      !current ||
      hops < current.hops ||
      current.nextHopLinkId === via.id ||
      now - current.lastSeen > ROUTE_STALE_MS ||
      !this.links.getLink(current.nextHopLinkId);

    if (better) {
      this.routes.set(nodeId, {
        nodeId,
        nick: nick || current?.nick || nodeId.slice(0, 8),
        nextHopLinkId: via.id,
        hops,
        lastSeen: now,
        lastSeq: Math.max(seq ?? 0, current?.lastSeq ?? 0),
        direct,
      });
    } else if (current) {
      // Keep the better path but record that the node is alive.
      current.lastSeen = now;
      if (nick) current.nick = nick;
      if (seq !== undefined) current.lastSeq = Math.max(current.lastSeq, seq);
    }
    this.emitNodes();
  }

  private onLinkUp(link: Link) {
    // Handshake: tell the neighbour who we are. ttl=1 → never relayed.
    const hello: HelloPayload = { n: this.identity.nick };
    void this.originate(PacketType.Hello, BROADCAST_ID, encodeJson(hello), {
      ttl: 1,
      onlyLinkId: link.id,
    }).then(() =>
      // Then flood a fresh announce so the rest of the mesh learns the new path quickly.
      setTimeout(() => void this.announce(), jitter(300, 900))
    );
  }

  private onLinkDown(link: Link) {
    let changed = false;
    for (const [id, r] of this.routes) {
      if (r.nextHopLinkId === link.id) {
        this.routes.delete(id);
        changed = true;
      }
    }
    this.linkLimiter.delete(link.id);
    if (changed) this.emitNodes();
  }

  private expireRoutes() {
    const now = Date.now();
    let changed = false;
    for (const [id, r] of this.routes) {
      const linkAlive = !!this.links.getLink(r.nextHopLinkId);
      if (!linkAlive || (!r.direct && now - r.lastSeen > ROUTE_TTL_MS)) {
        this.routes.delete(id);
        changed = true;
      }
    }
    if (changed) this.emitNodes();
  }

  private emitNodes() {
    this.emit('nodesChanged', this.getNodes());
  }

  private drop(reason: string, key: string) {
    this.stats.dropped++;
    log.debug('drop:', reason, key);
  }
}

export function sanitizeNick(n: unknown): string {
  if (typeof n !== 'string') return '';
  // Strip control characters and clamp length – nicks come from untrusted peers.
  return n.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
}
