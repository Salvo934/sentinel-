# Test ed esito

Eseguiti il 20/11/2026 su macOS, Node 22.15, PostgreSQL 14.19 locale.

## 1. Database e RLS — `npm run db:test:local`

Applica tutte le migrazioni su un cluster PostgreSQL temporaneo (con uno shim di `auth`, `storage` e ruoli Supabase in `scripts/db/`) ed esegue i test pgTAP impersonando gli utenti come fa PostgREST.

```
✔ 01_tenancy_rls_roles.sql (30 assertions)
✔ 02_evidence_reports_training_storage.sql (28 assertions)
✔ 03_attack.sql (13 assertions)
✔ 04_missions.sql (16 assertions)
```

Coperti: isolamento tra organizzazioni; creazione profilo/organizzazione alla registrazione; impossibilità di auto-assegnarsi ruoli o membership; trainee in sola lettura sui casi altrui ma attivi sui propri; analyst senza permessi di eliminazione; eliminazione solo di casi archiviati e solo da admin; casi archiviati in sola lettura; audit log non cancellabile, visibile per ruolo e alimentato dai trigger; `log_activity` e demo vincolati all'organizzazione; anon senza accesso; hash evidenze write-once e obbligatorio con file; coerenza caso/organizzazione degli IOC; report creati come bozza, finali immutabili, versionamento; chiavi di correzione non leggibili, soluzione bloccata prima della consegna, punteggio non scrivibile dall'utente, tentativi consegnati congelati; policy Storage su cartelle di altre organizzazioni e di altri utenti; missioni: chiavi e note del senior non leggibili, verifica dei passi solo sul caso collegato dell'utente, note sbloccate solo dopo il passo, run di altri utenti invisibili.

Con Docker si possono eseguire gli stessi file con il runner ufficiale: `npm run db:test`.

## 2. Unit test — `npm test`

```
Test Files  14 passed (14)
     Tests  143 passed (143)
```

Coperti: validazione/rilevamento/normalizzazione IOC e defang; guardia SSRF (IP privati, IPv6 locali, allow-list, credenziali, porte); parser email sui campioni formativi (SPF/DKIM/DMARC, Reply-To, Return-Path, link ingannevoli, IP, shortener, allegati a doppia estensione, BEC, header ripiegati); normalizzazione domini, anomalie DNS/RDAP, dati simulati; controlli upload (estensioni, magic bytes, dimensioni, nomi file); schemi Zod; fuso orario Europe/Rome; helper training (risposte ammesse, autovalutazione); builder PDF; integrità dei dataset formativi (risposte coerenti, pesi = 100, nessuna fuga delle soluzioni, solo domini/IP riservati); redirect sicuri e classificazione delle rotte; contenuti delle missioni (ogni passo ha la nota del senior, tecniche ATT&CK esistenti nel dataset, fonti citate per ogni dato, solo domini `.example` e IP di documentazione, campioni coerenti con i quiz).

## 3. Qualità e build

- `tsc --noEmit`: 0 errori
- `eslint`: 0 errori, 0 warning
- `next build`: completato, 30 rotte

## 4. Verifiche manuali eseguite

- Avvio in sviluppo senza Supabase configurato: la pagina di login mostra l'avviso di configurazione; le rotte protette reindirizzano a `/login`; tema scuro predefinito.

## 5. Progetto Supabase cloud (20/11/2026)

- Progetto `sentinel-intelligence` (ref `lrqytmvdabsfbfphahhk`, eu-central-1) creato; applicate le 8 migrazioni.
- Verifica: 22 tabelle pubbliche, tutte con RLS; 3 scenari formativi; 4 bucket privati.
- Security advisor: rimossi tutti gli avvisi `anon` con la migrazione `…100700_harden_function_grants`. Restano solo avvisi attesi: RPC applicative eseguibili da utenti autenticati (ognuna verifica il chiamante) e `training_answer_keys` senza policy (accesso negato per progetto).
- App avviata con `.env.local` puntato al progetto: login/signup raggiungibili, nessun errore server.

## 6. Non ancora verificato

- Flussi end-to-end nel browser con utente reale (registrazione, email di conferma, upload su Storage, signed URL, export e archiviazione PDF, interrogazioni DNS/RDAP reali).
- Comportamento su PostgreSQL 17 di Supabase (le migrazioni usano solo sintassi compatibile con PG 14+).

Checklist consigliata dopo la configurazione: registrazione → carica dati demo → crea caso → aggiungi attività/evento → carica evidenza e verifica integrità → registra IOC → analizza `example.com` e un dominio reale → analizza il campione "Falso corriere" e salva → crea report, esporta PDF, finalizza, nuova versione → completa un'esercitazione → esporta portfolio → con un secondo account verifica di non vedere nulla della prima organizzazione.
