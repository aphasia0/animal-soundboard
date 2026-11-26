# AGENTS.md

Sound Pad è una SPA di CAA per bambini, in italiano: Svelte 5, Rollup, JS puro. Nessun TypeScript, lint, typecheck, test unitari o CI. `src/main.js` monta `App` su `document.body`; routing e stato principale sono in `src/App.svelte`. I componenti esistenti usano la sintassi Svelte legacy (`$:`, `export let`, `createEventDispatcher`): non introdurre rune.

## Comandi

```bash
npm install                 # dipendenze app (root)
cd scripts && npm install   # dipendenze CLI/script: package.json separato

npm run dev                 # watch + sirv su http://localhost:8080, legge local.env
npm run build               # bundle minificato in public/build/, legge .env
npm start                   # sirv public --single (fallback SPA)

npm run test:e2e            # build + test su desktop e mobile
npm run test:e2e:headed     # browser visibile
npm run test:e2e:ui         # modalità interattiva
npm run test:e2e:report     # ultimo report HTML
npx playwright test e2e/navigation.spec.js --project=desktop
npx playwright test -g "slug"
```

- Serve Node 18+ per gli script (usano `fetch` globale); il README dice 14.
- `npm run dev` legge `local.env`; `npm run build` legge `.env`. Sono iniettate a build time da `@rollup/plugin-replace` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TTS_URL`, `DOMAIN`, `COMMIT_REF`): dopo averle cambiate serve un rebuild. I nomi `VITE_SUPABASE_*` nel README sono obsoleti.
- `src/InfoView.svelte` dipende dalla stringa esatta `process.env.COMMIT_REF || ""` sostituita da Rollup: non riformattarla.
- `.env` e `local.env` sono versionati: non aggiungerci mai `SUPABASE_SERVICE_ROLE_KEY` o altri segreti; la service role va passata solo nell'ambiente degli script.
- La cartella di deploy è `public/`, non `dist/`. `scripts/setupTypeScript.js` è un residuo del template: non eseguirlo.

## Worker container (`worker/`)

- `worker/server.js` espone `POST /upload` e `GET /health` e lancia `scripts/upload-card.js upload` con `spawn` (mai shell). Esegue i job in serie; `requestId` è idempotente.
- Config: `cp worker/.env.example worker/.env`, poi `cd worker && docker compose up -d --build`. `worker/.env` è gitignored.
- Per Raspberry Pi 3 compila da x86 con `docker buildx build --platform linux/arm/v7 -t soundpad-worker:armv7 -f worker/Dockerfile .` (usa `linux/arm64` con `uname -m` = `aarch64`). Il comando `video` non è esposto: è troppo pesante per il Pi.
- Il worker usa ancora il login utente e scrive in `user_cards`; per `soundpad_public_cards` / `public/<card_uuid>/...` serve una variante con `service_role`.
- `POST /upload` accetta `category` come UUID o nome: il CLI risolve il nome prima di generare audio/immagine, con errore esplicito se è ambiguo. Vale anche per `upload --mode remote` da shell.
- n8n: `worker/n8n-worker-upload.json` (Execute Workflow Trigger → Code di validazione → IF → HTTP) e `worker/n8n-mcp-workflow.json` (MCP Server Trigger + Call n8n Workflow Tool verso il primo). La validazione sta solo nel sottoworkflow e non lancia eccezioni: restituisce `{ok:false, error, dettagli}`. Contratto esposto dal tool: `name` obbligatorio (etichetta + parola pronunciata), `prompt` facoltativo (fallback `name`), `additionalInfo` non esposto. In un `Call n8n Workflow Tool` un `$fromAI(...)` senza quarto argomento è required: i campi facoltativi hanno bisogno di un default, anche `''`. Entrambi i JSON contengono `WORKER_TOKEN` in chiaro e sono gitignored; il nodo `crea_card` richiede di selezionare il sottoworkflow dopo l'import.
- In modalità `voice` il TTS pronuncia `--name` se presente, altrimenti il prompt; il worker passa `--name` al CLI solo se il chiamante lo ha indicato.

## Layout e Safari iOS

- `public/global.css` lascia `html` e `body` nel flusso naturale del documento: non reintrodurre `position: fixed`, `overflow: hidden` o `overscroll-behavior: none` globali. Safari nasconde/anima le proprie barre solo con lo scroll nativo del documento, non con un `<main>` a altezza fissa e `overflow-y: auto`.
- `ModeSelect`, `Home`, `GamesView`, `StorySelect` e `InfoView` usano `min-height: 100dvh` e lo scroll del documento. `CategoryView`, `StoryView`, `TouchTheBox` e `MuoviLaScatola` restano viste immersive a viewport bloccato.
- I fallback viewport vanno nell'ordine `100vh` poi `100dvh`. Le safe area si applicano una sola volta al contenitore radice; controlli fixed e modali devono aggiungere gli inset necessari senza duplicarli nei figli.
- In modalità “Aggiungi a Home” iOS usa `apple-mobile-web-app-status-bar-style=black-translucent` e il fondo `#667eea` di `html`/`body`: non ripristinare la status bar `default` o un body chiaro, altrimenti ricompare la fascia bianca superiore.
- `public/manifest.webmanifest` e le icone in `public/icons/` rendono l’app installabile e standalone (`display: standalone`). Le icone PNG sono generate dal sorgente `public/icons/icon.svg`; l’`apple-touch-icon` deve restare PNG perché iOS ignora gli SVG. Non c’è un service worker: l’app dipende da Supabase e non deve servire bundle in cache potenzialmente obsoleti.

## Audio e lifecycle iOS

- `src/audioUtils.js` tiene un solo `AudioContext`. Non controllare solo `state === "suspended"`: dopo il background iOS può usare `interrupted` o lasciare un contesto muto. Dopo oltre 30 secondi nascosto, al ritorno il contesto viene ricreato al primo playback e le cache degli `AudioBuffer` vengono invalidate.
- Ogni riproduzione deve passare da `resumeAudioContext()`/`ensureRunningAudioContext()` prima di creare sorgenti. Se il resume fallisce, il contesto viene sostituito una volta. Non riutilizzare nodi o buffer del contesto chiuso.

## Test e2e

- Playwright avvia da solo `npm run build` e sirv sulla porta 4173 (`E2E_PORT` per cambiarla). In locale `reuseExistingServer` riusa un server già attivo: se è rimasto un sirv di un build vecchio, i test girano sul bundle vecchio — chiudilo o cambia porta.
- Entrambi i progetti usano Chrome installato (`channel: 'chrome'`), non il browser bundled.
- Le risposte Supabase previste dai test sono finte con `page.route` in `e2e/helpers/supabase-mock.js`. Ogni nuova spec deve chiamare `mockPublicContent` (o `mockSupabaseAuth`, che la include); gli endpoint senza mock vengono chiamati davvero, sul progetto configurato nel build.
- Se aggiungi o rimuovi una categoria pubblica, aggiorna `PUBLIC_CATEGORIES`/`PUBLIC_CARDS` nel mock: `navigation.spec.js` le percorre tutte.
- I test non usano credenziali reali e non toccano il DB.

## Dati: pubblico vs privato

- Contenuti pubblici: `soundpad_public_categories` + `soundpad_public_cards`, leggibili da anon, senza policy di scrittura. Si amministrano con `service_role`.
- Contenuti privati: `user_categories` / `user_cards` / `user_confs`, con RLS per utente. La UI può mostrarli insieme (Home, “All Together”), ma non usare una tabella al posto dell'altra.
- `src/publicContentStore.js` carica le pubbliche una volta per avvio, le normalizza in `{id, slug, name, emoji, sortOrder, items:[{id, name, image, sound}]}` e le tiene in memoria; `src/dbCache.js` aggiunge la cache localStorage di 1 ora (`soundpad:db-cache:v1:*`) con deduplica delle richieste in corso.
- Dopo modifiche al DB invalida la cache (`invalidateDbCache()` o Info → “Invalida Cache DB”). Per le categorie pubbliche serve anche ricaricare la pagina: la lista resta in memoria e non viene rifetchata.
- Le card personali vengono rilette con `force` all'apertura di una categoria; le pubbliche usano la cache.
- La query delle categorie pubbliche usa `select("*")` di proposito: `slug` può essere null.
- Gli asset delle card stanno in Supabase Storage: `card-images` / `card-sounds`, path `public/<card_uuid>/...` per le pubbliche e `<user_id>/...` per le private.
- Le cartelle locali `public/animals`, `public/sounds`, `public/jobs`, ecc. sono state rimosse perché le card vengono da Storage. Non sono più la mappa degli asset, anche se il README le elenca ancora.
- `src/animals.js` e gli altri file categoria statici restano usati da `TouchTheBox`/`MuoviLaScatola` e dal seed: non sono dati morti, non cancellarli.

## Routing

- Rotte SPA: `/`, `/home`, `/random`, `/stories`, `/gameshub`, `/info`, `/category/<uuid>`, `/<slug>`.
- `/<slug>` (un solo segmento) è sempre una categoria pubblica. Se lo slug non esiste si torna alla schermata iniziale, non si cerca una categoria privata.
- `/random` è il mazzo “All Together” (pubbliche + personali), non una categoria.
- `/category/<uuid>` risolve prima la categoria pubblica, poi la privata (le private solo per UUID).
- Lo slug è opzionale: senza slug il link è `/category/<id>`. Il vincolo DB è `lower(slug)`, ma il frontend confronta lo slug in modo esatto e case-sensitive: tieni gli slug minuscoli.
- Il routing è manuale in `syncViewWithUrl`/`applyCategoryRoute` (`pushState` + `popstate`); non c'è un router.
- `public/_redirects` e sirv `--single` gestiscono il fallback SPA; non creare pagine statiche per le categorie.
- `public/sitemap.txt` è manuale: quando aggiungi una categoria pubblica con slug, aggiungi `https://soundpad.antoniogiordano.dev/<slug>`.

## Asset e input

- `public/animals-nocircle/` serve ai giochi “Tocca la Scatola” e “Muovi la Scatola” (e ai mock e2e): non spostarlo.
- `public/assets/stories/` serve a storie e relativi audio.
- `public/build/` è generato da Rollup (gitignored).
- I tasti `A` e `Spazio` sono l'interfaccia del controller hardware ESP32 (`soundpad.c`, tastiera BLE), gestiti in `CategoryView`: non rimuoverli o rimapparli senza motivo.

## Script contenuti (`scripts/`)

- `seed-public-card-content.js`: carica le categorie statiche (`src/animals.js`, `jobs.js`, ...) con UUID deterministici. Legge gli asset locali in `public/`, che ora non ci sono più: per rieseguirlo vanno ripristinati da git. Supporta `--category <slug>` e `--apply`.
- `migrate-user-card-assets-to-public.js --owner UUID [--category UUID ... | --private-category UUID ...] [--apply]`: copia gli asset in `public/<card_uuid>/`.
- `migrate-user-cards-to-public.js --owner UUID --category UUID [--slug verbi] --apply`: scrive le tabelle pubbliche e poi elimina i record privati. Le chiamate REST non sono transazionali; è rieseguibile e verifica prima che gli asset esistano.
- In entrambi: anteprima di default, `--apply` per eseguire, `--help` per le opzioni. `--category` e `--private-category` sono ripetibili e mutuamente esclusive. `--slug` richiede una sola `--category`, viene normalizzato in minuscolo, rifiuta slug riservati (`home`, `random`, `stories`, `gameshub`, `info`, `category`, `animals`, `work`, ...) e conflitti con altri slug.
- Seed e migrazioni non caricano `.env`: passa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nell'ambiente. `scripts/upload-card.js` (anche `npm run cli|video|analyze`) carica il `.env` da solo; per i comandi remoti richiede `SUPABASE_EMAIL` + `SUPABASE_PASSWORD`, per video/TTS anche `ffmpeg` e `GOOGLE_TTS_API_KEY`. Aiuto completo: `node scripts/upload-card.js help`.
- Se manca `SUPABASE_URL`, `upload-card.js` usa un progetto Supabase hardcoded: esporta sempre l'URL esplicito e usa `--dry-run` prima di `delete-card`/`move-card`.
- `create-category` salva `CAT` in `.soundpad-cat.env` (gitignored); i comandi successivi la usano se `--category` è omesso.
- SQL: `supabase-public-cards-ddl.sql` crea tabelle/policy/storage; `supabase-public-cards-migration.sql` è la migrazione dati, richiede di configurare `owner_id` e termina con `rollback;` — sostituiscilo con `commit;` per applicarla.

## Supabase client

- `@supabase/supabase-js` arriva dalla CDN in `public/index.html`; non è una dipendenza npm. Anche i test e2e richiedono rete (o cache) per caricarlo.
- `src/supabaseClient.js` salva la sessione in cookie (`js-cookie`) e applica `DOMAIN` solo quando l'host corrisponde al dominio configurato, così un build di produzione su localhost non perde la sessione.
