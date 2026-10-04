# Agent Panel — Agent Kuralları

Bu proje için geçerli kurallar. Her oturumda bunu oku ve uygula.

## Proje

- Vue 3 + TypeScript (Composition API, `<script setup>`), Vite 8, plain CSS
- Tek çalışma zamanı bağımlılığı: Vue
- Mimari: UI metni bilmez; her şey **bus olayları** ile akar (`src/bus/`)
- Bot motoru: `src/bot/` (Bloub SVG morph, kopyalanmış)
- Backend henüz yok — `LocalBus` mock; `backendBus.ts` iskelet

## Komutlar

```bash
npm install
npm run dev     # http://127.0.0.1:5199/
npm run build   # vue-tsc + vite build
```

Değişiklikten sonra mümkünse `npm run build` (veya en az `vue-tsc --noEmit`) çalıştır.

## Dokümantasyon zorunluluğu (kritik)

**Her önemli kod değişikliği veya ana ürün/mimari kararından sonra** dokümanları güncelle:

1. **`README.md`** — genel durum, kurulum, mimari özet, varsa yeni komut/akış
2. **Gerekirse** `docs/` altındaki temel konular (yalnızca var olanlar; gereksiz yeni dosya üretme)
3. **Mimari/karar etkisi varsa** `PLAN.md`’deki karar tablosunu veya ilgili bölümü güncelle

Kurallar:

- Doküman **kopya değil**, güncel ve kısa olacak
- Yeni özellik/komut/akış varsa README’ye ekle
- Karar değiştiyse eski metni sil/düzelt; “eski sürüyordu” diye durmasın
- Küçük tek satırlık düzeltmelerde README’yi abartma; davranış, API, komut, mimari veya ürün kararı değiştiyse güncelle

## Kod ve mimari

- Bus olayları tek kaynak: `src/bus/types.ts` — UI bileşenleri olay **dinler**, metin/logic üretmez
- Yeni olay ekle → tipler + `LocalBus` + dinleyen UI + README/PLAN notu
- Agent listesi/rolleri: `src/agents.ts` — değiştiyse README tablosunu da güncelle
- Stil: plain CSS, Tailwind yok
- TypeScript strict; `vue-tsc` temiz olmalı

## Git

- Ana branch: `main`
- Çoğu iş `feature/*` üzerinde; `main`’de doğrudan commit/merge gerekmeden yapma
- Commit mesajı net ve neden odaklı olacak

## Dokümantasyon dosyaları

| Dosya | Ne yazılır |
|-------|------------|
| `README.md` | Genel bakış, kurulum, komutlar, mimari özeti |
| `PLAN.md` | Kararlar, fazlar, tamamlanan iş |
| `DESIGN.md` | Görsel/ürün tasarım notları |
| `docs/**` | Temel konular (yalnızca ihtiyaç olduğunda) |

---

Kural özeti: **kod → build doğrula → README (ve gerekirse docs/PLAN) güncelle.**
