import { isBusEvent, type AgentBus, type BusEvent, type BusEventInput, type BusHandler, type Unsubscribe } from './types'

export interface BackendBusOptions {
  /** WS / SSE uç noktası — gerçek API bağlanınca buradan geçecek */
  url?: string
  /** şimdilik: dispatch yutulur mu (true) yoksa lokal yankı mı (false) */
  silent?: boolean
}

/**
 * Gerçek backend için iskelet. Bugün no-op / mock;
 * yarın WS veya SSE aynı `BusEvent` tiplerini basacak.
 *
 * UI farkı görmez: yine yalnızca `subscribe` / `dispatch`.
 */
export function createBackendBus(options: BackendBusOptions = {}): AgentBus & {
  connect(): void
  disconnect(): void
  readonly url: string
} {
  const url = options.url ?? 'ws://127.0.0.1:8787/bus'
  const silent = options.silent ?? true
  const handlers = new Set<BusHandler>()
  // let socket: WebSocket | null = null   // bağlanınca açılacak

  function deliver(event: BusEvent): void {
    for (const handler of [...handlers]) handler(event)
  }

  function handleInbound(raw: unknown): void {
    if (!isBusEvent(raw)) return
    deliver(raw)
  }

  return {
    url,

    subscribe(handler: BusHandler): Unsubscribe {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },

    dispatch(event: BusEventInput): void {
      // TODO: socket.send(JSON.stringify(event))
      if (silent) return
      // geçici yankı — UI bağlıyken test için
      deliver({ ...event, ts: Date.now() } as BusEvent)
    },

    connect() {
      // TODO: socket = new WebSocket(url)
      // socket.onmessage = (e) => handleInbound(JSON.parse(e.data))
      void handleInbound
    },

    disconnect() {
      // TODO: socket?.close(); socket = null
    }
  }
}
