<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AGENTS } from '@/agents'

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
}>()

const draft = ref('')
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

const suggestions = computed(() => {
  const m = draft.value.match(/\/([a-zA-Z]*)$/)
  if (!m) return []
  const q = (m[1] ?? '').toUpperCase()
  return AGENTS.filter((a) => a.id.startsWith(q)).slice(0, 5)
})

function applySuggestion(id: string) {
  draft.value = draft.value.replace(/\/[a-zA-Z]*$/, `/${id} `)
  inputEl.value?.focus()
}

function submit() {
  const text = draft.value.trim()
  if (!text) return
  emit('send', text)
  draft.value = ''
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
  <section class="chat" aria-label="AI chat">
    <div ref="listEl" class="chat__list">
      <p v-if="!messages.length" class="chat__empty">
        Agent çağırmak için <code>/ARIA</code> gibi bir komut yaz. Örnek:
        <code>/NOVA yeni bir isim bul</code>
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

    <div v-if="suggestions.length" class="chat__suggest">
      <button
        v-for="s in suggestions"
        :key="s.id"
        type="button"
        class="chat__chip"
        @mousedown.prevent="applySuggestion(s.id)"
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
      />
      <button class="chat__send" type="submit">Gönder</button>
    </form>
  </section>
</template>
