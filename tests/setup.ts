import { beforeEach, vi } from "vitest"

/**
 * A `localStorage` good enough for the stores under test.
 *
 * `lib/storage.ts` guards every access with `typeof window === "undefined"`, so
 * the presence of a `window` with a working `localStorage` is the whole
 * contract. Defining it here rather than switching the suite to jsdom keeps the
 * tests fast and keeps the failure modes readable.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length() {
    return this.map.size
  }

  clear() {
    this.map.clear()
  }

  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }

  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.map.delete(key)
  }

  setItem(key: string, value: string) {
    this.map.set(key, String(value))
  }
}

const storage = new MemoryStorage()

Object.defineProperty(globalThis, "window", {
  configurable: true,
  writable: true,
  value: {
    localStorage: storage,
    setInterval: setInterval.bind(globalThis),
    clearInterval: clearInterval.bind(globalThis),
    setTimeout: setTimeout.bind(globalThis),
    clearTimeout: clearTimeout.bind(globalThis),
  },
})

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: storage,
})

beforeEach(() => {
  storage.clear()
  vi.useRealTimers()
})

export { storage }
