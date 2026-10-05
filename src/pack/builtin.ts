import demoRaw from '@/packs/demo-avatars.json'
import tiresRaw from '@/packs/tires-master-data.json'
import { parseAgentPack } from './load'
import type { AgentPack } from './types'

function loadBuiltin(raw: unknown, fallbackId: string, fallbackName: string): AgentPack {
  const result = parseAgentPack(raw)
  if (result.ok) return result.pack
  console.error(`[pack] ${fallbackId} hatalı:`, result.errors)
  return {
    id: fallbackId,
    name: fallbackName,
    transport: 'local',
    url: null,
    rules: { handoff: 'any', pairMode: 'side' },
    agents: []
  }
}

export const DEMO_PACK: AgentPack = loadBuiltin(
  demoRaw,
  'demo-avatars',
  'Demo AI Agent Avatars'
)

export const TIRES_PACK: AgentPack = loadBuiltin(
  tiresRaw,
  'tires-master-data',
  'Tires Master Data'
)

/** Gömülü paketler — ayarlarda listede görünür. */
export const BUILTIN_PACKS: AgentPack[] = [DEMO_PACK, TIRES_PACK]
