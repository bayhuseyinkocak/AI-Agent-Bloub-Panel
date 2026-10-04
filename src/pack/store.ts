import { DEMO_PACK } from './builtin'
import { parseAgentPack } from './load'
import type { AgentPack } from './types'

const KEY_ACTIVE = 'agent-panel.pack.activeId'
const KEY_CUSTOM = 'agent-panel.pack.custom'

export interface PackSummary {
  id: string
  name: string
  builtin: boolean
  transport: AgentPack['transport']
}

function readCustom(): Record<string, AgentPack> {
  try {
    const raw = localStorage.getItem(KEY_CUSTOM)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return parsed as Record<string, AgentPack>
  } catch {
    return {}
  }
}

function writeCustom(map: Record<string, AgentPack>): void {
  localStorage.setItem(KEY_CUSTOM, JSON.stringify(map))
}

/** Küçük liste yüzeyi — ayarlar UI için. */
export function listPacks(): PackSummary[] {
  const out: PackSummary[] = [
    {
      id: DEMO_PACK.id,
      name: DEMO_PACK.name,
      builtin: true,
      transport: DEMO_PACK.transport
    }
  ]
  for (const pack of Object.values(readCustom())) {
    if (pack.id === DEMO_PACK.id) continue
    out.push({
      id: pack.id,
      name: pack.name,
      builtin: false,
      transport: pack.transport
    })
  }
  return out
}

export function getPack(id: string): AgentPack | null {
  if (id === DEMO_PACK.id) return DEMO_PACK
  return readCustom()[id] ?? null
}

export function getActivePackId(): string {
  return localStorage.getItem(KEY_ACTIVE) || DEMO_PACK.id
}

export function setActivePackId(id: string): void {
  localStorage.setItem(KEY_ACTIVE, id)
}

/** Aktif paket; bozuksa demo’ya düşer — UI çökmez. */
export function loadActivePack(): AgentPack {
  const id = getActivePackId()
  const pack = getPack(id)
  if (pack) return pack
  return DEMO_PACK
}

/** JSON metni → doğrula + custom’a yaz. Hata listesi döner. */
export function savePackJson(text: string): { ok: boolean; errors: string[]; pack?: AgentPack } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`JSON parse: ${(e as Error).message}`] }
  }
  const result = parseAgentPack(data)
  if (!result.ok) return { ok: false, errors: result.errors }

  const custom = readCustom()
  custom[result.pack.id] = result.pack
  writeCustom(custom)
  setActivePackId(result.pack.id)
  return { ok: true, errors: [], pack: result.pack }
}

export function exportPackText(pack: AgentPack): string {
  return JSON.stringify(pack, null, 2)
}

export function packToText(pack: AgentPack): string {
  return exportPackText(pack)
}
