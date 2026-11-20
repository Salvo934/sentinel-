# Architettura tecnica

## 1. Visione d'insieme

```
Browser ──(cookie di sessione)──► Next.js 16 (App Router, Server Components, Server Actions)
                                    │  client Supabase con publishable key + JWT utente
                                    ▼
                              Supabase
                              ├─ Auth (email/password, token_hash)
                              ├─ PostgreSQL + RLS (autorizzazione definitiva)
                              ├─ Storage (4 bucket privati, policy su storage.objects)
                              └─ RPC SECURITY DEFINER (ruoli, demo, training, audit)
Backend Next.js (Cloudflare Workers) ──► DNS-over-HTTPS 1.1.1.1, RDAP (allow-list + controllo IP pubblici)
```

**Scelte principali**

- **Supabase è l'unico backend dati.** Ogni lettura/scrittura usa il client dell'utente: l'autorizzazione è applicata da RLS, non dall'interfaccia. La service role key non serve e non è usata.
- **Server Actions** per tutte le scritture (protezione CSRF tramite controllo dell'Origin di Next.js), con validazione **Zod** speculare ai vincoli `CHECK` del database.
- **`proxy.ts`** (ex middleware) aggiorna la sessione e fa redirect ottimistici; ogni layout/azione richiama `requireUser()` (`auth.getUser()` verifica la sessione sul server Auth).
- **Nessuna cache server-side** (`cacheComponents: false`): i dati sono per-utente e per-organizzazione.
- **PDF generati nel browser** (jsPDF) a partire da dati letti sotto RLS; il file viene caricato nel bucket privato dei report e il percorso registrato con controllo lato server.
- Struttura `src/features/<modulo>` (azioni, dati, componenti) + `src/lib` (dominio, validazione, sicurezza di rete, formattazione).

## 2. Modello dati

Migrazioni versionate in `supabase/migrations/`:

| File | Contenuto |
|---|---|
| `…100000_foundations` | Enum (categorie, stati, rischio, stato informazione, IOC, report…), dominio `source_reliability` (Admiralty A–F) |
| `…100100_identity_tenancy_audit` | `profiles`, `organizations`, `organization_members`, `audit_logs`, helper di autorizzazione, bootstrap nuovo utente, RPC ruoli |
| `…100200_investigations` | `cases`, `case_tasks`, `evidence`, `osint_sources`, `osint_findings`, `investigation_entities`, `entity_relationships`, `ioc_indicators`, `ioc_analysis_results`, `investigation_events`, `risk_assessments`, `phishing_analyses`, `domain_analyses`, `osint_queries`, `reports` + trigger di audit + RLS |
| `…100300_training` | `training_scenarios`, `training_answer_keys` (segreta), `training_attempts`, funzione di correzione, RPC |
| `…100400_storage` | Bucket e policy di Storage |
| `…100500_demo_and_dashboard` | `seed_demo_data`, `clear_demo_data`, `dashboard_stats` |
| `…100600_training_content` | Contenuti delle 3 esercitazioni (generato da JSON) |

Tutte le chiavi sono UUID (eccetto log append-only con identity), timestamp `timestamptz`, foreign key con politiche `cascade`/`set null`/`restrict` esplicite, indici su chiavi di accesso, JSONB solo per dati semi-strutturati (risultati tecnici, contenuto report, dataset formativi).

Rispetto allo schema richiesto sono stati aggiunti campi utili alla metodologia: `cases.objective/notes/case_ref/is_demo/archived_at`, `evidence.acquisition_method/original_filename/mime_type/size_bytes/metadata/last_integrity_*`, `investigation_events.category/source/reliability/info_status`, `reports.report_key/status/classification/finalized_at`, `risk_assessments` con rischio inerente/residuo calcolati e valutazione dell'analista separata. Tabelle nuove: `osint_findings` (risultati OSINT con tutti i metadati richiesti), `phishing_analyses`, `domain_analyses`, `osint_queries` (cronologia, rate limiting, controllo costi), `training_answer_keys`.

## 3. Autorizzazione (RLS)

- Ruoli di organizzazione: `admin` (Administrator), `analyst`, `trainee`. Ruolo di piattaforma su `profiles.role`.
- Helper `SECURITY DEFINER` (`is_org_member`, `has_org_role`, `can_read_case`, `can_write_case`, `case_role_in`) evitano ricorsione nelle policy e risolvono l'appartenenza anche quando l'organizzazione è **indiretta** (figli del caso → caso → organizzazione; oggetti di Storage → percorso → caso → organizzazione).
- Regole principali:
  - lettura: tutti i membri dell'organizzazione;
  - scrittura sul contenuto di un caso: admin/analyst, oppure trainee sui casi creati da sé; **casi archiviati in sola lettura**;
  - eliminazione caso: solo admin e solo se archiviato; eliminazione evidenze: solo admin;
  - report: creati come bozza; le versioni finali sono immutabili (trigger), modificabile solo il percorso del PDF;
  - `profiles.role` e `organization_members` non scrivibili via API (column grants + trigger + RPC che verificano il chiamante);
  - `audit_logs`: nessun permesso di insert/update/delete via API, trigger che impedisce update/delete; i trainee vedono solo le proprie voci;
  - `training_answer_keys`: nessun grant; la soluzione è restituita da `get_training_solution` solo dopo una consegna; punteggio e feedback scritti solo da `submit_training_attempt`.
- Campi "autore" (`created_by`, `collected_by`, `user_id`) forzati da trigger su `auth.uid()`; hash e percorso delle evidenze sono write-once; coerenza caso/organizzazione verificata da trigger.

## 4. Audit log

Trigger `tg_audit_row` su casi, attività, evidenze, risultati OSINT, IOC, eventi, rischi, analisi phishing/domini e report: registra azione, entità, organizzazione, caso, utente, campi modificati e transizioni di stato (non il contenuto completo, per minimizzare i dati). Eventi applicativi (download evidenza, esportazione PDF, verifica integrità, consegna esercitazione) tramite `log_activity`, sempre con prefisso `client.`.

## 5. Storage

| Bucket | Percorso | Tipi / limite | Lettura | Scrittura | Cancellazione | Conservazione |
|---|---|---|---|---|---|---|
| `investigation-evidence` | `{org}/{case}/{uuid}-{file}` | pdf, txt, csv, json, eml, png, jpg, webp, docx, xlsx · 20 MB | membri (RLS caso) | chi può scrivere il caso | admin | segue il caso; nessuna sovrascrittura |
| `investigation-reports` | `{org}/{case}/{report}-v{n}-{ts}.pdf` | pdf · 15 MB | membri | chi può scrivere il caso | admin | segue il caso |
| `training-datasets` | `{scenario}/{file}` | pdf, txt, csv, json, eml, png, jpg · 10 MB | tutti gli autenticati | admin di piattaforma | admin di piattaforma | permanente |
| `user-exports` | `{user_id}/{file}` | pdf, json, csv, zip · 25 MB | proprietario | proprietario | proprietario | a discrezione dell'utente |

Tutti privati; accesso tramite signed URL di 60 secondi con `Content-Disposition: attachment`. Le evidenze vengono caricate dal server: tipo determinato dall'estensione in allow-list e verificato con magic bytes, nome file sanificato, SHA-256 calcolato sui byte salvati.

## 6. Sicurezza applicativa

| Minaccia | Contromisura |
|---|---|
| Accesso non autorizzato | Supabase Auth, `requireUser()` server-side, RLS su ogni tabella, ruoli nel DB |
| Escalation di privilegi | column grants, trigger su `profiles.role`, RPC con verifica del chiamante |
| SQL injection | query parametrizzate del client Supabase; input di ricerca ripulito dai metacaratteri PostgREST |
| XSS | React escaping; nessun `dangerouslySetInnerHTML`; email/HTML mostrati come testo; URL defanged e non cliccabili |
| CSRF | Server Actions con controllo Origin; route di download solo GET idempotenti con redirect a signed URL |
| SSRF | nessun fetch verso URL dell'utente; in produzione il flag Workers `global_fetch_strictly_public` impedisce fetch verso indirizzi privati; RDAP solo HTTPS, redirect gestiti manualmente, allow-list host, risoluzione DNS con blocco di IP privati/riservati, timeout e limite di dimensione |
| Abuso / costi | rate limit 10 interrogazioni/min per utente (DB), cache 10 min, log delle interrogazioni |
| Upload malevoli | allow-list estensioni, magic bytes, 20 MB, bucket privato, download forzato |
| Divulgazione di errori | messaggi generici all'utente, dettagli solo nei log server |
| Open redirect | `safeRedirectPath` per il parametro `next` |
| Header | nosniff, frame DENY, no-referrer, HSTS, Permissions-Policy |

## 7. Modalità demo

`seed_demo_data` (solo admin) crea organizzazioni/aziende fittizie, domini `.example`, IP di documentazione (RFC 5737/3849), casi, attività, evidenze descrittive senza file, risultati OSINT, IOC con risultati "simulated", timeline, analisi phishing e dominio, una bozza di report. Ogni riga ha `is_demo = true`; le policy di insert impediscono di creare righe `is_demo` dall'API. `clear_demo_data` le rimuove.
