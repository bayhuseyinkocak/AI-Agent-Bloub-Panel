<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { type AgentDef } from '@/agents'
import { useRoster } from '@/roster'
import type { ChatMessage } from '@/components/ChatDock.vue'
import { getPairMode, setPairMode } from '@/pairMode'
import type { PairMode } from '@/bus'
import type { AgentPack } from '@/pack'
import PackSettings from './PackSettings.vue'

type PanelId = 'agents' | 'log' | 'settings'

const props = defineProps<{
  messages: ChatMessage[]
  focusId: string | null
  allyIds: string[]
}>()

const emit = defineEmits<{
  summon: [id: string]
  packChanged: [pack: AgentPack]
}>()

const open = ref(false)
const panel = ref<PanelId | null>(null)
const pairMode = ref<PairMode>(getPairMode())
const rootEl = ref<HTMLElement | null>(null)

const { agents: rosterAgents } = useRoster()

const roster = computed(() =>
  rosterAgents.value.map((a: AgentDef) => ({
    ...a,
    live: props.focusId === a.id || props.allyIds.includes(a.id)
  }))
)

const recent = computed(() => props.messages.slice(-12).reverse())

function toggle(id: PanelId) {
  if (open.value && panel.value === id) {
    close()
    return
  }
  panel.value = id
  open.value = true
  if (id === 'settings') pairMode.value = getPairMode()
}

function close() {
  open.value = false
  panel.value = null
}

function summon(id: string) {
  emit('summon', id)
  close()
}

function cyclePair() {
  const next: PairMode = pairMode.value === 'side' ? 'orbit' : 'side'
  setPairMode(next)
  pairMode.value = next
}

function onPointerDown(e: PointerEvent) {
  if (!open.value) return
  const t = e.target as HTMLElement | null
  if (t?.closest('.nav')) return
  close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <aside ref="rootEl" class="nav" :class="{ 'nav--open': open }" aria-label="Panel menü">
    <div class="nav__rail">
      <button
        type="button"
        class="nav__btn"
        :class="{ 'nav__btn--on': panel === 'agents' }"
        title="Ajanlar"
        aria-label="Ajanlar"
        :aria-expanded="panel === 'agents'"
        @click="toggle('agents')"
      >
        <svg class="nav__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5" />
          <circle cx="16" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M4.5 17c.6-2 2-3 3.5-3s2.9 1 3.5 3M12.5 17c.6-2 2-3 3.5-3s2.9 1 3.5 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="nav__label">Ajanlar</span>
      </button>

      <button
        type="button"
        class="nav__btn"
        :class="{ 'nav__btn--on': panel === 'log' }"
        title="Kayıt"
        aria-label="Kayıt"
        :aria-expanded="panel === 'log'"
        @click="toggle('log')"
      >
        <svg class="nav__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7h10M7 12h10M7 17h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="nav__label">Kayıt</span>
      </button>

      <button
        type="button"
        class="nav__btn"
        :class="{ 'nav__btn--on': panel === 'settings' }"
        title="Ayarlar"
        aria-label="Ayarlar"
        :aria-expanded="panel === 'settings'"
        @click="toggle('settings')"
      >
        <svg class="nav__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M12 5.5v1.2M12 17.3v1.2M5.5 12h1.2M17.3 12h1.2M7.4 7.4l.9.9M15.7 15.7l.9.9M7.4 16.6l.9-.9M15.7 8.3l.9-.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="nav__label">Ayarlar</span>
      </button>
    </div>

    <div v-if="open && panel" class="nav__panel" role="dialog" :aria-label="panel === 'agents' ? 'Ajanlar' : panel === 'log' ? 'Kayıt' : 'Ayarlar'">
      <header class="nav__head">
        <span class="nav__title">
          {{ panel === 'agents' ? 'Ajanlar' : panel === 'log' ? 'Kayıt' : 'Ayarlar' }}
        </span>
        <button type="button" class="nav__close" title="Kapat" aria-label="Kapat" @click="close">×</button>
      </header>

      <div v-if="panel === 'agents'" class="nav__body">
        <button
          v-for="a in roster"
          :key="a.id"
          type="button"
          class="nav__agent"
          :class="{ 'nav__agent--live': a.live }"
          @click="summon(a.id)"
        >
          <span class="nav__agent-id">{{ a.id }}</span>
          <span class="nav__agent-role">{{ a.role }}</span>
        </button>
      </div>

      <div v-else-if="panel === 'log'" class="nav__body nav__body--log">
        <p v-if="!recent.length" class="nav__empty">Henüz kayıt yok. Sohbetten bir ajan çağır.</p>
        <div v-for="m in recent" :key="m.id" class="nav__log">
          <span class="nav__log-who">{{ m.from === 'you' ? 'sen' : m.agentId ?? m.from }}</span>
          <span class="nav__log-text">{{ m.text }}</span>
        </div>
      </div>

      <div v-else class="nav__body">
        <div class="nav__row">
          <div>
            <div class="nav__row-label">Pair modu</div>
            <div class="nav__row-hint">{{ pairMode === 'side' ? 'yan yana' : 'orbit + bağ' }}</div>
          </div>
          <button type="button" class="nav__toggle" @click="cyclePair">
            {{ pairMode === 'side' ? 'side' : 'orbit' }}
          </button>
        </div>
        <PackSettings :active="panel === 'settings'" @pack-changed="emit('packChanged', $event)" />
      </div>
    </div>
  </aside>
</template>
