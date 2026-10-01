/**
 * Bounded, time-limited set of packet ids already processed.
 *
 * This is the core of loop-free flooding: every node relays a packet at most once,
 * so a broadcast crosses each link at most twice regardless of topology cycles.
 * Insertion-ordered Map gives us cheap LRU eviction.
 */
export class SeenCache {
  private entries = new Map<string, number>();

  constructor(
    private readonly maxEntries = 4_096,
    private readonly ttlMs = 10 * 60_000
  ) {}

  /** Returns true if the id was already seen; otherwise records it and returns false. */
  checkAndAdd(id: string): boolean {
    const now = Date.now();
    const seenAt = this.entries.get(id);
    if (seenAt !== undefined && now - seenAt < this.ttlMs) return true;
    this.entries.delete(id);
    this.entries.set(id, now);
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    return false;
  }

  has(id: string): boolean {
    const seenAt = this.entries.get(id);
    return seenAt !== undefined && Date.now() - seenAt < this.ttlMs;
  }

  clear() {
    this.entries.clear();
  }
}
