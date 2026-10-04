<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { AGENTS, AGENT_BY_ID, type AgentDef } from '@/agents'
import type { PairMode } from '@/bus'
import { assignSlots, roleOf, type PairBinding, type Slot } from '@/layout'
import { clamp } from '@/bot/math'
import type { StateId } from '@/bot/states'
import { COLOR_BY_ID } from '@/bot/skins'
import BotAvatar from './BotAvatar.vue'

const props = defineProps<{
  focusId: string | null
  allyIds: string[]
  companionIds: string[]
  pair?: PairBinding | null
  states: Record<string, StateId>
  chatEngaged?: boolean
  /** Tab ile kesinleşenler — merkezde bekleme */
  selectedIds?: string[]
  /** filtre pull 0–1 — yazdıkça ortaya */
  filterPulls?: Record<string, number>
}>()

const ids = AGENTS.map((a) => a.id)

const slots = computed(() =>
  assignSlots({
    ids,
    focusId: props.focusId,
    allyIds: props.allyIds,
    companionIds: props.companionIds,
    pair: props.pair ?? null,
    selectedIds: props.selectedIds ?? [],
    filterPulls: props.filterPulls ?? {}
  })
)

const baseSize = ref(120)
function measure() {
  const w = window.innerWidth
  baseSize.value = Math.max(96, Math.min(180, w * 0.14))
}

/** Summon bounce: her varışta sınıfı çevirip animasyonu yeniden tetikle. */
const bounceKey = reactive<Record<string, number>>({})
/** chat’ten yeni çıkan odak: kısa Surprised parıltısı */
const snapFront = ref(false)
let snapTimer = 0

watch(
  () => props.chatEngaged,
  (on) => {
    if (on) {
      snapFront.value = false
      window.clearTimeout(snapTimer)
      return
    }
    // chat’ten çık → Surprised biraz daha uzun, sonra Attentive (karsiya)
    snapFront.value = true
    window.clearTimeout(snapTimer)
    snapTimer = window.setTimeout(() => {
      snapFront.value = false
    }, 1600)
  }
)

watch(
  () => `${props.focusId ?? ''}|${props.allyIds.join(',')}|${props.companionIds.join(',')}`,
  () => {
    const arrived = [props.focusId, ...props.allyIds, ...props.companionIds].filter(
      Boolean
    ) as string[]
    for (const id of arrived) {
      bounceKey[id] = (bounceKey[id] ?? 0) + 1
      // summon toz kalkması
      const slot = slots.value.get(id)
      const agent = AGENT_BY_ID.get(id)
      if (slot && agent) {
        const color = COLOR_BY_ID.get(agent.color)?.hex ?? '#E8EDF7'
        window.dispatchEvent(
          new CustomEvent('dust:burst', {
            detail: {
              x: (slot.x / 100) * window.innerWidth,
              y: (slot.y / 100) * window.innerHeight,
              color
            }
          })
        )
      }
    }
  }
)

function popClass(id: string) {
  return (bounceKey[id] ?? 0) % 2 === 0 ? 'agent__pop--a' : 'agent__pop--b'
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

function floatFor(id: string, t: number, damp = 1) {
  const a = id.charCodeAt(0) * 0.13 + id.charCodeAt(1) * 0.07
  const dx = Math.sin(t * 0.55 + a) * 6 * damp
  const dy = Math.cos(t * 0.42 + a * 1.3) * 5 * damp
  return `translate(${dx}px, ${dy}px)`
}

function stateFor(agent: AgentDef): StateId {
  return props.states[agent.id] ?? agent.idleState
}

function roleClass(agent: AgentDef) {
  return roleOf(
    agent.id,
    props.focusId,
    props.allyIds,
    props.companionIds,
    props.pair ?? null,
    props.selectedIds ?? [],
    props.filterPulls ?? {}
  )
}

/** orbit pair: hafif bağ — iki slot ortası yumuşak kavis */
const bond = computed(() => {
  const p = props.pair
  if (!p || p.mode !== 'orbit') return null
  const sa = slots.value.get(p.a)
  const sb = slots.value.get(p.b)
  if (!sa || !sb) return null
  const x1 = sa.x
  const y1 = sa.y
  const x2 = sb.x
  const y2 = sb.y
  const mx = (x1 + x2) / 2
  const my = Math.min(y1, y2) - 8
  return {
    path: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,
    mode: p.mode as PairMode
  }
})

function depthBlur(slot: Slot) {
  // uzak katman hafif flu — perspektif derinliği destekler
  if (slot.z3d <= -100) return 1.2
  if (slot.z3d < 0) return 0.6
  return 0
}

function isWait(agent: AgentDef) {
  return (props.selectedIds ?? []).includes(agent.id)
}

function isProbe(agent: AgentDef) {
  return (props.filterPulls?.[agent.id] ?? 0) > 0
}

function isSoft(agent: AgentDef) {
  return isWait(agent) || isProbe(agent)
}

function expressionFor(agent: AgentDef) {
  if (agent.id === props.focusId && !isSoft(agent)) {
    if (props.chatEngaged) return 'effraye'
    if (snapFront.value) return 'surpris'
    return 'attentif'
  }
  if (isWait(agent)) return 'attentif'
  if (isProbe(agent)) return 'curieux'
  return agent.expression
}

function gazeModeFor(agent: AgentDef): 'chat' | 'front' | null {
  if (agent.id === props.focusId && !isSoft(agent)) {
    return props.chatEngaged ? 'chat' : 'front'
  }
  if (isSoft(agent)) return 'chat'
  return props.chatEngaged ? null : 'front'
}

function styleFor(agent: AgentDef, slot: Slot) {
  const wait = isWait(agent)
  const probe = isProbe(agent)
  const live = wait || probe
  const size = baseSize.value * slot.scale
  const blur = depthBlur(slot)
  const lean = props.chatEngaged || live ? clamp((50 - slot.x) * 0.1, -5, 5) : 0
  // filtre = yazdıkça kademeli (biraz daha yavaş); seçim/commit = net
  const t = probe && !wait
    ? 'left 1.15s cubic-bezier(.22,1,.36,1), top 1.15s cubic-bezier(.22,1,.36,1), width 1s cubic-bezier(.22,1,.36,1), opacity .7s ease, filter .6s ease, transform .9s cubic-bezier(.22,1,.36,1)'
    : 'left .85s cubic-bezier(.22,1,.36,1), top .85s cubic-bezier(.22,1,.36,1), width .75s cubic-bezier(.22,1,.36,1), opacity .55s ease, filter .7s ease, transform .55s cubic-bezier(.22,1,.36,1)'
  return {
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    zIndex: slot.z + (wait ? 8 : probe ? 4 : 0),
    opacity: slot.opacity,
    width: `${size}px`,
    transform: `translate(-50%, -50%) translate3d(0, 0, ${slot.z3d}px) rotate(${lean}deg) ${floatFor(agent.id, drift.value, live ? 0.4 : 1)}`,
    filter: blur ? `blur(${blur}px)` : undefined,
    transition: t
  }
}

function blobStyle(slot: Slot) {
  const size = baseSize.value * slot.scale
  return { width: `${size}px`, height: `${size}px` }
}

/** Temas gölgesi: yakın obje geniş/soft, uzak obje dar/soluk. */
function shadowStyle(slot: Slot) {
  const near = clamp((slot.z3d + 180) / 340, 0, 1)
  const w = 55 + near * 55
  const h = 12 + near * 10
  const o = 0.12 + near * 0.28
  return {
    width: `${w}%`,
    height: `${h}%`,
    opacity: o,
    filter: `blur(${8 - near * 4}px)`
  }
}

/** Chat panelinin “bakılan” noktası — input satırı. */
function gazePointFor(agent: AgentDef) {
  const target = { x: window.innerWidth / 2, y: window.innerHeight - 78 }
  if (isSoft(agent)) return target
  if (props.chatEngaged && agent.id === props.focusId) return target
  return null
}
</script>

<template>
  <div class="stage" aria-label="AI agent sahnesi">
    <svg
      v-if="bond"
      class="pair-bond"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path class="pair-bond__path" :d="bond.path" />
    </svg>
    <div
      v-for="agent in AGENTS"
      :key="agent.id"
      class="agent"
      :class="[
        'agent--' + roleClass(agent),
        {
          'agent--focus': agent.id === focusId || (pair && (agent.id === pair.a || agent.id === pair.b)),
          'agent--pair-a': pair?.a === agent.id,
          'agent--pair-b': pair?.b === agent.id,
          'agent--pair': pair && (agent.id === pair.a || agent.id === pair.b),
          'agent--soft': isProbe(agent),
          'agent--wait': isWait(agent)
        }
      ]"
      :style="styleFor(agent, slots.get(agent.id)!)"
    >
      <div class="agent__blob" :style="blobStyle(slots.get(agent.id)!)">
        <div class="agent__pop" :class="popClass(agent.id)">
          <div class="agent__ground" :style="shadowStyle(slots.get(agent.id)!)" />
          <div class="agent__glow" />
          <BotAvatar
            size="100%"
            :shape="agent.shape"
            :color="agent.color"
            :expression="expressionFor(agent)"
            :state="stateFor(agent)"
            :paper="'#E8EDF7'"
            :gaze-active="!!gazePointFor(agent)"
            :gaze-x="gazePointFor(agent)?.x ?? null"
            :gaze-y="gazePointFor(agent)?.y ?? null"
            :gaze-down="agent.id === focusId && !!chatEngaged"
            :gaze-mode="gazeModeFor(agent)"
            :gaze-soft="agent.id !== focusId"
            class="agent__svg"
          />
        </div>
      </div>
      <div class="agent__tag">
        <span class="agent__name">{{ agent.name }}</span>
        <span class="agent__role">{{ agent.role }}</span>
      </div>
    </div>
  </div>
</template>
