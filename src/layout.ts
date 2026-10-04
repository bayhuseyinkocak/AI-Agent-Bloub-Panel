export type Role = 'focus' | 'ally' | 'companion' | 'outer'

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
  seed?: number
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

/**
 * Summon koreografisi:
 * - focus → sahnenin ortası (chat üstü), büyük
 * - ally  → focus’un yanı, orta
 * - companion → partner halkası, orta-küçük
 * - outer → uzak köşeler, küçük
 */
export function assignSlots(input: LayoutInput): Map<string, Slot> {
  const { ids, focusId, allyIds, companionIds } = input
  const slots = new Map<string, Slot>()
  const outer: string[] = []
  let allyI = 0
  let compI = 0
  let cornerI = 0

  // summon yoksa: yumuşak dağılım (herkes outer-ring ama daha dolu)
  const peacetime = !focusId

  for (const id of ids) {
    const jx = hash01(id, 3) * 4 - 2
    const jy = hash01(id, 7) * 4 - 2

    if (id === focusId) {
      slots.set(id, {
        x: 50 + jx * 0.3,
        y: 78 + jy * 0.2,
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

  outer.forEach((id, i) => {
    const base = CORNERS[(i + cornerI) % CORNERS.length]!
    const jx = hash01(id, 11) * 3 - 1.5
    const jy = hash01(id, 13) * 3 - 1.5
    // barış zamanı biraz daha içeri, summon anında köşelere
    const pull = peacetime ? 6 : 0
    const towardCenterX = (50 - base.x) * 0.08 * (peacetime ? 1.6 : 0)
    const towardCenterY = (45 - base.y) * 0.08 * (peacetime ? 1.6 : 0)
    slots.set(id, {
      x: base.x + jx + pull * Math.sign(50 - base.x) * 0.15 + towardCenterX,
      y: base.y + jy + pull * Math.sign(45 - base.y) * 0.1 + towardCenterY,
      scale: peacetime ? 0.48 : 0.3,
      z: 5,
      opacity: peacetime ? 0.72 : 0.45,
      z3d: peacetime ? -80 : -180
    })
  })

  return slots
}

export function roleOf(
  id: string,
  focusId: string | null,
  allyIds: string[],
  companionIds: string[]
): Role {
  if (id === focusId) return 'focus'
  if (allyIds.includes(id)) return 'ally'
  if (companionIds.includes(id)) return 'companion'
  return 'outer'
}
