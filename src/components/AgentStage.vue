<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { AGENTS, type AgentDef } from '@/agents'
import { assignSlots, roleOf, type Slot } from '@/layout'
import { clamp } from '@/bot/math'
import type { StateId } from '@/bot/states'
import BotAvatar from './BotAvatar.vue'

const props = defineProps<{
  focusId: string | null
  allyIds: string[]
  companionIds: string[]
  states: Record<string, StateId>
  chatEngaged?: boolean
}>()

const ids = AGENTS.map((a) => a.id)

const slots = computed(() =>
  assignSlots({
    ids,
    focusId: props.focusId,
    allyIds: props.allyIds,
    companionIds: props.companionIds
  })
)

const baseSize = ref(120)
function measure() {
  const w = window.innerWidth
  baseSize.value = Math.max(96, Math.min(180, w * 0.14))
}

let raf = 0
const drift = ref(0)
let last = 0
const reduce = ref(false)

function tick(now: number) {
  if (!last) last = now
  const dt = (now - last) / 1000
  last = now
  if (!reduce.value) drift.value += dt
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  reduce.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  raf = requestAnimationFrame(tick)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', measure)
})

function floatFor(id: string, t: number) {
  const a = id.charCodeAt(0) * 0.13 + id.charCodeAt(1) * 0.07
  const dx = Math.sin(t * 0.55 + a) * 6
  const dy = Math.cos(t * 0.42 + a * 1.3) * 5
  return `translate(${dx}px, ${dy}px)`
}

function stateFor(agent: AgentDef): StateId {
  return props.states[agent.id] ?? agent.idleState
}

function roleClass(agent: AgentDef) {
  return roleOf(agent.id, props.focusId, props.allyIds, props.companionIds)
}

function depthBlur(slot: Slot) {
  // uzak katman hafif flu — perspektif derinliği destekler
  if (slot.z3d <= -100) return 1.2
  if (slot.z3d < 0) return 0.6
  return 0
}

function styleFor(agent: AgentDef, slot: Slot) {
  const size = baseSize.value * slot.scale
  const blur = depthBlur(slot)
  // chat açıkken gövde chat’e doğru hafif yaslanır (oyunsu “dinliyorum”)
  const lean = props.chatEngaged ? clamp((50 - slot.x) * 0.1, -5, 5) : 0
  return {
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    zIndex: slot.z,
    opacity: slot.opacity,
    width: `${size}px`,
    transform: `translate(-50%, -50%) translate3d(0, 0, ${slot.z3d}px) rotate(${lean}deg) ${floatFor(agent.id, drift.value)}`,
    filter: blur ? `blur(${blur}px)` : undefined,
    transition:
      'left .95s cubic-bezier(.22,1,.36,1), top .95s cubic-bezier(.22,1,.36,1), width .85s cubic-bezier(.22,1,.36,1), opacity .7s ease, filter .7s ease, transform .55s cubic-bezier(.22,1,.36,1)'
  }
}

function blobStyle(slot: Slot) {
  const size = baseSize.value * slot.scale
  return { width: `${size}px`, height: `${size}px` }
}

/** Chat panelinin “bakılan” noktası — input satırı. */
function gazePoint() {
  if (!props.chatEngaged) return null
  return { x: window.innerWidth / 2, y: window.innerHeight - 78 }
}
</script>

<template>
  <div class="stage" aria-label="AI agent sahnesi">
    <div
      v-for="agent in AGENTS"
      :key="agent.id"
      class="agent"
      :class="['agent--' + roleClass(agent), { 'agent--focus': agent.id === focusId }]"
      :style="styleFor(agent, slots.get(agent.id)!)"
    >
      <div class="agent__blob" :style="blobStyle(slots.get(agent.id)!)">
        <div class="agent__glow" />
        <BotAvatar
          size="100%"
          :shape="agent.shape"
          :color="agent.color"
          :expression="agent.id === focusId ? 'attentif' : agent.expression"
          :state="stateFor(agent)"
          :paper="'#E8EDF7'"
          :gaze-active="!!chatEngaged"
          :gaze-x="gazePoint()?.x ?? null"
          :gaze-y="gazePoint()?.y ?? null"
          class="agent__svg"
        />
      </div>
      <div class="agent__tag">
        <span class="agent__name">{{ agent.name }}</span>
        <span class="agent__role">{{ agent.role }}</span>
      </div>
    </div>
  </div>
</template>
