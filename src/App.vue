<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { AGENT_BY_ID, AGENTS, parseCommand } from '@/agents'
import { createLocalBus, type BusEvent, type PairMode } from '@/bus'
import { setPairMode, togglePairMode } from '@/pairMode'
import type { StateId } from '@/bot/states'
import AgentStage from '@/components/AgentStage.vue'
import ChatDock, { type ChatMessage } from '@/components/ChatDock.vue'
import DustField from '@/components/DustField.vue'
import SideMenu from '@/components/SideMenu.vue'

const messages = ref<ChatMessage[]>([])
const focusId = ref<string | null>(null)
const allyIds = ref<string[]>([])
const companionIds = ref<string[]>([])
/** yazarken seçilmiş (tam ad) ajanlar; null = boşta */
const previewIds = ref<string[] | null>(null)
/** filtre eşleşmesi — soft yaklaşım, lead değil */
const filterIds = ref<string[]>([])
const chatEngaged = ref(false)
const states = reactive<Record<string, StateId>>({})
const seq = ref(0)
/** aktif pair — side (yan yana) / orbit (bağ + orbit) */
const pair = ref<{ a: string; b: string; mode: PairMode } | null>(null)

const bus = createLocalBus()
let unsubscribe: (() => void) | null = null

/** Yapışkan kadro — summon sonrası mention’sız mesajlar buraya gider. */
function stickyMentions(): string[] {
  if (!focusId.value) return []
  return [focusId.value, ...allyIds.value].filter((id, i, arr) => arr.indexOf(id) === i)
}

const pendingHint = computed(() => {
  const selected = previewIds.value?.length ? previewIds.value : null
  const sticky = stickyMentions()
  const who = selected ?? sticky
  if (who.length) return `${who.join(' + ')} — serbest yazabilirsin, / ile değiştir`
  return '/ yaz, filtrele, Tab ile seç'
})

const activeIds = computed(() => {
  if (previewIds.value?.length) return previewIds.value
  if (focusId.value) return [focusId.value, ...allyIds.value]
  return []
})

const activeFocus = computed(() => activeIds.value[0] ?? null)

const activeRoster = computed(() => {
  const ids = activeIds.value
  if (!ids.length) return { allies: [] as string[], companions: [] as string[] }
  return resolveRoster(ids[0]!, ids.slice(1))
})

function flashState(id: string, state: StateId, ms: number) {
  states[id] = state
  window.setTimeout(() => {
    const agent = AGENT_BY_ID.get(id)
    if (agent) states[id] = agent.idleState
  }, ms)
}

function resolveRoster(primaryId: string, coIds: string[]) {
  const primary = AGENT_BY_ID.get(primaryId)!
  const allies = coIds.filter((id) => id !== primaryId)
  const companions = primary.partners.filter(
    (id) => id !== primaryId && !allies.includes(id)
  )
  return { allies, companions }
}

function push(msg: Omit<ChatMessage, 'id' | 'ts'>) {
  messages.value.push({ ...msg, id: ++seq.value, ts: Date.now() })
}

function onPreview(ids: string[]) {
  if (!ids.length) {
    previewIds.value = null
    return
  }
  const next = ids.join(',')
  const prev = previewIds.value?.join(',') ?? ''
  previewIds.value = ids
  // seçim netleşince hafif “fark ettim” — filtre / unique prefix ile değil
  if (next !== prev && !focusId.value) {
    flashState(ids[0]!, AGENT_BY_ID.get(ids[0]!)!.arriveState, 500)
  }
}

function onFilter(ids: string[]) {
  filterIds.value = ids
}

function onEngage(on: boolean) {
  chatEngaged.value = on
}

/** Sol menüden summon — chat ile aynı yolu kullanır. */
function onSummon(id: string) {
  onSend(`/${id}`)
}

/** Sahne boşluğuna tıkla → chat’ten çık, odak karsiya baksın. */
function onFloorPointer(e: PointerEvent) {
  const t = e.target as HTMLElement | null
  if (t?.closest('.chat')) return
  chatEngaged.value = false
}

function onBusEvent(e: BusEvent) {
  switch (e.type) {
    case 'user.message':
      push({ from: 'you', text: e.text })
      previewIds.value = null
      filterIds.value = []
      break

    case 'agent.called': {
      const helpers = e.helpers.filter((id) => id !== e.lead)
      const { companions } = resolveRoster(e.lead, helpers)
      focusId.value = e.lead
      allyIds.value = helpers
      companionIds.value = companions

      flashState(e.lead, AGENT_BY_ID.get(e.lead)?.arriveState ?? 'exclaim', 900)
      for (const id of helpers) {
        flashState(id, AGENT_BY_ID.get(id)?.arriveState ?? 'exclaim', 700)
      }
      for (const id of companions) flashState(id, 'notify', 500)
      break
    }

    case 'agent.thinking':
      states[e.agentId] = e.state
      break

    case 'agent.say':
      push({
        from: 'agent',
        agentId: e.agentId,
        text: e.to ? `→ ${e.to}: ${e.text}` : e.text
      })
      break

    case 'agent.done':
      states[e.agentId] = AGENT_BY_ID.get(e.agentId)?.idleState ?? 'idle'
      break

    case 'agent.pair':
      pair.value = { a: e.a, b: e.b, mode: e.mode }
      flashState(e.a, AGENT_BY_ID.get(e.a)?.arriveState ?? 'exclaim', 600)
      flashState(e.b, AGENT_BY_ID.get(e.b)?.arriveState ?? 'exclaim', 600)
      break

    case 'agent.unpair':
      if (pair.value && pair.value.a === e.a && pair.value.b === e.b) {
        pair.value = null
      }
      break

    case 'agent.handoff': {
      // sistem satırı: `ARIA → BLITZ: …` (isimler örnek — herkes herkese devredebilir)
      push({ from: 'system', text: `${e.from} → ${e.to}: ${e.task}` })
      if (focusId.value === e.to) break
      if (!allyIds.value.includes(e.to)) {
        allyIds.value = [...allyIds.value, e.to]
        const { companions } = resolveRoster(focusId.value ?? e.from, allyIds.value)
        companionIds.value = companions
        flashState(e.to, AGENT_BY_ID.get(e.to)?.arriveState ?? 'exclaim', 700)
      }
      break
    }

    // pair — Faz 4
    default:
      break
  }
}

function onSend(raw: string) {
  // Faz 4: pair modu — `!pair side|orbit` veya `!pair` (değiştir)
  const pairCmd = raw.trim().match(/^!pair(?:\s+(side|orbit))?$/i)
  if (pairCmd) {
    const next = pairCmd[1]?.toLowerCase() as PairMode | undefined
    const mode = next ? (setPairMode(next), next) : togglePairMode()
    push({ from: 'you', text: raw })
    previewIds.value = null
    filterIds.value = []
    push({ from: 'system', text: `Pair modu: ${mode}${mode === 'side' ? ' (yan yana)' : ' (orbit + bağ)'}` })
    if (pair.value) {
      pair.value = { ...pair.value, mode }
      if (mode === 'orbit') {
        flashState(pair.value.a, 'orbit', 2000)
        flashState(pair.value.b, 'orbit', 2000)
      }
    }
    return
  }

  const { ids, text, unknown } = parseCommand(raw)

  if (unknown.length) {
    push({ from: 'you', text: raw })
    previewIds.value = null
    filterIds.value = []
    push({
      from: 'system',
      text: `Bilinmeyen agent: /${unknown.join(', /')}. Uygun isimler: ${AGENTS.map((a) => a.id).join(', ')}`
    })
    return
  }

  if (!ids.length) {
    // yapışkan kadro: mention yoksa son summon’daki ajanlara gider
    const sticky = stickyMentions()
    if (sticky.length && text) {
      previewIds.value = null
      bus.dispatch({
        type: 'user.message',
        text,
        mentions: sticky
      })
      return
    }
    push({ from: 'you', text: raw })
    previewIds.value = null
    filterIds.value = []
    push({
      from: 'system',
      text: sticky.length
        ? 'Boş mesaj gönderilemez.'
        : 'Önce bir ajan seç: / yaz ve filtrele, ya da sol menüden tıkla.'
    })
    return
  }

  // tek iş satırı, çok agent — lead/helpers bus’tan gelir
  previewIds.value = null
  filterIds.value = []
  bus.dispatch({
    type: 'user.message',
    text: text || raw,
    mentions: ids
  })
}

onMounted(() => {
  unsubscribe = bus.subscribe(onBusEvent)
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribe = null
})
</script>

<template>
  <div class="floor" @pointerdown="onFloorPointer">
    <DustField />
    <SideMenu
      :messages="messages"
      :focus-id="focusId"
      :ally-ids="allyIds"
      @summon="onSummon"
    />
    <AgentStage
      :focus-id="activeFocus"
      :ally-ids="activeRoster.allies"
      :companion-ids="activeRoster.companions"
      :pair="pair"
      :states="states"
      :chat-engaged="chatEngaged"
      :filter-ids="filterIds"
    />
    <ChatDock
      :messages="messages"
      :pending-hint="pendingHint"
      @send="onSend"
      @preview="onPreview"
      @filter="onFilter"
      @engage="onEngage"
    />
  </div>
</template>
