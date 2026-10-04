<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Zemin tozu: yavaş yüzen parçacıklar. Derinlik (z) ile boyut/parallax/alfa
 * değişir — avatar sahnesine atmosfer katar, etkileşmez.
 */
interface P {
  x: number
  y: number
  z: number
  r: number
  vx: number
  vy: number
  a: number
  hue: string
}

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let parts: P[] = []
let w = 0
let h = 0
let reduce = false
let dpr = 1

const COLORS = ['#5B8CFF', '#8B5CF6', '#E8EDF7', '#2FBFA0', '#6B7A99']

function spawn(n: number) {
  parts = Array.from({ length: n }, () => {
    const z = Math.random()
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      z,
      r: 0.6 + z * 2.2,
      vx: (Math.random() - 0.5) * (8 + z * 14),
      vy: (Math.random() - 0.5) * (5 + z * 10) - 2 - z * 4,
      a: 0.15 + z * 0.45,
      hue: COLORS[(Math.random() * COLORS.length) | 0]!
    }
  })
}

function resize() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  w = window.innerWidth
  h = window.innerHeight
  c.width = Math.floor(w * dpr)
  c.height = Math.floor(h * dpr)
  c.style.width = `${w}px`
  c.style.height = `${h}px`
  const ctx = c.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (!parts.length) spawn(w < 700 ? 48 : 78)
}

function frame(t: number) {
  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  ctx.clearRect(0, 0, w, h)
  const dt = 1 / 60
  for (const p of parts) {
    if (!reduce) {
      p.x += p.vx * dt * (0.35 + p.z)
      p.y += p.vy * dt * (0.35 + p.z)
      // yumuşak salınım
      p.x += Math.sin(t * 0.0003 + p.z * 10) * 0.05
      if (p.x < -8) p.x = w + 8
      if (p.x > w + 8) p.x = -8
      if (p.y < -8) p.y = h + 8
      if (p.y > h + 8) p.y = -8
    }
    const rr = p.r * (0.7 + p.z * 0.6)
    ctx.beginPath()
    ctx.fillStyle = p.hue
    ctx.globalAlpha = p.a * (0.45 + p.z * 0.55)
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(frame)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvas" class="dust" aria-hidden="true" />
</template>
