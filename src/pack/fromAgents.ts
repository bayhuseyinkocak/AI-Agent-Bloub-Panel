import type { AgentDef } from '@/agents'
import type { AgentPack, PackRules } from './types'

/**
 * Mevcut `AGENTS` → demo paket (fallback üretici).
 * Paket dosyası yoksa UI aynı roster ile devam eder.
 */
export function agentsToDemoPack(
  agents: AgentDef[],
  options?: { id?: string; name?: string; rules?: Partial<PackRules> }
): AgentPack {
  return {
    id: options?.id ?? 'demo-avatars',
    name: options?.name ?? 'Demo AI Agent Avatars',
    transport: 'local',
    url: null,
    rules: {
      handoff: options?.rules?.handoff ?? 'any',
      pairMode: options?.rules?.pairMode ?? 'side'
    },
    agents: agents.map((a) => ({ ...a, partners: [...a.partners], replies: [...a.replies] }))
  }
}
