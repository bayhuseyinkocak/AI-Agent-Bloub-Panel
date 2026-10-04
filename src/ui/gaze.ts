import type { Look } from '@/bot/engine'
import { clamp, easings } from '@/bot/math'

/** Bakış açısı limitleri (derece). */
export const YAW_MAX = 16
export const PITCH_MAX = 13
export const PITCH = 10
/** Chat’e dönüş için baş rulosu. */
export const TURN = 18
export const SPIN = 360
export const TURN_TIME = 1.1

export interface Aim {
  /** hedefin bottan normalize farkı, -1..1 (sağ pozitif) */
  nx: number
  /** -1..1, ekran yönü (aşağı pozitif) */
  ny: number
  /** 0..1 hedefe kilitlenme */
  tour: number
  pointer: boolean
}

/** Hedefe bakış Look’u. `mix` yükseldikçe devralır. */
export function lookTarget({ nx, ny, tour, pointer }: Aim): Look {
  return {
    yaw: -TURN + nx * YAW_MAX,
    pitch: PITCH - ny * PITCH_MAX,
    mix: tour,
    spin: SPIN * (1 - tour),
    wander: pointer ? 0 : 1
  }
}

export function tourEase(elapsed: number): number {
  return easings.easeOutQuint(clamp(elapsed / TURN_TIME))
}
