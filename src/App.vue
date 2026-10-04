<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { AGENT_BY_ID, AGENTS, parseCommand, type AgentDef } from '@/agents'
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

function pickReply(agent: AgentDef, userText: string) {
  if (!userText) {
    return `${agent.name} sahneye geldim. Ne yapmamı istersin?`
  }
  const hash = userText.length + agent.id.length
  return agent.replies[hash % agent.replies.length]!
}

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

function onSend(raw: string) {
  const { ids, text, unknown } = parseCommand(raw)

  push({ from: 'you', text: raw })
  previewIds.value = null

  if (unknown.length) {
    push({
      from: 'system',
      text: `Bilinmeyen agent: /${unknown.join(', /')}. Uygun isimler: ${AGENTS.map((a) => a.id).join(', ')}`
    })
  }

  if (!ids.length) {
    if (text) {
      push({
        from: 'system',
        text: 'Mesaj için bir agent çağır: örn. /ARIA ' + text
      })
    }
    return
  }

  const primaryId = ids[0]!
  const coIds = ids.slice(1)
  const { allies, companions } = resolveRoster(primaryId, coIds)

  focusId.value = primaryId
  allyIds.value = allies
  companionIds.value = companions

  flashState(primaryId, AGENT_BY_ID.get(primaryId)!.arriveState, 900)
  for (const id of allies) flashState(id, AGENT_BY_ID.get(id)!.arriveState, 700)
  for (const id of companions) flashState(id, 'notify', 500)

  const primary = AGENT_BY_ID.get(primaryId)!
  window.setTimeout(() => {
    states[primaryId] = primary.thinkState
    push({ from: 'agent', agentId: primaryId, text: pickReply(primary, text) })
    window.setTimeout(() => {
      states[primaryId] = primary.idleState
    }, 1200)
  }, 550)

  for (const id of [...allies, ...companions]) {
    const agent = AGENT_BY_ID.get(id)!
    window.setTimeout(() => {
      push({ from: 'agent', agentId: id, text: `${agent.name} yanındayım.` })
      flashState(id, agent.thinkState, 800)
    }, 700 + Math.random() * 400)
  }
}
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
