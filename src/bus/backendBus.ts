import {
  isBusEvent,
  type AgentBus,
  type BusConnectionStatus,
  type BusEvent,
  type BusEventInput,
  type BusHandler,
  type Unsubscribe
} from './types'

export interface BackendBusOptions {
  url: string
  onStatus?: (status: BusConnectionStatus) => void
  /** dispatch kapalıyken de inbound dinle (reconnect testi) */
  echoLocal?: boolean
}

/**
 * WS adapter — UI yalnız `subscribe` / `dispatch` görür.
 * Gelen mesajlar `BusEvent` JSON’u olmalı; diğerleri sessizce düşer.
 */
export function createBackendBus(options: BackendBusOptions): AgentBus & {
  connect(): void
  disconnect(): void
  readonly url: string
  readonly status: BusConnectionStatus
} {
  const url = options.url
  const echoLocal = options.echoLocal ?? false
  const handlers = new Set<BusHandler>()
  let socket: WebSocket | null = null
  let status: BusConnectionStatus = 'closed'
  let shouldRun = false

  function setStatus(next: BusConnectionStatus): void {
    status = next
    options.onStatus?.(next)
  }

  function deliver(event: BusEvent): void {
    for (const handler of [...handlers]) handler(event)
  }

  function handleInbound(raw: unknown): void {
    if (!isBusEvent(raw)) return
    deliver(raw)
  }

  function parseMessage(data: string): unknown {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  function openSocket(): void {
    if (typeof WebSocket === 'undefined') {
      setStatus('error')
      return
    }
    try {
      socket = new WebSocket(url)
    } catch {
      setStatus('error')
      return
    }
    setStatus('connecting')

    socket.onopen = () => setStatus('open')
    socket.onclose = () => {
      setStatus('closed')
      socket = null
      if (shouldRun) {
        // yumuşak yeniden bağlanma
        window.setTimeout(() => {
          if (shouldRun) openSocket()
        }, 1500)
      }
    }
    socket.onerror = () => setStatus('error')
    socket.onmessage = (e: MessageEvent) => {
      handleInbound(parseMessage(String(e.data)))
    }
  }

  return {
    url,

    get status() {
      return status
    },

    subscribe(handler: BusHandler): Unsubscribe {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },

    dispatch(event: BusEventInput): void {
      const packet: BusEvent = { ...event, ts: Date.now() }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(packet))
      }
      if (echoLocal) deliver(packet)
    },

    connect() {
      shouldRun = true
      if (!socket) openSocket()
    },

    disconnect() {
      shouldRun = false
      if (socket) {
        socket.onclose = null
        socket.close()
        socket = null
      }
      setStatus('closed')
    }
  }
}
