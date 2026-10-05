import { ref, shallowRef } from 'vue'
import { createBackendBus } from './backendBus'
import { createLocalBus } from './localBus'
import type {
  AgentBus,
  BusConnectionStatus,
  BusEvent,
  BusEventInput,
  BusHandler,
  Unsubscribe
} from './types'
import type { PackTransport } from '@/pack/types'

const status = ref<BusConnectionStatus>('local')
/** UI dinleyicileri — transport değişse de kaybolmasın */
const handlers = new Set<BusHandler>()
let busRef = shallowRef<AgentBus | null>(null)
let bridge: Unsubscribe | null = null
let teardown: (() => void) | null = null
let current: { transport: PackTransport; url: string | null } | null = null

function bindBus(bus: AgentBus): void {
  bridge?.()
  busRef.value = bus
  // kritik: UI handler’ları her zaman bu bridge üzerinden aksın
  bridge = bus.subscribe((event: BusEvent) => {
    for (const handler of [...handlers]) handler(event)
  })
}

// modül açılışında LocalBus’ı hemen bağla (bridge’siz bus = sessiz UI)
bindBus(createLocalBus())
current = { transport: 'local', url: null }

export function useBusStatus() {
  return status
}

export function getBus(): AgentBus {
  if (!busRef.value) bindBus(createLocalBus())
  return busRef.value!
}

export function subscribeBus(handler: BusHandler): Unsubscribe {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

export function dispatchBus(event: BusEventInput): void {
  getBus().dispatch(event)
}

/** Demo / offline — LocalBus (sahte olaylar). */
export function useLocalTransport(): void {
  teardown?.()
  teardown = null
  bindBus(createLocalBus())
  status.value = 'local'
  current = { transport: 'local', url: null }
}

/** Backend WS — aynı BusEvent tipleri. */
export function useWsTransport(url: string): void {
  teardown?.()
  const bus = createBackendBus({
    url,
    onStatus: (s) => {
      status.value = s
    }
  })
  bindBus(bus)
  bus.connect()
  teardown = () => {
    bus.disconnect()
    teardown = null
  }
  current = { transport: 'ws', url }
}

export function applyTransport(transport: PackTransport, url: string | null): void {
  // aynı transport → yeniden kurma; yine de bridge olduğundan emin ol
  if (current && transport === current.transport && url === current.url && bridge) {
    if (transport === 'local') status.value = 'local'
    return
  }
  if (transport === 'ws' && url) useWsTransport(url)
  else useLocalTransport()
}

export function disposeBusSession(): void {
  teardown?.()
  teardown = null
  bridge?.()
  bridge = null
  handlers.clear()
}
