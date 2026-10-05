import { computed, shallowRef } from 'vue'
import { AGENTS, parseCommand, type AgentDef } from '@/agents'
import type { AgentPack } from '@/pack/types'
import { packToAgentDefs } from '@/pack/load'

/**
 * Aktif ajan kadrosu — UI’ın tek listesi.
 * Paket yüklenir (`applyPackRoster`); yoksa `AGENTS` fallback.
 */
const defsRef = shallowRef<AgentDef[]>([...AGENTS])
const mapRef = shallowRef(new Map<string, AgentDef>(AGENTS.map((a) => [a.id, a])))

export function getAgents(): AgentDef[] {
  return defsRef.value
}

export function getAgent(id: string): AgentDef | undefined {
  return mapRef.value.get(id.toUpperCase()) ?? mapRef.value.get(id)
}

export function getAgentMap(): Map<string, AgentDef> {
  return mapRef.value
}

export function applyRoster(defs: AgentDef[]): void {
  const next = defs.map((d) => ({ ...d, partners: [...d.partners], replies: [...d.replies] }))
  defsRef.value = next
  mapRef.value = new Map(next.map((a) => [a.id, a]))
}

export function applyPackRoster(pack: AgentPack): void {
  const defs = packToAgentDefs(pack)
  // boş paket UI’ı soğutmasın — fallback AGENTS
  applyRoster(defs.length ? defs : [...AGENTS])
}

export function resetRoster(): void {
  applyRoster([...AGENTS])
}

/** Vue computed için — liste değişimini izler. */
export function useRoster() {
  const agents = computed(() => defsRef.value)
  const byId = computed(() => mapRef.value)
  return { agents, byId }
}

export function parseRosterCommand(raw: string) {
  return parseCommand(raw, mapRef.value)
}
