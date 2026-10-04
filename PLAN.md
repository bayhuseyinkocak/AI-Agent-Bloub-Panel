# Agent Panel — Sonraki Aşama Planı (Backend’e Hazır Etkileşim)

Bu belge yeni bir sohbet için devir teslimdir. UI iskeleti (`src/`, bloub bot motoru) hazır; bundan sonra **Agent Bus + çoklu/handoff/pair simülasyonu** gelecek.

## Kesinleşen kararlar

| Konu | Karar |
|------|--------|
| Çoklu summon | `/ARIA /BLITZ mesaj…` — ilk ad **lead**, sonrakiler **helper** |
| Handoff | **Herkes** yapabilir (sadece ARIA değil) |
| Pair görseli | **İkisi de denenecek** — A) yan yana, B) `orbit` bağ; tercih sonra |
| Backend | Henüz yok; şimdilik `LocalBus` sahte olaylar |
| Kod yok / önce plan | Bu belge + sonraki oturumda uygulama |

## Mimari (karar)

UI metni “bilmez”. Her şey **bus olayları** ile akar:

- `user.message` — `{ text, mentions: AgentId[] }`
- `agent.called` — lead + helpers
- `agent.thinking` — yüz/state: thinking/swirl/…
- `agent.say` — `{ agentId, text, to?: AgentId }`
- `agent.handoff` — `{ from, to, task }`
- `agent.pair` / `agent.unpair` — `{ a, b, mode: 'side' | 'orbit' }`
- `agent.done`

Bugün `LocalBus` bunları sahte üretir; yarın WS/SSE aynı tipleri basar. Sahne (`AgentStage`) ve transcript (`ChatDock`) yalnızca olay dinler.

## Fazlar (sonraki sohbette)

1. **Bus + tipler** — `src/bus/types.ts`, `src/bus/localBus.ts` (UI’ya sadece `subscribe` / `dispatch`)
2. **Çoklu summon** — `/A /B` → lead/helper rolleri; tek iş satırı, çok agent
3. **Handoff** — lead/helper cümlesi `agent.handoff` açar; helper **ally** slotuna; sistem satırı `ARIA → BLITZ: …`
4. **Pair** — iki mod: `side` (yan yana + orta-ön) ve `orbit` (bloub `orbit` + hafif bağ). Değişkenle geçiş; ikisini de dene
5. **Stub** — `src/bus/backendBus.ts` iskeleti (şimdilik no-op / mock), gerçek API sonradan

## Dosya haritası (şu an)

- `src/App.vue` — summon state, `onSend` / `onPreview` (bus’a taşınacak)
- `src/agents.ts` — kimlikler, `partners`, `parseCommand`
- `src/layout.ts` — slotlar; focus y≈78, scale 2.15 (senin ayarın)
- `src/components/AgentStage.vue` — bounce, dust burst, gaze/expression
- `src/components/ChatDock.vue` — draft, preview, engage
- `src/components/DustField.vue` — canvas + `dust:burst`
- `src/ui/gaze.ts` — `lookTarget` / `lookFront` (spin=0 — göz kaybı yok)
- `src/bot/*` — bloub motoru; elle oynama

## Uygulama notları

- Bounce: `agent__pop--a/b`, 0.38s
- Odak: chat’te `effraye` + aşağı bakış; çıkınca `surpris` 1.6s → `attentif` + `lookFront`
- Yanlar: `lookFront(soft)`; toplu `surpris` **yok** (göz kaybı)
- `spin` daima 0 (360° tur gözleri yok eder)
- Build: `npm run build` (`vue-tsc` tek kapı)
- Dev: `http://127.0.0.1:5199/`

## Yeni sohbet için kısa brief (kopyala)

> `Agent Panel` projesinde `PLAN.md` oku. Faz 1–2: `src/bus/` LocalBus + `/A /B` lead/helper. Sonra handoff ve pair (side+orbit). Mevcut UI’ya dokunmadan bus’a taşı. Tasarım/etkileşim notları PLAN.md’de.

## Token tasarrufu

1. Yeni sohbette **dosya yolu** ver, kodu yapıştırma.
2. `PLAN.md` + en fazla 3–4 dosya adı yeterli; kalanı `Read`/`Grep` ile bulsun.
3. Bir oturum = bir faz (bus → summon → handoff → pair).
4. Uzun tartışmayı ürün ağacına/`PLAN.md`’ye yaz; her seferinde baştan anlatma.
5. Ekran görüntüsü / tool log’u yerine kısa hata metni.
6. “Kodu yazma, önce şunu netleştir” gibi tek cümlelik scope kilidi kullan.
