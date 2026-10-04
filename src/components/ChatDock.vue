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
  /** seçilmiş (tam ad) ajanlar — lead adayı */
  preview: [ids: string[]]
  /** filtre eşleşmesi — sahnede soft yaklaşım, lead değil */
  filter: [ids: string[]]
  /** input odağı — avatarlar chat’e baksın */
  engage: [on: boolean]
}>()

const draft = ref('')
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const highlight = ref(0)

/** Tam yazılmış `/ARIA` gibi token’lar = seçilmiş. Kısaltma (`/AR`) sayılmaz. */
function exactIds(raw: string): string[] {
  const ids: string[] = []
  for (const part of raw.trim().split(/\s+/)) {
    if (!part.startsWith('/') || part.length < 2) continue
    const key = part.slice(1).toUpperCase()
    if (AGENT_BY_ID.has(key) && !ids.includes(key)) ids.push(key)
  }
  return ids
}

/** Son `/partial` — filtre listesi + soft eşleşmeler. */
const filterQuery = computed(() => {
  const m = draft.value.match(/\/([a-zA-Z]*)$/)
  return m ? (m[1] ?? '').toUpperCase() : null
})

const suggestions = computed(() => {
  const q = filterQuery.value
  if (q === null) return []
  const selected = new Set(exactIds(draft.value))
  return AGENTS.filter((a) => a.id.startsWith(q) && !selected.has(a.id)).slice(0, 8)
})

watch(suggestions, () => {
  highlight.value = 0
})

watch(draft, (val) => {
  emit('preview', exactIds(val))
  emit('filter', suggestions.value.map((s) => s.id))
})

function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement).value
}

/** Seçim: Tab / Enter (tek eşleşme) / listeden tık. */
function applySuggestion(id: string) {
  draft.value = draft.value.replace(/\/[a-zA-Z]*$/, `/${id} `)
  inputEl.value?.focus()
  emit('preview', exactIds(draft.value))
  emit('filter', [])
}

function submit() {
  const text = draft.value.trim()
  if (!text) return
  emit('send', text)
  draft.value = ''
  emit('preview', [])
  emit('filter', [])
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
  if (e.key === 'Tab') {
    e.preventDefault()
    applySuggestion((list[highlight.value] ?? list[0]!).id)
    return
  }
  if (e.key === 'Enter') {
    // filtre açıkken Enter her zaman seçimi kesinleştirir (göndermez)
    e.preventDefault()
    applySuggestion((list[highlight.value] ?? list[0]!).id)
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    draft.value = draft.value.replace(/\/[a-zA-Z]*$/, '')
    emit('preview', exactIds(draft.value))
    emit('filter', [])
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
        <code>/</code> yaz, filtrele, <kbd>Tab</kbd> / <kbd>Enter</kbd> / tık ile seç.
        Örnek: <code>/NOVA yeni bir isim bul</code>
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
        :placeholder="pendingHint || '/AGENT_ADI mesaj…'"
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
