import { AGENT_BY_ID, parseCommand } from '@/agents'
import type { StateId } from '@/bot/states'
import type {
  AgentBus,
  AgentId,
  BusEvent,
  BusEventInput,
  BusHandler,
  Unsubscribe
} from './types'

export interface LocalBusOptions {
  /** user.message → sahte agent olay dizisi (backend gelene kadar) */
  mock?: boolean
}

/**
 * Yerel olay yolu. Bugün sahte üretir; yarın WS/SSE aynı `BusEvent` tiplerini basar.
 * UI yalnızca `subscribe` / `dispatch` kullanır.
 */
export function createLocalBus(options: LocalBusOptions = {}): AgentBus {
  const mock = options.mock ?? true
  const handlers = new Set<BusHandler>()
  const timers = new Set<number>()

  function emit(event: BusEventInput): void {
    const packet: BusEvent = { ...event, ts: Date.now() }
    for (const handler of [...handlers]) handler(packet)
  }

  function later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
  }

  function thinkState(agentId: AgentId): StateId {
    return AGENT_BY_ID.get(agentId)?.thinkState ?? 'thinking'
  }

  function idleState(agentId: AgentId): StateId {
    return AGENT_BY_ID.get(agentId)?.idleState ?? 'idle'
  }

  function pickReply(agentId: AgentId, userText: string): string {
    const agent = AGENT_BY_ID.get(agentId)
    if (!agent) return `${agentId} sahnede.`
    if (!userText) return `${agent.name} sahneye geldim. Ne yapmamı istersin?`
    const hash = userText.length + agent.id.length
    return agent.replies[hash % agent.replies.length]!
  }

  /** Tek iş satırı, çok agent: ilk mention lead, diğerleri helper. */
  function simulate(payload: Extract<BusEventInput, { type: 'user.message' }>): void {
    const { text, mentions } = payload
    const lead = mentions[0]
    if (!lead) return

    const helpers = mentions.slice(1)
    emit({ type: 'agent.called', lead, helpers })

    later(200, () => {
      emit({ type: 'agent.thinking', agentId: lead, state: thinkState(lead) })
    })

    later(550, () => {
      emit({ type: 'agent.say', agentId: lead, text: pickReply(lead, text) })
      emit({ type: 'agent.thinking', agentId: lead, state: idleState(lead) })
      emit({ type: 'agent.done', agentId: lead })
    })

    helpers.forEach((id, i) => {
      later(700 + i * 180, () => {
        emit({ type: 'agent.thinking', agentId: id, state: thinkState(id) })
        emit({ type: 'agent.say', agentId: id, text: `${id} yanındayım.` })
        emit({ type: 'agent.thinking', agentId: id, state: idleState(id) })
        emit({ type: 'agent.done', agentId: id })
      })
    })
  }

  return {
    subscribe(handler: BusHandler): Unsubscribe {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },

    dispatch(event: BusEventInput): void {
      if (mock && event.type === 'user.message') {
        const mentions =
          event.mentions.length > 0 ? event.mentions : (parseCommand(event.text).ids as AgentId[])
        const packet = { ...event, mentions }
        emit(packet)
        simulate(packet)
        return
      }
      emit(event)
    }
  }
}
