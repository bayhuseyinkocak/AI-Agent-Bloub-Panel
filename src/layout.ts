import type { PairMode } from '@/bus/types'

export type Role = 'focus' | 'ally' | 'companion' | 'outer' | 'pair' | 'wait' | 'probe'

export interface PairBinding {
  a: string
  b: string
  mode: PairMode
}

export interface Slot {
  /** stage yüzdesi, sol üst orijin */
  x: number
  y: number
  /** görsel ölçek */
  scale: number
  z: number
  opacity: number
  /** perspektif derinliği (px) — yüksek = ekrana / chat’e yakın */
  z3d: number
}

export interface LayoutInput {
  ids: string[]
  focusId: string | null
  allyIds: string[]
  companionIds: string[]
  /** aktif pair — yan yana / orbit ortak slotlar */
  pair?: PairBinding | null
  /** Tab/Enter/tık ile kesinleşenler — merkezde bekler, send’de chat’e iner */
  selectedIds?: string[]
  /** filtre yakınlığı 0–1 (yazdıkça artar) */
  filterPulls?: Record<string, number>
  /** konuşan / işi alan — formasyonda ortaya geçer */
  spotlightId?: string | null
  seed?: number
}

/** side: yan yana + orta-ön. orbit: biraz açık, bağ + orbit state. */
const PAIR_SIDE = {
  y: 68,
  gap: 13,
  scale: 1.55,
  z: 28,
  z3d: 140
}

const PAIR_ORBIT = {
  y: 60,
  gap: 20,
  scale: 1.35,
  z: 28,
  z3d: 110
}

/** Tam ad yazılmış ama henüz seçilmemiş — ekranın ortası. */
const PROBE_CENTER = { x: 50, y: 48, scale: 1.55, z: 26, z3d: 88 }

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpSlot(base: Slot, target: Omit<Slot, 'opacity'>, pull: number, opacityBoost = 0): Slot {
  const t = Math.max(0, Math.min(1, pull))
  return {
    x: lerp(base.x, target.x, t),
    y: lerp(base.y, target.y, t),
    scale: lerp(base.scale, target.scale, t),
    z: base.z,
    opacity: Math.min(1, lerp(base.opacity, 1, t) + opacityBoost),
    z3d: lerp(base.z3d, target.z3d, t)
  }
}

/** Deterministik küçük gürültü — her agent için sabit ofset. */
function hash01(seed: string, salt: number): number {
  let h = salt * 17
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return ((h >>> 0) % 1000) / 1000
}

const CORNERS: Array<{ x: number; y: number }> = [
  { x: 10, y: 12 },
  { x: 88, y: 14 },
  { x: 8, y: 48 },
  { x: 92, y: 52 },
  { x: 14, y: 78 },
  { x: 86, y: 76 },
  { x: 48, y: 10 },
  { x: 52, y: 82 }
]

const COMPANION_RING: Array<{ x: number; y: number }> = [
  { x: 28, y: 30 },
  { x: 72, y: 32 },
  { x: 24, y: 58 },
  { x: 76, y: 60 },
  { x: 38, y: 22 },
  { x: 64, y: 70 }
]

/**
 * Kadro dizilimi — index 0 ortada ve en önde (yüksek z-index).
 * Sonrakiler sağ/sol dönüşümlü kanatlara yayılır (V formasyonu).
 * 1: orta · 2: yan yana · 3+: V · 5+: ikinci sıra kanat
 */
function frontSlot(index: number, count: number): Slot {
  if (count <= 1) {
    return { x: 50, y: 64, scale: 1.85, z: 34, opacity: 1, z3d: 165 }
  }
  if (count === 2) {
    // ikili — chat yanı; lead (0) net daha önde / yüksek z
    return index === 0
      ? { x: 37, y: 58, scale: 1.55, z: 32, opacity: 1, z3d: 125 }
      : { x: 64, y: 58, scale: 1.46, z: 26, opacity: 1, z3d: 95 }
  }
  if (index === 0) {
    return { x: 50, y: 62, scale: 1.82, z: 36, opacity: 1, z3d: 170 }
  }
  // 1 sağ, 2 sol, 3 sağ-uzak, 4 sol-uzak…
  const side = index % 2 === 1 ? 1 : -1
  const rank = Math.ceil(index / 2)
  const spread = 13 + (rank - 1) * 12
  return {
    x: 50 + side * spread,
    y: 58 - (rank - 1) * 5,
    scale: Math.max(0.95, 1.42 - (rank - 1) * 0.14),
    z: 30 - (rank - 1) * 3,
    opacity: 1,
    z3d: 115 - (rank - 1) * 26
  }
}

function outerBase(id: string, softPull: boolean, cornerIndex: number): Slot {
  const base = CORNERS[cornerIndex % CORNERS.length]!
  const jx = hash01(id, 11) * 3 - 1.5
  const jy = hash01(id, 13) * 3 - 1.5
  // filtre anında bile biraz içeri; canlı seçimde köşeye itilir
  const pull = softPull ? 0 : 6
  const towardCenterX = softPull ? 0 : (50 - base.x) * 0.08 * 1.6
  const towardCenterY = softPull ? 0 : (45 - base.y) * 0.08 * 1.6
  return {
    x: base.x + jx + pull * Math.sign(50 - base.x) * 0.15 + towardCenterX,
    y: base.y + jy + pull * Math.sign(45 - base.y) * 0.1 + towardCenterY,
    scale: softPull ? 0.34 : 0.48,
    z: 5,
    opacity: softPull ? 0.5 : 0.72,
    z3d: softPull ? -140 : -80
  }
}

/**
 * Kadro sırası: spotlight (konuşan) en öne, sonra lead, sonra helper’lar.
 * İlk çağırılan / konuşan ortada durur.
 */
function orderSquad(
  ids: string[],
  focusId: string | null,
  allyIds: string[],
  spotlightId: string | null
): string[] {
  const inSquad = new Set<string>()
  if (focusId) inSquad.add(focusId)
  for (const id of allyIds) inSquad.add(id)
  if (spotlightId) inSquad.add(spotlightId)

  const base: string[] = []
  if (focusId && inSquad.has(focusId)) base.push(focusId)
  for (const id of allyIds) {
    if (inSquad.has(id) && !base.includes(id)) base.push(id)
  }
  if (spotlightId && inSquad.has(spotlightId) && !base.includes(spotlightId)) {
    base.push(spotlightId)
  }

  if (spotlightId && base.includes(spotlightId)) {
    return [spotlightId, ...base.filter((id) => id !== spotlightId)]
  }
  return base
}

/**
 * Kademeli yaklaşım:
 * - selected → kadro formasyonu (ilk seçili orta + yüksek z)
 * - filterPull 0–1 → köşeden merkeze doğru (yazdıkça artar)
 * - canlı modda diğerleri uzaklaşır
 * - commit: focus/ally kadro V’si, konuşan ortaya, pair istisna
 */
export function assignSlots(input: LayoutInput): Map<string, Slot> {
  const { ids, focusId, allyIds, companionIds, pair } = input
  const selectedIds = input.selectedIds ?? []
  const filterPulls = input.filterPulls ?? {}
  const spotlightId = input.spotlightId ?? null
  const live = selectedIds.length > 0 || Object.keys(filterPulls).length > 0

  const slots = new Map<string, Slot>()
  const outer: string[] = []
  let compI = 0
  let outerI = 0

  // 1) kesin seçim / bekleme — ilk gelen orta
  selectedIds.forEach((id, i) => {
    slots.set(id, frontSlot(i, selectedIds.length))
  })

  // 2) filtre yakınlığı — yazdıkça ortaya
  for (const id of ids) {
    if (slots.has(id)) continue
    const pull = filterPulls[id] ?? 0
    if (pull <= 0) continue
    const jx = hash01(id, 3) * 2 - 1
    const jy = hash01(id, 7) * 2 - 1
    const base = outerBase(id, true, outerI++)
    const target = {
      x: PROBE_CENTER.x + jx * 0.5,
      y: PROBE_CENTER.y + jy * 0.4,
      scale: PROBE_CENTER.scale,
      z: PROBE_CENTER.z,
      z3d: PROBE_CENTER.z3d
    }
    slots.set(id, lerpSlot(base, target, pull, 0.1))
  }

  if (live) {
    // 3) canlı seçim anında diğerleri uzak köşelere
    for (const id of ids) {
      if (slots.has(id)) continue
      slots.set(id, outerBase(id, true, outerI++))
    }
    return slots
  }

  // 4) commit edilmiş summon — kadro V’si (ilk + helper), pair istisna
  if (pair) {
    const base = pair.mode === 'orbit' ? PAIR_ORBIT : PAIR_SIDE
    const pairIds = [pair.a, pair.b]
    pairIds.forEach((id, i) => {
      const jx = hash01(id, 3) * 2 - 1
      const jy = hash01(id, 7) * 2 - 1
      const dir = i === 0 ? -1 : 1
      slots.set(id, {
        x: 50 + dir * base.gap + jx * 0.4,
        y: base.y + jy * 0.3,
        scale: base.scale,
        z: base.z + (i === 0 ? 4 : 0),
        opacity: 1,
        z3d: base.z3d + (i === 0 ? 20 : 0)
      })
    })
  }

  // asıl kadro: lead + helper’lar (+ spotlight) — V formasyonu
  const squad = orderSquad(ids, focusId, allyIds, spotlightId)
  squad.forEach((id, i) => {
    if (slots.has(id)) return
    slots.set(id, frontSlot(i, squad.length))
  })

  for (const id of ids) {
    const jx = hash01(id, 3) * 4 - 2
    const jy = hash01(id, 7) * 4 - 2

    if (slots.has(id)) continue

    if (companionIds.includes(id)) {
      const base = COMPANION_RING[compI % COMPANION_RING.length]!
      compI++
      slots.set(id, {
        x: base.x + jx,
        y: base.y + jy,
        scale: 0.52,
        z: 10,
        opacity: 0.82,
        z3d: 0
      })
      continue
    }

    outer.push(id)
  }

  outer.forEach((id) => {
    slots.set(id, outerBase(id, false, outerI++))
  })

  return slots
}

export function roleOf(
  id: string,
  focusId: string | null,
  allyIds: string[],
  companionIds: string[],
  pair?: PairBinding | null,
  selectedIds?: string[],
  filterPulls?: Record<string, number>,
  spotlightId?: string | null
): Role {
  if (selectedIds?.includes(id)) return 'wait'
  if ((filterPulls?.[id] ?? 0) > 0) return 'probe'
  if (pair && (id === pair.a || id === pair.b)) return 'pair'
  if (id === spotlightId) return 'focus'
  if (id === focusId) return 'focus'
  if (allyIds.includes(id)) return 'ally'
  if (companionIds.includes(id)) return 'companion'
  return 'outer'
}
