import type { Look } from '@/bot/engine'
import { clamp, easings } from '@/bot/math'

/**
 * Bakış yumuşak: ani kilitlenme yerine yavaş tur + küçük açı.
 * Oyun/character feel: hedefe bakar ama biraz canlı kalsın (hafif wander).
 *
 * `spin` BİLMİÇLİ olarak 0: 360° yolculuk bloub’un “geliş” animasyonu içindi.
 * Burada bakış chat ↔ kamera arasında salınıyor; spin gözleri kürenin arkasından
 * dolaştırıp kaybediyor (“gözler yok oluyor” bug’ı).
 */
export const YAW_MAX = 11
export const PITCH_MAX = 9
export const PITCH = 8
/** Chat’e dönüş için baş rulosu — abartısız. */
export const TURN = 12
export const TURN_TIME = 1.25

export interface Aim {
  /** hedefin bottan normalize farkı, -1..1 (sağ pozitif) */
  nx: number
  /** -1..1, ekran yönü (aşağı pozitif) */
  ny: number
  /** 0..1 hedefe kilitlenme */
  tour: number
  pointer: boolean
  /** ek aşağı bakış (derece) — odak avatar chat’e eğilsin */
  down?: number
  /** ny çarpanı — yakın hedefte yön farkını büyüt */
  nyBoost?: number
}

/** Hedefe bakış Look’u. `mix` yükseldikçe devralır. */
export function lookTarget({ nx, ny, tour, pointer, down = 0, nyBoost = 1 }: Aim): Look {
  const y = ny * nyBoost
  return {
    yaw: -TURN + nx * YAW_MAX,
    // aşağı bakan hedef: pitch düşer (effraye benzeri bakış)
    pitch: PITCH - y * PITCH_MAX - down,
    mix: tour,
    spin: 0,
    // hafif wander: sabitlemesin, “dinliyorum” hissi versin
    wander: pointer ? 0.38 : 1
  }
}

/**
 * Karsiya / kameraya bakış (Attentive–Surprised hattı).
 * Chat’ten çıkınca yüz ekrana döner: düz bakış, hafif canlılık.
 * `soft` yan avatarlar için daha yumuşak kilit. Spin yok — gözler hep önde.
 */
export function lookFront(tour: number, soft = false): Look {
  return {
    yaw: soft ? 2 : 0,
    pitch: soft ? 1 : 2,
    mix: tour * (soft ? 0.72 : 1),
    spin: 0,
    wander: soft ? 0.7 : 0.5
  }
}

export function tourEase(elapsed: number): number {
  return easings.easeOutQuint(clamp(elapsed / TURN_TIME))
}
