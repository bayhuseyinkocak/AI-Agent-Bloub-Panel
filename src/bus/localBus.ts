import { parseCommand } from '@/agents'
import { getAgent, getAgentMap, getAgents } from '@/roster'
import { getPairMode } from '@/pairMode'
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
  let activePair: { a: AgentId; b: AgentId } | null = null

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
    return getAgent(agentId)?.thinkState ?? 'thinking'
  }

  function idleState(agentId: AgentId): StateId {
    return getAgent(agentId)?.idleState ?? 'idle'
  }

  function arriveState(agentId: AgentId): StateId {
    return getAgent(agentId)?.arriveState ?? 'exclaim'
  }

  function pickReply(agentId: AgentId, userText: string): string {
    const agent = getAgent(agentId)
    if (!agent) return `${agentId} sahnede.`
    if (!userText) return `${agent.name} sahneye geldim. Ne yapmamı istersin?`
    const hash = userText.length + agent.id.length
    return agent.replies[hash % agent.replies.length]!
  }

  /**
   * Handoff hedefi — yetki yok, herkes herkese devredebilir.
   * 1) kullanıcı net yazdı: `devret ARIS` / `@ARIS` / `→ARIS`
   * 2) konuşma cümlesi başka bir agent adı geçiyor (örnek isimler bağlayıcı değil)
   */
  function findHandoffTarget(
    speaker: AgentId,
    userText: string,
    sayText: string
  ): AgentId | null {
    const explicit = userText.match(/(?:devret|devrediyorum|handoff|@|→)\s*\/?([A-Za-z]{2,})/i)
    if (explicit) {
      const id = explicit[1]!.toUpperCase()
      if (getAgent(id) && id !== speaker) return id
    }
    for (const agent of getAgents()) {
      if (agent.id === speaker) continue
      if (new RegExp(`\\b${agent.id}\\b`, 'i').test(sayText)) return agent.id
    }
    return null
  }

  /** Tek tur: konuşur, gerekirse handoff açar (her agent için). */
  function runTurn(
    agentId: AgentId,
    userText: string,
    task: string,
    delay: number,
    chained: boolean
  ): void {
    later(delay, () => {
      emit({ type: 'agent.thinking', agentId, state: thinkState(agentId) })
      const sayText = pickReply(agentId, userText)

      later(350, () => {
        emit({ type: 'agent.say', agentId, text: sayText })
        emit({ type: 'agent.thinking', agentId, state: idleState(agentId) })
        emit({ type: 'agent.done', agentId })

        if (chained) return
        const target = findHandoffTarget(agentId, userText, sayText)
        if (!target) return

        later(180, () => {
          emit({ type: 'agent.handoff', from: agentId, to: target, task })
          emit({ type: 'agent.thinking', agentId: target, state: arriveState(target) })
          runTurn(target, userText, task, 420, true)
        })
      })
    })
  }

  /** Tek iş satırı, çok agent: ilk mention lead, diğerleri helper. */
  function simulate(payload: Extract<BusEventInput, { type: 'user.message' }>): void {
    const { text, mentions } = payload
    const lead = mentions[0]
    if (!lead) return

    const helpers = mentions.slice(1)
    if (activePair) {
      emit({ type: 'agent.unpair', a: activePair.a, b: activePair.b })
      activePair = null
    }
    emit({ type: 'agent.called', lead, helpers })

    // yalnızca tam 2 ajan → pair; 3+ kadro V formasyonu kullanır
    const partner = helpers.length === 1 ? helpers[0] : null
    if (partner) {
      const mode = getPairMode()
      later(420, () => {
        activePair = { a: lead, b: partner }
        emit({ type: 'agent.pair', a: lead, b: partner, mode })
        if (mode === 'orbit') {
          emit({ type: 'agent.thinking', agentId: lead, state: 'orbit' })
          emit({ type: 'agent.thinking', agentId: partner, state: 'orbit' })
        }
      })
    }

    // sırayla konuş — 4 ajan aynı anda sallanmasın, sadece cevap veren hareket eder
    const queue = [lead, ...helpers]
    let delay = 200
    for (const id of queue) {
      runTurn(id, text, text, delay, false)
      delay += 850
    }
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
          event.mentions.length > 0
            ? event.mentions
            : (parseCommand(event.text, getAgentMap()).ids as AgentId[])
        const packet = { ...event, mentions }
        emit(packet)
        simulate(packet)
        return
      }
      emit(event)
    }
  }
}
