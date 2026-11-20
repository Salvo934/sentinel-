# Sentinel Intelligence

Piattaforma web per **OSINT, Cyber Threat Intelligence e Digital Investigations**, pensata come ambiente di lavoro e di formazione per analisti junior.
Questa è la **Fase 1 (MVP)**: Next.js 16 + Supabase (PostgreSQL, Auth, Storage, RLS).

| Documento | Contenuto |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architettura, schema dati, RLS, storage, scelte di sicurezza |
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | Manuale utente modulo per modulo |
| [docs/ATTACK.md](docs/ATTACK.md) | Modulo MITRE ATT&CK: funzioni, dati, aggiornamento |
| [docs/TESTING.md](docs/TESTING.md) | Test automatici ed esito |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Limiti, funzioni pianificate, verifiche manuali richieste |

## Cosa è incluso (Fase 1)

- **Autenticazione** Supabase: registrazione, login, logout, recupero password, sessione, rotte protette, profilo.
- **Ruoli** Administrator / Analyst / Trainee gestiti dal database (non modificabili dal browser).
- **Dashboard** con statistiche e grafici calcolati da Supabase; filtro dati demo.
- **Investigations** (case management): CRUD, stato, attività, timeline (data evento ≠ data di acquisizione), evidenze, report, cronologia da audit log, archiviazione ed eliminazione controllata.
- **Evidence Library**: bucket privato, hash SHA-256 calcolato dal server, verifica di integrità, download con signed URL di 60 s.
- **OSINT Workspace**: risultati con fonte, URL, data, metodo, affidabilità (scala Admiralty), stato dell'informazione, limitazioni; registro fonti.
- **MITRE ATT&CK** (Enterprise 20.1): matrice con heatmap dei casi, guida italiana alle tattiche, schede tecnica con mitigazioni e rilevamento, gruppi di minaccia, mappatura sui casi e suggerimenti da Phishing Lab e Domain Analysis.
- **Missioni e casi reali**: 4 missioni guidate che insegnano il flusso di lavoro dell'analista (richiesta → caso → raccolta → analisi → report) e 9 casi reali ricostruiti dai fenomeni più frequenti contro aziende e PA italiane (finte multe PagoPA, smishing INPS, malspam con infostealer, PEC compromesse, ClickFix, Mirax/falsa app IO, ransomware nel manifatturiero, DDoS hacktivista, BEC/CEO fraud), con dossier, fonti citate (primarie e secondarie distinte), verifica dei passi sul caso reale e nota del senior sbloccata dopo ogni passo.
- **Threat Intelligence**: registro IOC (IPv4, IPv6, domini, URL, SHA-256, SHA-1, MD5) con validazione, verdetto e confidenza dell'analista separati dalla reputazione delle fonti.
- **Domain Analysis**: DNS e RDAP reali raccolti passivamente dal backend (protezioni SSRF, rate limiting, cache), dati simulati per domini riservati, confronto di due domini, cronologia, PDF.
- **Phishing Lab**: analisi statica di header/SPF/DKIM/DMARC, URL inattivi, allegati non aperti, 6 email simulate in modalità training.
- **Report Generator**: 7 tipologie, bozze versionate, versioni finali immutabili, PDF generato solo da dati presenti nel database, archiviazione privata.
- **Training Academy**: 3 esercitazioni complete, correzione lato server, soluzione guidata sbloccata solo dopo la consegna, progressi e portfolio PDF.
- **Modalità demo** con dati fittizi salvati su Supabase ed etichettati.
- Investigation Graph, Risk Assessment e AI Assistant sono **pagine dichiaratamente pianificate** (tabelle già pronte dove previsto).

## Requisiti

- Node.js ≥ 22
- Un progetto Supabase (cloud) **oppure** Supabase CLI + Docker per l'ambiente locale
- (Solo per i test DB locali senza Docker) PostgreSQL ≥ 14 con `initdb`/`pg_ctl`/`psql` nel PATH

## Installazione

```bash
npm install
cp .env.example .env.local   # poi inserisci URL e publishable key del tuo progetto
```

### Opzione A — progetto Supabase cloud

1. Crea un progetto su supabase.com (regione UE consigliata).
2. Collega la CLI e applica le migrazioni:
   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
   In alternativa esegui in ordine i file di `supabase/migrations/` nell'SQL Editor.
3. **Authentication → URL Configuration**: imposta *Site URL* (es. `http://localhost:3000`) e aggiungi `http://localhost:3000/**` ai Redirect URLs.
4. **Authentication → Email Templates**: copia `supabase/templates/confirmation.html` e `recovery.html` (usano il flusso `token_hash` verso `/auth/confirm`).
5. Copia URL e *publishable key* (Project Settings → API) in `.env.local`.

### Opzione B — Supabase locale (Docker)

```bash
npm run db:start      # avvia Supabase locale e applica le migrazioni
npm run db:test       # test pgTAP ufficiali
```

### Avvio

```bash
npm run dev           # http://localhost:3000
```

Registrati: viene creato automaticamente il tuo profilo e un'organizzazione personale di cui sei Administrator.
Da **Settings → Modalità demo** puoi caricare (e rimuovere) i dati fittizi.

### Primo amministratore di piattaforma (facoltativo)

Il ruolo di piattaforma non è modificabile dall'utente. Per promuovere il primo account, dall'SQL Editor (ruolo `postgres`):

```sql
update public.profiles set role = 'administrator' where id = (select id from auth.users where email = 'tua@email');
```

Serve solo per gestire il bucket `training-datasets`; per l'uso quotidiano basta essere admin della propria organizzazione.

## Deploy su Cloudflare Workers

Produzione: **https://sentinel-intelligence.salvo-bonavita9808.workers.dev** (OpenNext + Workers, flag `nodejs_compat` e `global_fetch_strictly_public`).

```bash
npx wrangler login     # una sola volta
npm run deploy         # build OpenNext + deploy
```

Le variabili `NEXT_PUBLIC_SUPABASE_*` vengono incorporate al momento della build da `.env.local`. Le chiavi server-side facoltative (es. `VIRUSTOTAL_API_KEY`) vanno impostate come secret: `npx wrangler secret put VIRUSTOTAL_API_KEY`. In Supabase Auth la Site URL è l'URL di produzione e i Redirect URLs includono produzione e `localhost:3000`.

Le interrogazioni DNS usano DNS-over-HTTPS (Cloudflare 1.1.1.1), compatibile sia con Node.js sia con Workers.

## Script

| Comando | Descrizione |
|---|---|
| `npm run dev` / `build` / `start` | Sviluppo, build di produzione, avvio |
| `npm run preview` / `deploy` | Anteprima locale nel runtime Workers / deploy su Cloudflare |
| `npm run check` | Typecheck + lint + unit test |
| `npm test` | Unit test (Vitest) |
| `npm run db:test:local` | Migrazioni + test RLS su PostgreSQL locale temporaneo (senza Docker) |
| `npm run db:test` | Test pgTAP con Supabase CLI |
| `node scripts/build-training-migration.mjs` | Rigenera la migrazione dei contenuti formativi da `supabase/seed/training/*.json` |

## Sicurezza in breve

Nessuna service role key nell'applicazione; RLS su tutte le tabelle; ruoli verificati nel database; audit log append-only; bucket privati e signed URL brevi; protezioni SSRF; nessuna visita/scansione dei target; email e allegati mai renderizzati o eseguiti. Dettagli in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
