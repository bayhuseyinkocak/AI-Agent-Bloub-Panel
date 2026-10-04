<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AGENTS, AGENT_BY_ID } from '@/agents'

export interface ChatMessage {
  id: number
  from: 'you' | 'agent' | 'system'
  agentId?: string
  text: string
  ts: number
}

const props = defineProps<{
  messages: ChatMessage[]
  pendingHint: string
}>()

const emit = defineEmits<{
  send: [text: string]
  /** kesin seçilmiş ajanlar (Tab/Enter/tık) — merkezde bekleme */
  preview: [ids: string[]]
  /** filtre pull 0–1 — yazdıkça ortaya yaklaşma */
  filter: [pulls: Record<string, number>]
  /** input odağı — avatarlar chat’e baksın */
  engage: [on: boolean]
}>()

const draft = ref('')
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const highlight = ref(0)
/** sadece Tab / Enter / tık ile eklenir — yazmak çağırmaz */
const selectedIds = ref<string[]>([])

/** Taslakta tam `/ID` token’ı var mı (bitişik yazmak seçmez, sadece filtre dışlar). */
function hasToken(raw: string, id: string): boolean {
  return new RegExp(`(?:^|\\s)\\/${id}(?=\\s|$)`, 'i').test(raw)
}

/** Kesin seçim ∩ taslakta hâlâ duran mention. */
function liveSelected(): string[] {
  return selectedIds.value.filter((id) => hasToken(draft.value, id))
}

/** Son `/partial` — filtre listesi + kademeli pull. */
const filterQuery = computed(() => {
  const m = draft.value.match(/\/([a-zA-Z]*)$/)
  return m ? (m[1] ?? '').toUpperCase() : null
})

const suggestions = computed(() => {
  const q = filterQuery.value
  if (q === null) return []
  const taken = new Set(liveSelected())
  return AGENTS.filter((a) => a.id.startsWith(q) && !taken.has(a.id)).slice(0, 8)
})

/**
 * Pull = ne kadar özgül eşleşme. `/A` → 0.3, `/AR` → 0.45, `/ARIA` (tam) → 1.
 * Tam ad yazılmış ama seçilmemiş olan ortada; sadece önek tutan geri çekilir.
 */
function computePulls(query: string | null, selected: string[]): Record<string, number> {
  const pulls: Record<string, number> = {}
  if (!query || query.length < 1) return pulls
  for (const a of AGENTS) {
    if (selected.includes(a.id)) continue
    if (!a.id.startsWith(query)) continue
    const specific = query.length / a.id.length
    const exact = query === a.id ? 1 : 0
    const pull = Math.min(1, 0.18 + specific * 0.5 + exact * 0.4)
    pulls[a.id] = pull
  }
  return pulls
}

watch(suggestions, () => {
  highlight.value = 0
})

function emitState() {
  const selected = liveSelected()
  emit('preview', selected)
  emit('filter', computePulls(filterQuery.value, selected))
}

watch(draft, () => {
  emitState()
})

function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement).value
}

/** Seçim: Tab / Enter / listeden tık → bekleme yuvası. */
function applySuggestion(id: string) {
  draft.value = draft.value.replace(/\/[a-zA-Z]*$/, `/${id} `)
  if (!selectedIds.value.includes(id)) selectedIds.value.push(id)
  inputEl.value?.focus()
  emitState()
}

function submit() {
  const text = draft.value.trim()
  if (!text) return
  emit('send', text)
  draft.value = ''
  selectedIds.value = []
  emit('preview', [])
  emit('filter', {})
}

function onKeydown(e: KeyboardEvent) {
  const list = suggestions.value
  if (!list.length) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlight.value = (highlight.value + 1) % list.length
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlight.value = (highlight.value - 1 + list.length) % list.length
    return
  }
  if (e.key === 'Tab' || e.key === 'Enter') {
    e.preventDefault()
    applySuggestion((list[highlight.value] ?? list[0]!).id)
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    draft.value = draft.value.replace(/\/[a-zA-Z]*$/, '')
    emitState()
  }
}

function onFocus() {
  emit('engage', true)
}

function onBlur() {
  emit('engage', false)
}

function onLeave() {
  if (document.activeElement !== inputEl.value) emit('engage', false)
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' })
  }
)

function formatTs(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <section class="chat" aria-label="AI chat" @pointerleave="onLeave">
    <div ref="listEl" class="chat__list">
      <p v-if="!messages.length" class="chat__empty">
        <code>/</code> yaz, filtrele — isim benzerse liste daralır.
        Seçim: <kbd>Tab</kbd> / <kbd>Enter</kbd> / tık. Örnek:
        <code>/ARI</code> → ARIA mı ARIS mi?
      </p>
      <article
        v-for="m in messages"
        :key="m.id"
        class="msg"
        :class="'msg--' + m.from"
      >
        <header class="msg__meta">
          <span class="msg__who">{{ m.from === 'you' ? 'sen' : m.from === 'system' ? 'sistem' : m.agentId }}</span>
          <time class="msg__time">{{ formatTs(m.ts) }}</time>
        </header>
        <p class="msg__body">{{ m.text }}</p>
      </article>
    </div>

    <div v-if="suggestions.length" class="chat__suggest" role="listbox" aria-label="Ajan filtresi">
      <button
        v-for="(s, i) in suggestions"
        :key="s.id"
        type="button"
        class="chat__chip"
        :class="{ 'chat__chip--on': i === highlight }"
        role="option"
        :aria-selected="i === highlight"
        @mousedown.prevent="applySuggestion(s.id)"
        @mouseenter="highlight = i"
      >
        <span class="chat__chip-id">/{{ s.id }}</span>
        <span class="chat__chip-role">{{ s.role }}</span>
      </button>
    </div>

    <form class="chat__form" @submit.prevent="submit">
      <input
        ref="inputEl"
        v-model="draft"
        class="chat__input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :placeholder="pendingHint || '/ yaz ve filtrele…'"
        aria-label="Mesaj veya agent komutu"
        @focus="onFocus"
        @blur="onBlur"
        @input="onInput"
        @keydown="onKeydown"
      />
      <button class="chat__send" type="submit">Gönder</button>
    </form>
  </section>
</template>
