import type { StateId } from '@/bot/states'

export type AgentId = string

/** UI’ya sadece bu olaylar akar — metin/state bilgisi olay gövdesindedir. */
export type BusEventInput =
  | { type: 'user.message'; text: string; mentions: AgentId[] }
  | { type: 'agent.called'; lead: AgentId; helpers: AgentId[] }
  | { type: 'agent.thinking'; agentId: AgentId; state: StateId }
  | { type: 'agent.say'; agentId: AgentId; text: string; to?: AgentId }
  | { type: 'agent.handoff'; from: AgentId; to: AgentId; task: string }
  | { type: 'agent.pair'; a: AgentId; b: AgentId; mode: PairMode }
  | { type: 'agent.unpair'; a: AgentId; b: AgentId }
  | { type: 'agent.done'; agentId: AgentId }

export type PairMode = 'side' | 'orbit'

/** Transport bağlantı durumu — ayarlarda rozet. */
export type BusConnectionStatus = 'local' | 'connecting' | 'open' | 'closed' | 'error'

export type BusEvent = BusEventInput & { ts: number }

export type BusEventType = BusEvent['type']

export type BusHandler = (event: BusEvent) => void

export type Unsubscribe = () => void

/** UI’nin görebildiği tek arayüz. */
export interface AgentBus {
  subscribe(handler: BusHandler): Unsubscribe
  dispatch(event: BusEventInput): void
}

export function isBusEvent(value: unknown): value is BusEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'ts' in value &&
    typeof (value as BusEvent).type === 'string' &&
    typeof (value as BusEvent).ts === 'number'
  )
}
