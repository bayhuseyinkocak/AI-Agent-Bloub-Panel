import { ref, shallowRef } from 'vue'
import { createBackendBus } from './backendBus'
import { createLocalBus } from './localBus'
import type {
  AgentBus,
  BusConnectionStatus,
  BusEventInput,
  BusHandler,
  Unsubscribe
} from './types'
import type { PackTransport } from '@/pack/types'

const status = ref<BusConnectionStatus>('local')
const busRef = shallowRef<AgentBus>(createLocalBus())
let teardown: (() => void) | null = null

export function useBusStatus() {
  return status
}

export function getBus(): AgentBus {
  return busRef.value
}

export function subscribeBus(handler: BusHandler): Unsubscribe {
  return busRef.value.subscribe(handler)
}

export function dispatchBus(event: BusEventInput): void {
  busRef.value.dispatch(event)
}

/** Demo / offline — LocalBus (sahte olaylar). */
export function useLocalTransport(): void {
  teardown?.()
  teardown = null
  busRef.value = createLocalBus()
  status.value = 'local'
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
  busRef.value = bus
  bus.connect()
  teardown = () => {
    bus.disconnect()
    teardown = null
  }
}

export function applyTransport(transport: PackTransport, url: string | null): void {
  if (transport === 'ws' && url) useWsTransport(url)
  else useLocalTransport()
}

export function disposeBusSession(): void {
  teardown?.()
  teardown = null
}
