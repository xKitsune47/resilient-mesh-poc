import { bytesToUuid, uuidToBytes, utf8Decode, utf8Encode } from '../../utils/bytes';

/**
 * Mesh packet wire format (network layer), big endian:
 *
 *  off size field
 *    0    1 version            PROTOCOL_VERSION
 *    1    1 type               PacketType
 *    2    1 ttl                remaining hops; relays decrement, drop at 0
 *    3    1 hops               hops travelled so far (for route metrics)
 *    4    1 flags              PacketFlags
 *    5    8 packetId           random; flood de-duplication key
 *   13   16 origin             node id (UUID) of the author
 *   29   16 destination        node id, or BROADCAST_ID
 *   45    4 seq                per-origin monotonically increasing sequence number
 *   49    8 timestamp          float64 ms since epoch (author's clock)
 *   57    2 payloadLength
 *   59    N payload            UTF-8 JSON (type-specific)
 *
 * Relays only touch ttl/hops (bytes 2-3), so forwarding never needs to parse the payload.
 */

export const PROTOCOL_VERSION = 1;
export const HEADER_SIZE = 59;
export const MAX_PAYLOAD_SIZE = 3_000;
export const BROADCAST_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

export enum PacketType {
  /** Link-local handshake (ttl=1): binds a physical link to a node id. Never relayed. */
  Hello = 1,
  /** Periodic flooded presence beacon: nick + builds the route table. */
  Announce = 2,
  /** Chat message (1:1 = directed, group = broadcast). */
  Chat = 3,
  /** Delivery receipt, directed back to the message author. */
  Ack = 4,
}

export const PacketFlags = {
  /** Ignore the route table and flood (used for retries after a stale route). */
  ForceFlood: 1 << 0,
} as const;

export const DEFAULT_TTL: Record<PacketType, number> = {
  [PacketType.Hello]: 1,
  [PacketType.Announce]: 5,
  [PacketType.Chat]: 7,
  [PacketType.Ack]: 7,
};

export interface MeshPacket {
  version: number;
  type: PacketType;
  ttl: number;
  hops: number;
  flags: number;
  packetId: string; // 16 hex chars
  origin: string;
  destination: string;
  seq: number;
  timestamp: number;
  payload: Uint8Array;
}

// --- Payloads ---------------------------------------------------------------------------

export interface HelloPayload {
  n: string; // nick
}

export interface AnnouncePayload {
  n: string; // nick
}

export interface ChatPayload {
  id: string; // message UUID (application-level idempotency key)
  n: string; // author nick
  t: string; // text
  /** Present for group messages: group id + name (so receivers can auto-join). */
  g?: string;
  gn?: string;
}

export interface AckPayload {
  id: string; // acknowledged message id
}

// --- Codec ------------------------------------------------------------------------------

export function encodePacket(p: MeshPacket): Uint8Array {
  if (p.payload.length > MAX_PAYLOAD_SIZE) throw new Error('Payload too large');
  const buf = new Uint8Array(HEADER_SIZE + p.payload.length);
  const view = new DataView(buf.buffer);
  buf[0] = p.version;
  buf[1] = p.type;
  buf[2] = p.ttl;
  buf[3] = p.hops;
  buf[4] = p.flags;
  for (let i = 0; i < 8; i++) buf[5 + i] = parseInt(p.packetId.substr(i * 2, 2), 16);
  buf.set(uuidToBytes(p.origin), 13);
  buf.set(uuidToBytes(p.destination), 29);
  view.setUint32(45, p.seq >>> 0);
  view.setFloat64(49, p.timestamp);
  view.setUint16(57, p.payload.length);
  buf.set(p.payload, HEADER_SIZE);
  return buf;
}

/** Returns null for anything malformed – never throws on network input. */
export function decodePacket(buf: Uint8Array): MeshPacket | null {
  if (buf.length < HEADER_SIZE) return null;
  if (buf[0] !== PROTOCOL_VERSION) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const len = view.getUint16(57);
  if (len > MAX_PAYLOAD_SIZE || HEADER_SIZE + len !== buf.length) return null;
  const type = buf[1];
  if (!(type in DEFAULT_TTL)) return null;
  let packetId = '';
  for (let i = 0; i < 8; i++) packetId += buf[5 + i].toString(16).padStart(2, '0');
  return {
    version: buf[0],
    type,
    ttl: buf[2],
    hops: buf[3],
    flags: buf[4],
    packetId,
    origin: bytesToUuid(buf.subarray(13, 29)),
    destination: bytesToUuid(buf.subarray(29, 45)),
    seq: view.getUint32(45),
    timestamp: view.getFloat64(49),
    payload: buf.slice(HEADER_SIZE),
  };
}

/** Relay rewrite: decrement ttl / increment hops in place on a copy. */
export function rewriteForRelay(raw: Uint8Array): Uint8Array {
  const copy = raw.slice();
  copy[2] = Math.max(0, copy[2] - 1);
  copy[3] = Math.min(255, copy[3] + 1);
  return copy;
}

export function encodeJson(obj: unknown): Uint8Array {
  return utf8Encode(JSON.stringify(obj));
}

export function decodeJson<T>(bytes: Uint8Array): T | null {
  try {
    return JSON.parse(utf8Decode(bytes)) as T;
  } catch {
    return null;
  }
}
