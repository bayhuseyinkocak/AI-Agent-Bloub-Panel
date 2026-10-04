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
/** Tab/Enter/tık ile kesinleşenler — merkezde bekler */
const selectedIds = ref<string[]>([])
/** filtre pull 0–1 — yazdıkça ortaya */
const filterPulls = ref<Record<string, number>>({})
/** konuşan / işi alan — kadroda ortaya geçer */
const spotlightId = ref<string | null>(null)
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
  const sel = selectedIds.value
  const sticky = stickyMentions()
  const who = sel.length ? sel : sticky
  if (sel.length) return `${sel.join(' + ')} seçildi — mesaj yaz, birden fazla da seçebilirsin`
  if (who.length) return `${who.join(' + ')} — serbest yazabilirsin, / ile değiştir`
  return '/ARI… filtrele, Tab ile seç (ARIA mı ARIS mi?)'
})

const activeIds = computed(() => {
  if (selectedIds.value.length) return selectedIds.value
  if (Object.keys(filterPulls.value).length) return Object.keys(filterPulls.value)
  if (focusId.value) return [focusId.value, ...allyIds.value]
  return []
})

const activeFocus = computed(() => focusId.value)

const activeRoster = computed(() => {
  if (selectedIds.value.length || Object.keys(filterPulls.value).length) {
    return { allies: [] as string[], companions: [] as string[] }
  }
  const ids = focusId.value ? [focusId.value, ...allyIds.value] : []
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
  const next = ids.join(',')
  const prev = selectedIds.value.join(',')
  selectedIds.value = ids
  if (next !== prev && ids.length && next.split(',').length > prev.split(',').filter(Boolean).length) {
    const added = ids.find((id) => !prev.includes(id))
    if (added) flashState(added, AGENT_BY_ID.get(added)?.arriveState ?? 'exclaim', 450)
  }
}

function onFilter(pulls: Record<string, number>) {
  filterPulls.value = pulls
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
      selectedIds.value = []
      filterPulls.value = {}
      break

    case 'agent.called': {
      const helpers = e.helpers.filter((id) => id !== e.lead)
      const { companions } = resolveRoster(e.lead, helpers)
      focusId.value = e.lead
      allyIds.value = helpers
      companionIds.value = companions
      spotlightId.value = e.lead

      flashState(e.lead, AGENT_BY_ID.get(e.lead)?.arriveState ?? 'exclaim', 900)
      // helper’lar sessiz gelsin — kalabalıkta herkes zıplamasın
      if (!helpers.length) {
        for (const id of companions) flashState(id, 'notify', 500)
      }
      break
    }

    case 'agent.thinking':
      states[e.agentId] = e.state
      // sadece gerçekten düşünen öne çıkar (orbit vs. değil)
      if (e.state === (AGENT_BY_ID.get(e.agentId)?.thinkState ?? 'thinking')) {
        spotlightId.value = e.agentId
      }
      break

    case 'agent.say':
      spotlightId.value = e.agentId
      push({
        from: 'agent',
        agentId: e.agentId,
        text: e.to ? `→ ${e.to}: ${e.text}` : e.text
      })
      break

    case 'agent.done':
      states[e.agentId] = AGENT_BY_ID.get(e.agentId)?.idleState ?? 'idle'
      // konuşma bitince lead ortaya döner (varsa)
      if (spotlightId.value === e.agentId && focusId.value) {
        spotlightId.value = focusId.value
      }
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
      // sistem satırı: `ARIA → ARIS: …` (isimler örnek — herkes herkese devredebilir)
      push({ from: 'system', text: `${e.from} → ${e.to}: ${e.task}` })
      spotlightId.value = e.to
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
    selectedIds.value = []
    filterPulls.value = {}
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
    selectedIds.value = []
    filterPulls.value = {}
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
      selectedIds.value = []
      filterPulls.value = {}
      bus.dispatch({
        type: 'user.message',
        text,
        mentions: sticky
      })
      return
    }
    push({ from: 'you', text: raw })
    selectedIds.value = []
    filterPulls.value = {}
    push({
      from: 'system',
      text: sticky.length
        ? 'Boş mesaj gönderilemez.'
        : 'Önce bir ajan seç: / yaz ve filtrele, ya da sol menüden tıkla.'
    })
    return
  }

  // tek iş satırı, çok agent — lead/helpers bus’tan gelir
  selectedIds.value = []
  filterPulls.value = {}
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
      :selected-ids="selectedIds"
      :filter-pulls="filterPulls"
      :spotlight-id="spotlightId"
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
