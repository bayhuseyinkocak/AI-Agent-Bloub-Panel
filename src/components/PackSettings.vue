<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useBusStatus } from '@/bus'
import {
  exportPackText,
  getActivePackId,
  getPack,
  listPacks,
  loadActivePack,
  savePackJson,
  setActivePackId,
  type PackSummary
} from '@/pack/store'
import type { AgentPack, PackTransport } from '@/pack'

const props = defineProps<{ active?: boolean }>()
const emit = defineEmits<{ packChanged: [pack: AgentPack] }>()

const packs = ref<PackSummary[]>([])
const activeId = ref(getActivePackId())
const text = ref('')
const errors = ref<string[]>([])
const savedNote = ref('')
const transport = ref<PackTransport>('local')
const url = ref('')
const busStatus = useBusStatus()

function refresh() {
  packs.value = listPacks()
  const pack = getPack(activeId.value) ?? loadActivePack()
  text.value = exportPackText(pack)
  transport.value = pack.transport
  url.value = pack.url ?? ''
  errors.value = []
  savedNote.value = ''
}

function applyTransportFields(pack?: AgentPack) {
  const base = pack ?? (getPack(activeId.value) ?? loadActivePack())
  const next: AgentPack = {
    ...base,
    transport: transport.value,
    url: transport.value === 'ws' ? url.value || null : null
  }
  text.value = exportPackText(next)
  return next
}

function onConnect() {
  const next = applyTransportFields()
  const result = savePackJson(text.value)
  errors.value = result.errors
  if (!result.ok || !result.pack) return
  savedNote.value =
    transport.value === 'ws' ? `WS: ${url.value || '(url yok)'}` : 'LocalBus (demo olaylar)'
  packs.value = listPacks()
  emit('packChanged', result.pack)
}

const statusLabel = computed(() => {
  switch (busStatus.value) {
    case 'local':
      return 'local · demo'
    case 'connecting':
      return 'ws · bağlanıyor'
    case 'open':
      return 'ws · bağlı'
    case 'closed':
      return 'ws · kapalı'
    case 'error':
      return 'ws · hata'
    default:
      return busStatus.value
  }
})

onMounted(refresh)
watch(
  () => props.active,
  (on) => {
    if (on) refresh()
  }
)

function onSelect(id: string) {
  activeId.value = id
  setActivePackId(id)
  const pack = getPack(id)
  if (pack) {
    text.value = exportPackText(pack)
    errors.value = []
    savedNote.value = `Yüklendi: ${pack.name}`
    emit('packChanged', pack)
  }
}

function onSave() {
  const result = savePackJson(text.value)
  errors.value = result.errors
  if (!result.ok || !result.pack) {
    savedNote.value = ''
    return
  }
  savedNote.value = `Kaydedildi: ${result.pack.id}`
  packs.value = listPacks()
  activeId.value = result.pack.id
  emit('packChanged', result.pack)
}

function onExport() {
  const blob = new Blob([text.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${activeId.value || 'pack'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const agentCount = computed(() => {
  try {
    const data = JSON.parse(text.value) as { agents?: unknown[] }
    return Array.isArray(data.agents) ? data.agents.length : 0
  } catch {
    return 0
  }
})
</script>

<template>
  <div class="pack-form">
    <div class="nav__row-label">Ajan paketi</div>
    <p class="nav__row-hint">
      Farklı backend = farklı paket. {{ agentCount }} ajan yüklü.
    </p>

    <label class="pack-panel__label">
      Aktif paket
      <select v-model="activeId" class="pack-panel__select" @change="onSelect(activeId)">
        <option v-for="p in packs" :key="p.id" :value="p.id">
          {{ p.name }} · {{ p.transport }}{{ p.builtin ? ' · gömülü' : '' }}
        </option>
      </select>
    </label>

    <div class="nav__row" style="align-items: flex-start">
      <div>
        <div class="nav__row-label">Transport</div>
        <div class="nav__row-hint">
          <span class="pack-badge" :class="'pack-badge--' + busStatus">{{ statusLabel }}</span>
        </div>
      </div>
      <button type="button" class="nav__toggle" @click="transport = transport === 'local' ? 'ws' : 'local'">
        {{ transport }}
      </button>
    </div>

    <label v-if="transport === 'ws'" class="pack-panel__label">
      WS URL
      <input
        v-model="url"
        class="pack-panel__select"
        type="text"
        placeholder="ws://127.0.0.1:8787/bus"
        spellcheck="false"
      />
    </label>

    <div class="pack-panel__actions">
      <button type="button" class="pack-panel__btn" @click="onConnect">Bağlan / uygula</button>
    </div>

    <label class="pack-panel__label">
      Pack JSON
      <textarea
        v-model="text"
        class="pack-panel__json"
        spellcheck="false"
        rows="10"
        aria-label="Pack JSON"
      />
    </label>

    <ul v-if="errors.length" class="pack-panel__errors">
      <li v-for="(e, i) in errors" :key="i">{{ e }}</li>
    </ul>
    <p v-if="savedNote" class="pack-panel__note">{{ savedNote }}</p>

    <div class="pack-panel__actions">
      <button type="button" class="pack-panel__btn" @click="onSave">Doğrula + kaydet</button>
      <button type="button" class="pack-panel__btn pack-panel__btn--ghost" @click="onExport">
        Dışa aktar
      </button>
    </div>
  </div>
</template>
