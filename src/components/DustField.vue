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
  /** sn; burst parçacıklarında söner */
  life?: number
  decay?: number
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
  const next: P[] = []
  for (const p of parts) {
    if (p.life !== undefined) {
      p.life -= dt * (p.decay ?? 1)
      if (p.life <= 0) continue
      p.vx *= 0.98
      p.vy *= 0.98
      p.a *= 0.97
    }
    if (!reduce) {
      p.x += p.vx * dt * (0.35 + p.z)
      p.y += p.vy * dt * (0.35 + p.z)
      // yumuşak salınım
      if (p.life === undefined) p.x += Math.sin(t * 0.0003 + p.z * 10) * 0.05
      if (p.x < -8) p.x = w + 8
      if (p.x > w + 8) p.x = -8
      if (p.y < -8) p.y = h + 8
      if (p.y > h + 8) p.y = -8
    }
    const rr = p.r * (0.7 + p.z * 0.6)
    ctx.beginPath()
    ctx.fillStyle = p.hue
    ctx.globalAlpha = Math.min(1, p.a * (0.45 + p.z * 0.55))
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2)
    ctx.fill()
    next.push(p)
  }
  parts = next
  ctx.globalAlpha = 1
  raf = requestAnimationFrame(frame)
}

function burst(x: number, y: number, color: string) {
  if (reduce) return
  const n = 16
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4
    const sp = 40 + Math.random() * 90
    const z = 0.55 + Math.random() * 0.45
    parts.push({
      x,
      y,
      z,
      r: 1.2 + z * 2.4,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 20,
      a: 0.55 + z * 0.35,
      hue: color,
      life: 0.7 + Math.random() * 0.5,
      decay: 0.9 + Math.random() * 0.6
    })
  }
  // tavan: ambient + burst yükü
  if (parts.length > 220) parts.splice(0, parts.length - 200)
}

function onBurst(e: Event) {
  const d = (e as CustomEvent<{ x: number; y: number; color: string }>).detail
  if (d) burst(d.x, d.y, d.color ?? '#E8EDF7')
}

onMounted(() => {
  reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('dust:burst', onBurst)
  raf = requestAnimationFrame(frame)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('dust:burst', onBurst)
})
</script>

<template>
  <canvas ref="canvas" class="dust" aria-hidden="true" />
</template>
