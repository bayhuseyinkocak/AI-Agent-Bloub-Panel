<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { AGENT_BY_ID, AGENTS, parseCommand } from '@/agents'
import { createLocalBus, type BusEvent } from '@/bus'
import type { StateId } from '@/bot/states'
import AgentStage from '@/components/AgentStage.vue'
import ChatDock, { type ChatMessage } from '@/components/ChatDock.vue'
import DustField from '@/components/DustField.vue'

const messages = ref<ChatMessage[]>([])
const focusId = ref<string | null>(null)
const allyIds = ref<string[]>([])
const companionIds = ref<string[]>([])
/** yazarken canlı önizleme; null = gönderilmiş / boşta hali */
const previewIds = ref<string[] | null>(null)
const chatEngaged = ref(false)
const states = reactive<Record<string, StateId>>({})
const seq = ref(0)

const bus = createLocalBus()
let unsubscribe: (() => void) | null = null

const pendingHint = computed(() => {
  const live = previewIds.value?.length ? previewIds.value[0] : null
  const who = live ?? focusId.value
  if (who) return `${who} sahnede — /DIĞER ile değiştir`
  return '/ARIA, /NOVA, /BLITZ…'
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
  // ilk kez yazarken hafif “fark ettim” vurgusu
  if (next !== prev && !focusId.value) {
    flashState(ids[0]!, AGENT_BY_ID.get(ids[0]!)!.arriveState, 500)
  }
}

function onEngage(on: boolean) {
  chatEngaged.value = on
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

    // handoff / pair — Faz 3–4
    default:
      break
  }
}

function onSend(raw: string) {
  const { ids, text, unknown } = parseCommand(raw)

  if (unknown.length) {
    push({ from: 'you', text: raw })
    previewIds.value = null
    push({
      from: 'system',
      text: `Bilinmeyen agent: /${unknown.join(', /')}. Uygun isimler: ${AGENTS.map((a) => a.id).join(', ')}`
    })
    return
  }

  if (!ids.length) {
    push({ from: 'you', text: raw })
    previewIds.value = null
    if (text) {
      push({
        from: 'system',
        text: 'Mesaj için bir agent çağır: örn. /ARIA ' + text
      })
    }
    return
  }

  // tek iş satırı, çok agent — lead/helpers bus’tan gelir
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
    <AgentStage
      :focus-id="activeFocus"
      :ally-ids="activeRoster.allies"
      :companion-ids="activeRoster.companions"
      :states="states"
      :chat-engaged="chatEngaged"
    />
    <ChatDock
      :messages="messages"
      :pending-hint="pendingHint"
      @send="onSend"
      @preview="onPreview"
      @engage="onEngage"
    />
  </div>
</template>
