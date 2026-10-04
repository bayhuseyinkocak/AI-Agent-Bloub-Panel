import demoRaw from '@/packs/demo-avatars.json'
import { parseAgentPack } from './load'
import type { AgentPack } from './types'

/** Gömülü demo paketi — doğrulanmış; yüklenemezse uygulama çökmez. */
function loadDemo(): AgentPack {
  const result = parseAgentPack(demoRaw)
  if (result.ok) return result.pack
  // JSON statik; hata derleme/CI’da görünür. Yine de yumuşak düş.
  console.error('[pack] demo-avatars.json hatalı:', result.errors)
  return {
    id: 'demo-avatars',
    name: 'Demo AI Agent Avatars',
    transport: 'local',
    url: null,
    rules: { handoff: 'any', pairMode: 'side' },
    agents: []
  }
}

export const DEMO_PACK: AgentPack = loadDemo()
