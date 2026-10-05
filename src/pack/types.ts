import type { ExpressionId } from '@/bot/expressions'
import type { ColorId, ShapeId } from '@/bot/skins'
import type { StateId } from '@/bot/states'
import type { PairMode } from '@/bus'

export type PackTransport = 'local' | 'ws'

/** OpenAI-uyumlu LLM. Yoksa bridge merkezi LLM’e düşer. */
export interface PackLlm {
  baseUrl?: string
  model?: string
  /** env adı — API anahtarı pack’te durmaz */
  apiKeyEnv?: string
}

export interface PackRules {
  /** `any` = herkes herkese handoff (isimler bağlayıcı değil) */
  handoff: 'any' | 'none'
  pairMode: PairMode
}

export interface PackAgent {
  id: string
  name: string
  role: string
  shape: ShapeId
  color: ColorId
  expression: ExpressionId
  partners: string[]
  replies: string[]
  idleState: StateId
  thinkState: StateId
  arriveState: StateId
  /** ajan bazlı LLM; boşsa merkezi */
  llm?: PackLlm
  /** konuşma personası (sistem promptu özeti) */
  persona?: string
}

/**
 * Ajan grubu paketi — UI’nın tek bağlamı.
 * Farklı backend = farklı paket; `AgentBus` + bu paket yeterlidir.
 */
export interface AgentPack {
  id: string
  name: string
  transport: PackTransport
  /** `ws` ise uç nokta; `local` iken null */
  url: string | null
  rules: PackRules
  agents: PackAgent[]
  /** paket seviyesi / merkezi LLM fallback */
  llm?: PackLlm
}

export type PackParseResult =
  | { ok: true; pack: AgentPack }
  | { ok: false; errors: string[] }
