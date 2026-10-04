<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, watch } from 'vue'
import { NOTIF_BLUE } from '@/bot/decor'
import { BotEngine, type BotFrame } from '@/bot/engine'
import { mixHex, COLOR_BY_ID, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID } from '@/bot/skins'
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from '@/bot/expressions'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { STATE_BY_ID, type StateId } from '@/bot/states'
import { lookTarget, tourEase, TURN_TIME } from '@/ui/gaze'
import { clamp } from '@/bot/math'

const props = withDefaults(
  defineProps<{
    size?: number | string
    shape?: string
    color?: string
    expression?: string
    paper?: string
    state?: StateId
    /** ekranda bakılacak nokta (client koordinat); null = serbest bakış */
    gazeX?: number | null
    gazeY?: number | null
    gazeActive?: boolean
    /** odak avatar: chat’e doğru ekstra aşağı bakış */
    gazeDown?: boolean
  }>(),
  {
    size: 120,
    shape: DEFAULT_SHAPE,
    color: DEFAULT_COLOR,
    expression: DEFAULT_EXPRESSION,
    paper: '#E8EDF7',
    state: 'idle' as StateId,
    gazeX: null,
    gazeY: null,
    gazeActive: false,
    gazeDown: false
  }
)

const R = RAYON
const VB = DEMI_VIEWBOX

const shapeRadii = computed(() => SHAPE_BY_ID.get(props.shape)?.radii ?? null)
const ink = computed(() => COLOR_BY_ID.get(props.color)?.hex ?? '#0a0a0c')
const expr = computed(() => EXPRESSION_BY_ID.get(props.expression) ?? null)

const engine = new BotEngine(R, props.state, shapeRadii.value, expr.value)
const frame = shallowRef<BotFrame>(engine.sample(0))
const uid = Math.random().toString(36).slice(2, 8)
const maskId = `bot-mask-${uid}`

let raf = 0
let clock = 0
let last = 0
const svgEl = ref<SVGSVGElement | null>(null)
let aiming = false
let turnSince = 0

function applyGaze() {
  const active = props.gazeActive && props.gazeX != null && props.gazeY != null
  const faceOk = STATE_BY_ID.get(props.state)?.baseFace !== false
  if (!active || !faceOk) {
    if (aiming) {
      engine.setLook(null, clock, TURN_TIME)
      aiming = false
    }
    return
  }
  const box = svgEl.value?.getBoundingClientRect()
  if (!box || box.width === 0 || box.height === 0) return
  if (!aiming) turnSince = clock
  const demiW = Math.max(1, window.innerWidth / 2)
  const demiH = Math.max(1, window.innerHeight / 2)
  engine.setLook(
    lookTarget({
      nx: clamp((props.gazeX! - (box.left + box.width / 2)) / demiW, -1, 1),
      ny: clamp((props.gazeY! - (box.top + box.height / 2)) / demiH, -1, 1),
      tour: tourEase(clock - turnSince),
      pointer: true,
      // en öndeki: chat’e dikine baksın (effraye eğilimi)
      down: props.gazeDown ? 16 : 0,
      nyBoost: props.gazeDown ? 2.2 : 1
    }),
    // yumuşak yakalama — ani kilit değil
    clock,
    0.45
  )
  aiming = true
}

function tick(now: number) {
  if (!last) last = now
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  clock += dt
  applyGaze()
  frame.value = engine.sample(clock)
  triggerRef(frame)
  raf = requestAnimationFrame(tick)
}

watch(
  () => props.state,
  (s) => engine.setState(s, clock)
)

watch(shapeRadii, (radii) => engine.setShape(radii, clock))
watch(expr, (e) => engine.setExpression(e, clock))

onMounted(() => {
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))

function dotAttrs(dot: BotFrame['dots'][number]) {
  const fill =
    dot.color ?? (dot.depth === undefined ? ink.value : mixHex(props.paper, ink.value, dot.depth))
  const common = { fill, opacity: dot.opacity }
  return dot.d
    ? {
        ...common,
        d: dot.d,
        transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`
      }
    : { ...common, cx: dot.x, cy: dot.y, r: dot.r }
}
</script>

<template>
  <svg
    ref="svgEl"
    :width="typeof props.size === 'number' ? props.size : '100%'"
    :height="typeof props.size === 'number' ? props.size : '100%'"
    :style="typeof props.size === 'string' ? { width: props.size, height: '100%', display: 'block' } : undefined"
    :viewBox="`${-VB} ${-VB} ${VB * 2} ${VB * 2}`"
    role="img"
    aria-label="AI agent avatar"
  >
    <defs>
      <mask
        :id="maskId"
        maskUnits="userSpaceOnUse"
        :x="-VB"
        :y="-VB"
        :width="VB * 2"
        :height="VB * 2"
      >
        <path :d="frame.bodyPath" fill="#fff" />
        <path
          v-for="(eye, i) in frame.eyes"
          :key="i"
          :d="eye.d"
          :transform="eye.matrix"
          :opacity="eye.alpha"
          fill="#000"
        />
        <circle v-if="frame.notch" :cx="frame.notch.x" :cy="frame.notch.y" :r="frame.notch.r" fill="#000" />
      </mask>
      <linearGradient
        v-for="arc in frame.arcs"
        :id="`${uid}-${arc.id}`"
        :key="arc.id"
        gradientUnits="userSpaceOnUse"
        :x1="arc.grad.x1"
        :y1="arc.grad.y1"
        :x2="arc.grad.x2"
        :y2="arc.grad.y2"
      >
        <stop
          v-for="(c, i) in arc.grad.stops"
          :key="i"
          :offset="i / (arc.grad.stops.length - 1)"
          :stop-color="c"
        />
      </linearGradient>
    </defs>

    <g fill="none" stroke-linecap="round">
      <path
        v-for="arc in frame.arcs"
        :key="`b${arc.id}`"
        :d="arc.back"
        :stroke="`url(#${uid}-${arc.id})`"
        :stroke-width="arc.width"
        :opacity="arc.opacity"
      />
    </g>

    <g v-if="frame.dotsBehind">
      <component
        :is="dot.d ? 'path' : 'circle'"
        v-for="(dot, i) in frame.dots"
        :key="`pb${i}`"
        v-bind="dotAttrs(dot)"
      />
    </g>

    <g :opacity="frame.bodyAlpha">
      <path :d="frame.bodyPath" :fill="props.paper" />
      <g :mask="`url(#${maskId})`">
        <rect :x="-VB" :y="-VB" :width="VB * 2" :height="VB * 2" :fill="ink" />
      </g>
    </g>

    <g v-if="!frame.dotsBehind">
      <component
        :is="dot.d ? 'path' : 'circle'"
        v-for="(dot, i) in frame.dots"
        :key="`pf${i}`"
        v-bind="dotAttrs(dot)"
      />
    </g>

    <circle
      v-if="frame.notif"
      :cx="frame.notif.x"
      :cy="frame.notif.y"
      :r="frame.notif.r"
      :fill="NOTIF_BLUE"
    />

    <g fill="none" stroke-linecap="round">
      <path
        v-for="arc in frame.arcs"
        :key="`f${arc.id}`"
        :d="arc.front"
        :stroke="`url(#${uid}-${arc.id})`"
        :stroke-width="arc.width"
        :opacity="arc.opacity"
      />
    </g>
  </svg>
</template>
