import type { PairMode } from '@/bus/types'

/**
 * Faz 4 — Pair görseli, iki mod (ikisi de denenecek):
 * - `side`  : yan yana + orta-ön
 * - `orbit` : bloub `orbit` + hafif bağ
 *
 * Değişkenle geçiş: `setPairMode('orbit')` veya sohbetten `!pair orbit`.
 */
let mode: PairMode = 'side'

export function getPairMode(): PairMode {
  return mode
}

export function setPairMode(next: PairMode): void {
  mode = next
}

export function togglePairMode(): PairMode {
  mode = mode === 'side' ? 'orbit' : 'side'
  return mode
}
