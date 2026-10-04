# Agent Panel — Tamamlanan Plan (Faz 1–5 ✅)

Bu belge, Agent Bus + çoklu/handoff/pair simülasyonu planını ve tamamlanma durumunu korur.

## Durum: Tüm fazlar tamamlandı ✅

## Kesinleşen kararlar

| Konu | Karar | Durum |
|------|--------|-------|
| Çoklu summon | `/ARIA /BLITZ mesaj…` — ilk ad **lead**, sonrakiler **helper** | ✅ Faz 2 |
| Handoff | **Herkes** yapabilir (sadece ARIA değil) | ✅ Faz 3 |
| Pair görseli | **İkisi de denenecek** — A) yan yana, B) `orbit` bağ | ✅ Faz 4 |
| Backend | Henüz yok; şimdilik `LocalBus` sahte olaylar | ✅ Faz 1 + Faz 5 stub |
| Side menu | Sol navigasyon paneli — Ajanlar / Kayıt / Ayarlar | ✅ Kullanıcı ekledi |

## Mimari

UI metni “bilmez”. Her şey **bus olayları** ile akar:

- `user.message` — `{ text, mentions: AgentId[] }`
- `agent.called` — lead + helpers
- `agent.thinking` — yüz/state: thinking/swirl/…
- `agent.say` — `{ agentId, text, to?: AgentId }`
- `agent.handoff` — `{ from, to, task }`
- `agent.pair` / `agent.unpair` — `{ a, b, mode: 'side' | 'orbit' }`
- `agent.done`

Bugün `LocalBus` bunları sahte üretir; yarın WS/SSE aynı tipleri basar. Sahne (`AgentStage`) ve transcript (`ChatDock`) yalnızca olay dinler.

## Fazlar (tamamlandı)

1. ✅ **Bus + tipler** — `src/bus/types.ts`, `src/bus/localBus.ts` (UI’ya sadece `subscribe` / `dispatch`)
2. ✅ **Çoklu summon** — `/A /B` → lead/helper rolleri; tek iş satırı, çok agent
3. ✅ **Handoff** — lead/helper cümlesi `agent.handoff` açar; helper **ally** slotuna; sistem satırı `ARIA → BLITZ: …`
4. ✅ **Pair** — iki mod: `side` (yan yana + orta-ön) ve `orbit` (bloub `orbit` + hafif bağ). `!pair side|orbit` veya menüden geçiş
5. ✅ **Stub** — `src/bus/backendBus.ts` iskeleti (şimdilik no-op / mock), gerçek API sonradan

## Dosya haritası

- `src/App.vue` — bus entegrasyonu, summon state, `onSend` / `onPreview`
- `src/agents.ts` — kimlikler, `partners`, `parseCommand`
- `src/layout.ts` — slotlar (focus, ally, companion, pair); focus y≈68, scale 2.15
- `src/pairMode.ts` — `getPairMode` / `setPairMode` / `togglePairMode`
- `src/bus/types.ts` — olay sözleşmeleri (`BusEvent`, `AgentBus` arayüzü)
- `src/bus/localBus.ts` — mock bus (sahte olay üretimi)
- `src/bus/backendBus.ts` — gerçek backend stub (no-op, ileride WS/SSE)
- `src/bus/index.ts` — barrel export
- `src/components/AgentStage.vue` — bounce, dust burst, gaze/expression, pair bond SVG
- `src/components/ChatDock.vue` — draft, preview, engage
- `src/components/DustField.vue` — canvas + `dust:burst`
- `src/components/SideMenu.vue` — sol navigasyon (Ajanlar / Kayıt / Ayarlar)
- `src/ui/gaze.ts` — `lookTarget` / `lookFront` (spin=0 — göz kaybı yok)
- `src/bot/*` — bloub motoru; elle oynama

## Uygulama notları

- Bounce: `agent__pop--a/b`, 0.38s
- Odak: chat’te `effraye` + aşağı bakış; çıkınca `surpris` 1.6s → `attentif` + `lookFront`
- Yanlar: `lookFront(soft)`; toplu `surpris` **yok** (göz kaybı)
- `spin` daima 0 (360° tur gözleri yok eder)
- Pair `side`: yan yana, scale 1.55, orta-ön
- Pair `orbit`: biraz açık, scale 1.35, bağ çizgisi (SVG quadratic bezier)
- Build: `npm run build` (`vue-tsc` tek kapı)
- Dev: `http://127.0.0.1:5199/`

## Sonraki adımlar (ileride)

- Gerçek backend entegrasyonu (WS/SSE) — `backendBus.ts` stub hazır
- Side menu genişletmesi (ayarlar paneli, tema, dil vs.)
- Pair görsel tercihi (kullanıcı deneyip seçecek)
- UI iyileştirmeleri (kullanıcı istekleri doğrultusunda)

## Token tasarrufu

1. Yeni sohbette **dosya yolu** ver, kodu yapıştırma.
2. `PLAN.md` + en fazla 3–4 dosya adı yeterli; kalanı `Read`/`Grep` ile bulsun.
3. Bir oturum = bir faz (bus → summon → handoff → pair).
4. Uzun tartışmayı ürün ağacına/`PLAN.md`’ye yaz; her seferinde baştan anlatma.
5. Ekran görüntüsü / tool log’u yerine kısa hata metni.
6. “Kodu yazma, önce şunu netleştir” gibi tek cümlelik scope kilidi kullan.
