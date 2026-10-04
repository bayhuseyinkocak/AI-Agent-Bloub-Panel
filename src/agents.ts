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

/**
 * İsimler kasıtlı olarak yakın önekli (AR* / BL* / SA* / NO*)
 * — filtre ve seçim akışını test etmek için.
 */
export const AGENTS: AgentDef[] = [
  {
    id: 'ARIA',
    name: 'ARIA',
    role: 'orkestrasyon',
    shape: 'cercle',
    color: 'bleu',
    expression: 'attentif',
    partners: ['ARIS', 'SAGE'],
    replies: [
      'Buradayım. İşi parçalara bölüp ekibi toparlıyorum.',
      'Talebi aldım. BLITZ uygulamaya, ARIS analize geçebilir.',
      'Öncelik net: sen konuş, ben sıraya koyarım.'
    ],
    idleState: 'idle',
    thinkState: 'thinking',
    arriveState: 'exclaim'
  },
  {
    id: 'ARIS',
    name: 'ARIS',
    role: 'analiz',
    shape: 'galet',
    color: 'vert',
    expression: 'curieux',
    partners: ['ARIA', 'SARI'],
    replies: [
      'Veriyi bölüyorum. Örüntü varsa çıkarırım.',
      'Karşılaştırdım — kaynaklar tutarlı, ama bir boşluk var.',
      'Analiz açık. Hangi soruya odaklanayım?'
    ],
    idleState: 'idle',
    thinkState: 'thinking',
    arriveState: 'wide'
  },
  {
    id: 'BLITZ',
    name: 'BLITZ',
    role: 'uygulama',
    shape: 'goutte',
    color: 'rouge',
    expression: 'excite',
    partners: ['BLIX', 'ARIA'],
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
    id: 'BLIX',
    name: 'BLIX',
    role: 'hata ayıklama',
    shape: 'hexagone',
    color: 'ambre',
    expression: 'mefiant',
    partners: ['BLITZ', 'ARIS'],
    replies: [
      'İzi sürüyorum. Kırık nokta bende.',
      'Yeniden ürettim. Şimdi nedenini söylüyorum.',
      'Düzeltme hazır; önce güvenlik kontrolü.'
    ],
    idleState: 'idle',
    thinkState: 'alert',
    arriveState: 'hexagon'
  },
  {
    id: 'SAGE',
    name: 'SAGE',
    role: 'araştırma',
    shape: 'squircle',
    color: 'violet',
    expression: 'somnolent',
    partners: ['SARI', 'ARIA'],
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
    id: 'SARI',
    name: 'SARI',
    role: 'doğrulama',
    shape: 'capsule',
    color: 'turquoise',
    expression: 'fier',
    partners: ['SAGE', 'BLIX'],
    replies: [
      'Kontrol ettim. Onaylıyorum ya da düzeltiyorum.',
      'Şu kısım sağlam, şu kısım riskli.',
      'Doğrulama bitti. İmzalıyorum.'
    ],
    idleState: 'idle',
    thinkState: 'wink',
    arriveState: 'notify'
  },
  {
    id: 'NOVA',
    name: 'NOVA',
    role: 'yaratıcı',
    shape: 'nuage',
    color: 'rose',
    expression: 'surpris',
    partners: ['NORA', 'ARIS'],
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
    id: 'NORA',
    name: 'NORA',
    role: 'tasarım',
    shape: 'triangle',
    color: 'orange',
    expression: 'heureux',
    partners: ['NOVA', 'BLITZ'],
    replies: [
      'Formu yumuşatırım, ritmi de.',
      'Görsel dil ne olsun? Birlikte karar verelim.',
      'Bakması güzel, kullanması kolay olsun.'
    ],
    idleState: 'idle',
    thinkState: 'play',
    arriveState: 'play'
  }
]

export const AGENT_BY_ID = new Map(AGENTS.map((a) => [a.id, a]))

export function findAgent(token: string): AgentDef | undefined {
  return AGENT_BY_ID.get(token.trim().toUpperCase())
}

/** `/ARIA /ARIS merhaba` → { ids: ['ARIA','ARIS'], text: 'merhaba' } */
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
