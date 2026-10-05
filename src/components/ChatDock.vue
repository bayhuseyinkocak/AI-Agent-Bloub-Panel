<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoster } from '@/roster'

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
  /** hazır kadro — tam `/ID` (yazım veya Tab) — bekleme yuvasında durur */
  preview: [ids: string[]]
  /** filtre pull 0–1 — önek tutanlar yazdıkça ortaya */
  filter: [pulls: Record<string, number>]
  /** input odağı — avatarlar chat’e baksın */
  engage: [on: boolean]
}>()

const draft = ref('')
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const { agents: rosterAgents, byId: rosterById } = useRoster()
const highlight = ref(0)
/** sadece Tab / Enter / tık ile eklenir — yazmak çağırmaz */
const selectedIds = ref<string[]>([])

/**
 * Taslaktaki tüm mention’lar.
 * - held: boşlukla kapanmış (ya da metinle birlikte kalmış) tam `/ID` — yerini korur
 * - typing: imleçteki son `/yazım` — kademeli pull + filtre listesi
 *
 * `/ARIA` → typing=ARIA (hazır). `/ARIA ` → held=[ARIA].
 * `/ARIA /NO` → held=[ARIA], typing=NO. `/ARIA mesaj` → held=[ARIA].
 */
function parseDraftMentions(raw: string): { held: string[]; typing: string | null } {
  const held: string[] = []
  let typing: string | null = null
  if (!raw) return { held, typing }
  const hasTrailingSpace = /\s$/.test(raw)
  const parts = raw.split(/\s+/)
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    if (!part.startsWith('/')) continue
    const key = part.slice(1).toUpperCase()
    const stillTyping = i === parts.length - 1 && !hasTrailingSpace
    if (stillTyping) {
      typing = key
    } else if (key && rosterById.value.has(key)) {
      if (!held.includes(key)) held.push(key)
    }
  }
  return { held, typing }
}

/** Taslakta tam `/ID` token’ı var mı (Tab seçiminin hâlâ yaşayıp yaşamadığı). */
function hasToken(raw: string, id: string): boolean {
  return new RegExp(`(?:^|\\s)\\/${id}(?=\\s|$)`, 'i').test(raw)
}

/**
 * Sahne için “hazır” kadro = tam ad (kapanmış mention veya bitişik yazım)
 * + Tab seçimi ∩ taslak. Sıra taslakta görünme sırası — slot kaymasın.
 */
function readyIds(): string[] {
  const { held, typing } = parseDraftMentions(draft.value)
  const out: string[] = [...held]
  if (typing && rosterById.value.has(typing) && !out.includes(typing)) out.push(typing)
  for (const id of selectedIds.value) {
    if (hasToken(draft.value, id) && !out.includes(id)) out.push(id)
  }
  return out
}

/** Son `/partial` — filtre listesi + kademeli pull. Kapalıysa null. */
const filterQuery = computed(() => parseDraftMentions(draft.value).typing)

const suggestions = computed(() => {
  const q = filterQuery.value
  if (q === null) return []
  const taken = new Set(selectedIds.value.filter((id) => hasToken(draft.value, id)))
  return rosterAgents.value.filter((a) => a.id.startsWith(q) && !taken.has(a.id)).slice(0, 8)
})

/**
 * Pull = ne kadar özgül eşleşme. `/A` → 0.3, `/AR` → 0.45.
 * Tam ad zaten ready slot’una geçer; pull yalnızca önek tutanlar içindir.
 */
function computePulls(query: string | null, ready: string[]): Record<string, number> {
  const pulls: Record<string, number> = {}
  if (!query || query.length < 1) return pulls
  if (rosterById.value.has(query)) return pulls
  for (const a of rosterAgents.value) {
    if (ready.includes(a.id)) continue
    if (!a.id.startsWith(query)) continue
    const specific = query.length / a.id.length
    pulls[a.id] = Math.min(0.92, 0.18 + specific * 0.55)
  }
  return pulls
}

watch(suggestions, () => {
  highlight.value = 0
})

function emitState() {
  // seçili ama taslaktan silinmiş olanları düşür
  selectedIds.value = selectedIds.value.filter((id) => hasToken(draft.value, id))
  const ready = readyIds()
  emit('preview', ready)
  emit('filter', computePulls(filterQuery.value, ready))
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

  if (e.key === 'Escape' && filterQuery.value !== null) {
    e.preventDefault()
    draft.value = draft.value.replace(/\/[a-zA-Z]*$/, '')
    emitState()
    return
  }

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
    e.preventDefault()
    const q = filterQuery.value
    // tam ad veya mesaj varsa GÖNDER; yalnızca yarım `/ön` ise seç
    const exact = q !== null && rosterById.value.has(q)
    const hasMessage = /\S/.test(draft.value.replace(/\/[a-zA-Z0-9_-]+/g, '').trim())
    if (!exact && !hasMessage) {
      applySuggestion((list[highlight.value] ?? list[0]!).id)
      return
    }
    submit()
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
