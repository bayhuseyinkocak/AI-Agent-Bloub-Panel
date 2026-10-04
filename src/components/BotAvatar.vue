<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, triggerRef, watch } from 'vue'
import { NOTIF_BLUE } from '@/bot/decor'
import { BotEngine, type BotFrame } from '@/bot/engine'
import { mixHex, COLOR_BY_ID, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID } from '@/bot/skins'
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from '@/bot/expressions'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import type { StateId } from '@/bot/states'

const props = withDefaults(
  defineProps<{
    size?: number | string
    shape?: string
    color?: string
    expression?: string
    paper?: string
    state?: StateId
  }>(),
  {
    size: 120,
    shape: DEFAULT_SHAPE,
    color: DEFAULT_COLOR,
    expression: DEFAULT_EXPRESSION,
    paper: '#070B14',
    state: 'idle' as StateId
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

function tick(now: number) {
  if (!last) last = now
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  clock += dt
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
