import type { ExpressionId } from '@/bot/expressions'
import type { ColorId, ShapeId } from '@/bot/skins'
import type { StateId } from '@/bot/states'

export interface AgentDef {
  id: string
  name: string
  role: string
  shape: ShapeId
  color: ColorId
  expression: ExpressionId
  /** summon edildiğinde yakın durması gereken partnerler */
  partners: string[]
  /** canned cevap şablonları */
  replies: string[]
  /** boşta / düşünce state’leri */
  idleState: StateId
  thinkState: StateId
  arriveState: StateId
}

export const AGENTS: AgentDef[] = [
  {
    id: 'ARIA',
    name: 'ARIA',
    role: 'orkestrasyon',
    shape: 'cercle',
    color: 'bleu',
    expression: 'attentif',
    partners: ['PIXEL', 'SAGE'],
    replies: [
      'Buradayım. İşi parçalara bölüp ekibi toparlıyorum.',
      'Talebi aldım. BLITZ uygulamaya, SAGE araştırmaya geçebilir.',
      'Öncelik net: sen konuş, ben sıraya koyarım.'
    ],
    idleState: 'idle',
    thinkState: 'thinking',
    arriveState: 'exclaim'
  },
  {
    id: 'BLITZ',
    name: 'BLITZ',
    role: 'uygulama',
    shape: 'goutte',
    color: 'rouge',
    expression: 'excite',
    partners: ['HEX', 'ARIA'],
    replies: [
      'Hızlı çözerim. Ne kırmamız gerekiyor?',
      'Hazırım — adımı söyle, fırlayayım.',
      'İcra modu açık. Kısa yol, temiz sonuç.'
    ],
    idleState: 'idle',
    thinkState: 'swirl',
    arriveState: 'burst'
  },
  {
    id: 'SAGE',
    name: 'SAGE',
    role: 'araştırma',
    shape: 'galet',
    color: 'vert',
    expression: 'somnolent',
    partners: ['ECHO', 'ARIA'],
    replies: [
      'Kaynaklara bakıyorum… bir saniye, derinleşiyorum.',
      'Ağır ağır, doğru cevap. Ne merak ediyorsun?',
      'Notlarım hazır. Soruyu netleştirirsen dalarım.'
    ],
    idleState: 'idle',
    thinkState: 'sleep',
    arriveState: 'wide'
  },
  {
    id: 'NOVA',
    name: 'NOVA',
    role: 'yaratıcı',
    shape: 'squircle',
    color: 'violet',
    expression: 'surpris',
    partners: ['ORB', 'PIXEL'],
    replies: [
      'Yeni bir açı var sanki… deneyelim mi?',
      'Fikir uçuşuyor. Bana bir yön ver, patlatayım.',
      'Sıradan olanı eledim. Cesur olanı konuşalım.'
    ],
    idleState: 'idle',
    thinkState: 'orbit',
    arriveState: 'exclaim'
  },
  {
    id: 'ECHO',
    name: 'ECHO',
    role: 'iletişim',
    shape: 'capsule',
    color: 'turquoise',
    expression: 'curieux',
    partners: ['SAGE', 'ARIA'],
    replies: [
      'Duydum. Mesajı net ve sade geri veririm.',
      'Kim ne demişti? Özet geçeyim.',
      'Kanal açık. Kime ne ileteyim?'
    ],
    idleState: 'idle',
    thinkState: 'wink',
    arriveState: 'notify'
  },
  {
    id: 'HEX',
    name: 'HEX',
    role: 'güvenlik',
    shape: 'hexagone',
    color: 'ambre',
    expression: 'mefiant',
    partners: ['BLITZ', 'ORB'],
    replies: [
      'Bir kez daha bakayım. Risk sever değilim.',
      'Bu yol kapalı olabilir. Alternatif önereyim.',
      'Kontrol listesi hazır. Emin olmadan geçmem.'
    ],
    idleState: 'idle',
    thinkState: 'alert',
    arriveState: 'hexagon'
  },
  {
    id: 'PIXEL',
    name: 'PIXEL',
    role: 'tasarım',
    shape: 'nuage',
    color: 'rose',
    expression: 'heureux',
    partners: ['ARIA', 'NOVA'],
    replies: [
      'Formu yumuşatırım, ritmi de.',
      'Görsel dil ne olsun? Birlikte karar verelim.',
      'Bakması güzel, kullanması kolay olsun.'
    ],
    idleState: 'idle',
    thinkState: 'play',
    arriveState: 'wide'
  },
  {
    id: 'ORB',
    name: 'ORB',
    role: 'operasyon',
    shape: 'triangle',
    color: 'orange',
    expression: 'fier',
    partners: ['HEX', 'NOVA'],
    replies: [
      'Sistem ayakta. Sıradaki adım ne?',
      'Akışı izliyorum, tıkanma yok.',
      'Devreye giriyorum. Bırak işleyeyim.'
    ],
    idleState: 'idle',
    thinkState: 'comet',
    arriveState: 'play'
  }
]

export const AGENT_BY_ID = new Map(AGENTS.map((a) => [a.id, a]))

export function findAgent(token: string): AgentDef | undefined {
  return AGENT_BY_ID.get(token.trim().toUpperCase())
}

/** `/ARIA /PIXEL merhaba` → { ids: ['ARIA','PIXEL'], text: 'merhaba' } */
export function parseCommand(raw: string): { ids: string[]; text: string; unknown: string[] } {
  const ids: string[] = []
  const unknown: string[] = []
  const textParts: string[] = []
  for (const part of raw.trim().split(/\s+/)) {
    if (part.startsWith('/') && part.length > 1) {
      const key = part.slice(1).toUpperCase()
      const agent = AGENT_BY_ID.get(key)
      if (agent) {
        if (!ids.includes(agent.id)) ids.push(agent.id)
      } else {
        unknown.push(key)
      }
    } else if (part.length) {
      textParts.push(part)
    }
  }
  return { ids, text: textParts.join(' '), unknown }
}
