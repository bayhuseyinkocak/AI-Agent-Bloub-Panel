import type { AgentDef } from '@/agents'
import type { AgentPack, PackParseResult, PackRules } from './types'

const DEFAULT_RULES: PackRules = { handoff: 'any', pairMode: 'side' }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/**
 * Paket doğrulama — tek seam. Hataları liste olarak döner; UI çökmez.
 */
export function parseAgentPack(input: unknown): PackParseResult {
  const errors: string[] = []
  if (!isRecord(input)) {
    return { ok: false, errors: ['paket bir JSON nesnesi olmalı'] }
  }

  const id = typeof input.id === 'string' && input.id ? input.id : null
  if (!id) errors.push('id gerekli')
  const name = typeof input.name === 'string' && input.name ? input.name : null
  if (!name) errors.push('name gerekli')

  const transport = input.transport === 'local' || input.transport === 'ws' ? input.transport : null
  if (!transport) errors.push("transport 'local' veya 'ws' olmalı")

  let url: string | null = null
  if (input.url != null) {
    if (typeof input.url === 'string') url = input.url
    else errors.push('url string veya null olmalı')
  }
  if (transport === 'ws' && !url) errors.push("transport 'ws' için url gerekli")

  const rulesIn = isRecord(input.rules) ? input.rules : {}
  const handoff = rulesIn.handoff === 'none' ? 'none' : rulesIn.handoff === 'any' ? 'any' : null
  if (rulesIn.handoff != null && !handoff) errors.push("rules.handoff 'any' veya 'none'")
  const pairMode =
    rulesIn.pairMode === 'orbit' ? 'orbit' : rulesIn.pairMode === 'side' ? 'side' : null
  if (rulesIn.pairMode != null && !pairMode) errors.push("rules.pairMode 'side' veya 'orbit'")
  const rules: PackRules = {
    handoff: handoff ?? DEFAULT_RULES.handoff,
    pairMode: pairMode ?? DEFAULT_RULES.pairMode
  }

  const agents: AgentPack['agents'] = []
  const rawAgents = input.agents
  if (!Array.isArray(rawAgents) || rawAgents.length === 0) {
    errors.push('agents boş olamaz')
  } else {
    const seen = new Set<string>()
    rawAgents.forEach((raw, i) => {
      const at = `agents[${i}]`
      if (!isRecord(raw)) {
        errors.push(`${at} nesne olmalı`)
        return
      }
      const agentId = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : null
      if (!agentId) {
        errors.push(`${at}.id gerekli`)
        return
      }
      if (seen.has(agentId)) {
        errors.push(`${at}.id tekrar: ${agentId}`)
        return
      }
      seen.add(agentId)

      const requiredStr = (key: string): string | null => {
        const v = raw[key]
        if (typeof v === 'string' && v) return v
        errors.push(`${at}.${key} gerekli`)
        return null
      }

      const aName = requiredStr('name')
      const aRole = requiredStr('role')
      const shape = requiredStr('shape')
      const color = requiredStr('color')
      const expression = requiredStr('expression')
      const idleState = requiredStr('idleState')
      const thinkState = requiredStr('thinkState')
      const arriveState = requiredStr('arriveState')

      const partners = isStringArray(raw.partners) ? raw.partners : null
      if (!partners) errors.push(`${at}.partners string[] olmalı`)
      const replies = isStringArray(raw.replies) ? raw.replies : null
      if (!replies) errors.push(`${at}.replies string[] olmalı`)

      if (
        aName &&
        aRole &&
        shape &&
        color &&
        expression &&
        idleState &&
        thinkState &&
        arriveState &&
        partners &&
        replies
      ) {
        const llmIn = isRecord(raw.llm) ? raw.llm : undefined
        const persona = typeof raw.persona === 'string' ? raw.persona : undefined
        agents.push({
          id: agentId,
          name: aName,
          role: aRole,
          shape: shape as AgentPack['agents'][number]['shape'],
          color: color as AgentPack['agents'][number]['color'],
          expression: expression as AgentPack['agents'][number]['expression'],
          partners,
          replies,
          idleState: idleState as AgentPack['agents'][number]['idleState'],
          thinkState: thinkState as AgentPack['agents'][number]['thinkState'],
          arriveState: arriveState as AgentPack['agents'][number]['arriveState'],
          ...(persona ? { persona } : {}),
          ...(llmIn
            ? {
                llm: {
                  baseUrl: typeof llmIn.baseUrl === 'string' ? llmIn.baseUrl : undefined,
                  model: typeof llmIn.model === 'string' ? llmIn.model : undefined,
                  apiKeyEnv: typeof llmIn.apiKeyEnv === 'string' ? llmIn.apiKeyEnv : undefined
                }
              }
            : {})
        })
      }
    })
  }

  if (errors.length) return { ok: false, errors }

  const packLlmIn = isRecord(input.llm) ? input.llm : undefined

  return {
    ok: true,
    pack: {
      id: id!,
      name: name!,
      transport: transport!,
      url,
      rules,
      agents,
      ...(packLlmIn
        ? {
            llm: {
              baseUrl: typeof packLlmIn.baseUrl === 'string' ? packLlmIn.baseUrl : undefined,
              model: typeof packLlmIn.model === 'string' ? packLlmIn.model : undefined,
              apiKeyEnv:
                typeof packLlmIn.apiKeyEnv === 'string' ? packLlmIn.apiKeyEnv : undefined
            }
          }
        : {})
    }
  }
}

/** Pack → sahne/chat roster’ı. */
export function packToAgentDefs(pack: AgentPack): AgentDef[] {
  return pack.agents.map((a) => ({ ...a }))
}
