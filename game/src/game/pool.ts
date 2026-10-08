/**
 * Small object pool (WP-P, 2.9#16). Transient scene objects (floating texts)
 * are recycled instead of created and destroyed per event, so a long match
 * produces no allocation churn and no growth in scene lists. Phaser-free so
 * it is unit tested; the scene supplies `create` / `reset` / `dispose`.
 */
export interface PoolStats {
  created: number
  reused: number
  free: number
  live: number
}

export class ObjectPool<T> {
  private readonly freeList: T[] = []
  private created = 0
  private reused = 0
  private liveCount = 0

  private readonly create: () => T
  private readonly reset: (o: T) => void
  private readonly park: (o: T) => void
  private readonly maxFree: number
  private readonly dispose: (o: T) => void

  /**
   * `reset` prepares a recycled object on acquire, `park` hides it on release,
   * at most `maxFree` free objects are kept (extras go to `dispose`).
   */
  constructor(create: () => T, reset: (o: T) => void, park: (o: T) => void, maxFree = 32, dispose: (o: T) => void = () => {}) {
    this.create = create
    this.reset = reset
    this.park = park
    this.maxFree = maxFree
    this.dispose = dispose
  }

  acquire(): T {
    let o = this.freeList.pop()
    if (o === undefined) {
      o = this.create()
      this.created++
    } else {
      this.reused++
    }
    this.reset(o)
    this.liveCount++
    return o
  }

  release(o: T): void {
    this.liveCount = Math.max(0, this.liveCount - 1)
    this.park(o)
    if (this.freeList.length >= this.maxFree) this.dispose(o)
    else this.freeList.push(o)
  }

  /** Disposes every free object (scene shutdown). */
  clear(): void {
    for (const o of this.freeList) this.dispose(o)
    this.freeList.length = 0
    this.liveCount = 0
  }

  stats(): PoolStats {
    return { created: this.created, reused: this.reused, free: this.freeList.length, live: this.liveCount }
  }
}
