<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { AGENTS, type AgentDef } from '@/agents'
import { assignSlots, roleOf, type Slot } from '@/layout'
import type { StateId } from '@/bot/states'
import BotAvatar from './BotAvatar.vue'

const props = defineProps<{
  focusId: string | null
  allyIds: string[]
  companionIds: string[]
  states: Record<string, StateId>
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

function styleFor(agent: AgentDef, slot: Slot) {
  const size = baseSize.value * slot.scale
  return {
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    zIndex: slot.z,
    opacity: slot.opacity,
    width: `${size}px`,
    transform: `translate(-50%, -50%) ${floatFor(agent.id, drift.value)}`
  }
}

function blobStyle(slot: Slot) {
  const size = baseSize.value * slot.scale
  return { width: `${size}px`, height: `${size}px` }
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
          :paper="'#070B14'"
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
