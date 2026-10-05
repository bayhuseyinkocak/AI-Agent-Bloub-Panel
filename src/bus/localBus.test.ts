/**
 * LocalBus smoke: summon / multi / handoff / pair.
 *   npm test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalBus } from './localBus'
import type { BusEvent } from './types'
import { applyRoster, getAgents, parseRosterCommand } from '@/roster'
import { AGENTS } from '@/agents'
import { setPairMode } from '@/pairMode'

function collect() {
  const events: BusEvent[] = []
  return {
    events,
    types: () => events.map((e) => e.type),
    find: <T extends BusEvent['type']>(type: T) =>
      events.filter((e) => e.type === type) as Extract<BusEvent, { type: T }>[]
  }
}

async function flush(ms = 2500) {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('localBus smoke', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    applyRoster([...AGENTS])
    setPairMode('side')
  })

  it('summon: tek lead → called / thinking / say / done', async () => {
    const bus = createLocalBus()
    const log = collect()
    bus.subscribe((e) => log.events.push(e))

    bus.dispatch({ type: 'user.message', text: 'merhaba', mentions: ['ARIA'] })
    await flush()

    const types = log.types()
    expect(types).toContain('user.message')
    expect(types).toContain('agent.called')
    expect(types).toContain('agent.say')
    expect(types).toContain('agent.done')

    const called = log.find('agent.called')[0]!
    expect(called.lead).toBe('ARIA')
    expect(called.helpers).toEqual([])
  })

  it('multi: /ARIA /ARIS → lead + helper + pair', async () => {
    const bus = createLocalBus()
    const log = collect()
    bus.subscribe((e) => log.events.push(e))

    bus.dispatch({ type: 'user.message', text: 'bak', mentions: ['ARIA', 'ARIS'] })
    await flush()

    const called = log.find('agent.called')[0]!
    expect(called.lead).toBe('ARIA')
    expect(called.helpers).toEqual(['ARIS'])

    const pair = log.find('agent.pair')[0]!
    expect(pair.a).toBe('ARIA')
    expect(pair.b).toBe('ARIS')
    expect(pair.mode).toBe('side')
  })

  it('handoff: devret ARIS → agent.handoff (herkes → herkes)', async () => {
    const bus = createLocalBus()
    const log = collect()
    bus.subscribe((e) => log.events.push(e))

    bus.dispatch({
      type: 'user.message',
      text: 'bu işi devret ARIS',
      mentions: ['ARIA']
    })
    await flush()

    const handoff = log.find('agent.handoff')[0]!
    expect(handoff.from).toBe('ARIA')
    expect(handoff.to).toBe('ARIS')
  })

  it('pair orbit modu', async () => {
    setPairMode('orbit')
    const bus = createLocalBus()
    const log = collect()
    bus.subscribe((e) => log.events.push(e))

    bus.dispatch({ type: 'user.message', text: 'eşleş', mentions: ['BLITZ', 'BLIX'] })
    await flush()

    const pair = log.find('agent.pair')[0]!
    expect(pair.mode).toBe('orbit')
  })

  it('parseRosterCommand / pack roster', () => {
    const { ids, text } = parseRosterCommand('/ARIA /ARIS merhaba')
    expect(ids).toEqual(['ARIA', 'ARIS'])
    expect(text).toBe('merhaba')
    expect(getAgents().length).toBe(8)
  })

  it('bus task/subspawn/subdone geçer', () => {
    const bus = createLocalBus()
    const log = collect()
    bus.subscribe((e) => log.events.push(e))
    bus.dispatch({ type: 'agent.task', from: 'ARIA', to: 'ARIS', goal: 'analiz' })
    bus.dispatch({ type: 'agent.subspawn', parent: 'ARIS', child: 'ARIS.KESIF', step: 'keşif' })
    bus.dispatch({ type: 'agent.subdone', parent: 'ARIS', child: 'ARIS.KESIF', step: 'keşif', summary: 'ok' })
    expect(log.types()).toEqual(['agent.task', 'agent.subspawn', 'agent.subdone'])
  })
})
