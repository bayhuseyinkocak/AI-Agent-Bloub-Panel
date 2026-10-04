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

const ALLY_FLANK: Array<{ x: number; y: number }> = [
  { x: 34, y: 42 },
  { x: 66, y: 42 },
  { x: 30, y: 54 },
  { x: 70, y: 54 }
]

/** Seçili bekleyiş: merkez + chat’e doğru biraz alçak. */
function waitSlot(index: number, count: number): Slot {
  if (count === 1) {
    return { x: 50, y: 62, scale: 1.7, z: 28, opacity: 1, z3d: 110 }
  }
  if (count === 2) {
    return index === 0
      ? { x: 36, y: 58, scale: 1.48, z: 26, opacity: 1, z3d: 95 }
      : { x: 64, y: 58, scale: 1.48, z: 26, opacity: 1, z3d: 95 }
  }
  if (count === 3) {
    const xs = [28, 50, 72]
    return { x: xs[index]!, y: 56, scale: 1.3, z: 24, opacity: 1, z3d: 82 }
  }
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return {
    x: 50 + Math.cos(angle) * 20,
    y: 54 + Math.sin(angle) * 10,
    scale: 1.18,
    z: 24,
    opacity: 1,
    z3d: 75
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
 * Kademeli yaklaşım:
 * - selected → bekleme yuvası (merkez, chat’e yakın)
 * - filterPull 0–1 → köşeden merkeze doğru (yazdıkça artar)
 * - canlı modda diğerleri uzaklaşır
 * - canlı değilse focus/ally/pair klasik summon
 */
export function assignSlots(input: LayoutInput): Map<string, Slot> {
  const { ids, focusId, allyIds, companionIds, pair } = input
  const selectedIds = input.selectedIds ?? []
  const filterPulls = input.filterPulls ?? {}
  const live = selectedIds.length > 0 || Object.keys(filterPulls).length > 0

  const slots = new Map<string, Slot>()
  const outer: string[] = []
  let allyI = 0
  let compI = 0
  let outerI = 0

  // 1) kesin seçim — bekleme
  selectedIds.forEach((id, i) => {
    slots.set(id, waitSlot(i, selectedIds.length))
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

  // 4) commit edilmiş summon — focus / ally / pair / companion
  const peacetime = !focusId

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
        z: base.z,
        opacity: 1,
        z3d: base.z3d
      })
    })
  }

  for (const id of ids) {
    const jx = hash01(id, 3) * 4 - 2
    const jy = hash01(id, 7) * 4 - 2

    if (slots.has(id)) continue

    if (id === focusId) {
      slots.set(id, {
        x: 50 + jx * 0.3,
        y: 68 + jy * 0.2,
        scale: 2.15,
        z: 30,
        opacity: 1,
        z3d: 160
      })
      continue
    }

    if (allyIds.includes(id)) {
      const base = ALLY_FLANK[allyI % ALLY_FLANK.length]!
      allyI++
      slots.set(id, {
        x: base.x + jx,
        y: base.y + jy,
        scale: 0.72,
        z: 20,
        opacity: 0.95,
        z3d: 48
      })
      continue
    }

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
  filterPulls?: Record<string, number>
): Role {
  if (selectedIds?.includes(id)) return 'wait'
  if ((filterPulls?.[id] ?? 0) > 0) return 'probe'
  if (pair && (id === pair.a || id === pair.b)) return 'pair'
  if (id === focusId) return 'focus'
  if (allyIds.includes(id)) return 'ally'
  if (companionIds.includes(id)) return 'companion'
  return 'outer'
}
