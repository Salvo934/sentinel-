# Limiti, funzioni non ancora sviluppate e verifiche manuali

## Richiede configurazione o verifica manuale
- **Progetto Supabase**: creazione, applicazione migrazioni (`supabase db push`), URL e publishable key in `.env.local`.
- **Auth**: Site URL (`http://localhost:3000`) e Redirect URLs (`localhost`/`127.0.0.1:3000/**`) già configurati sul progetto `sentinel-intelligence`. I template email personalizzati `supabase/templates/*.html` richiedono un **SMTP personalizzato** (Supabase non permette di modificarli con il servizio email integrato): finché non è configurato si usano i template predefiniti, gestiti da `/auth/confirm` tramite `code` — il link di conferma/recupero va aperto nello stesso browser in cui è stata fatta la richiesta. Il servizio email integrato invia solo agli indirizzi dei membri dell'organizzazione Supabase e con limiti bassi.
- **Primo amministratore di piattaforma**: query SQL nel README (serve solo per `training-datasets`).
- **Test end-to-end** nel browser: non eseguiti in questa sessione (vedi docs/TESTING.md §5).

## Funzioni pianificate (non presenti)
| Fase | Funzione |
|---|---|
| 2 | Integrazioni VirusTotal, AlienVault OTX, NVD (CVE); ATT&CK: software/malware, campagne e matrici Mobile/ICS (Enterprise già integrato); metadati TLS via Certificate Transparency; Report CTI dedicato con IOC arricchiti |
| 3 | Investigation Graph con React Flow (tabelle `investigation_entities` / `entity_relationships` già pronte), esportazione grafi, filtri investigativi avanzati |
| 4 | Risk Assessment con matrice 5×5 configurabile e report di rischio (tabella `risk_assessments` già pronta); esercitazioni 4 (CTI) e 5 (Risk Assessment) |
| 5 | AI Investigation Assistant (disattivabile, solo lato server) |

## Limiti noti dell'MVP
- **MITRE ATT&CK**: descrizioni tecniche in inglese (originale MITRE); aggiornamento del dataset manuale (docs/ATTACK.md); i suggerimenti si basano su regole semplici e vanno sempre verificati.
- **Report**: PDF generati nel browser con font standard (caratteri fuori da Windows-1252 sostituiti); impaginazione semplice.
- **Domain Analysis**: dominio registrabile calcolato senza la Public Suffix List completa; cache per istanza server (non condivisa); il controllo SSRF verifica l'IP prima della richiesta ma una finestra di DNS rebinding resta teoricamente possibile (mitigata da allow-list/`rdap.*` e solo HTTPS); i server RDAP fuori allow-list sono ammessi solo se il nome inizia con `rdap.`.
- **Phishing Lab**: parser semplificato (nessuna decodifica MIME/base64/quoted-printable, nessuna verifica crittografica DKIM: si leggono i risultati scritti dal server ricevente).
- **Evidenze**: se il salvataggio del record fallisce dopo l'upload, il file può restare orfano (solo gli admin possono cancellare oggetti); nessuna scansione antivirus; anteprima dei file non disponibile (solo download).
- **Missioni e casi reali**: i dati del dossier provengono da fonti pubbliche alla data indicata e non si aggiornano da soli; alcune cifre derivano da fonti secondarie (indicate) e vanno verificate sulla fonte primaria; i materiali sono ricostruzioni didattiche con dati fittizi, non campioni reali; i contenuti nuovi si aggiungono in `supabase/seed/missions/` e si rigenerano con `node scripts/build-missions-migration.mjs`; la verifica dei passi controlla che il lavoro esista, non ne giudica la qualità (per questo c'è la nota del senior).
- **Training**: correzione automatica solo per domande chiuse e parole chiave; l'elaborato è autovalutato con la griglia.
- **Membri**: aggiunta solo di utenti già registrati (nessun sistema di inviti via email); nessun selettore se l'utente appartiene a più organizzazioni (si usa la prima).
- **Sicurezza**: Content-Security-Policy con nonce non ancora configurata; rate limiting applicato alle interrogazioni di rete, non a tutte le azioni; conservazione dei dati (retention) documentata ma non automatizzata.
- **Tipi TypeScript del database** non generati (manca un'istanza Supabase): eseguire `npm run db:types` e tipizzare i client.
- **Realtime / Edge Functions**: non utilizzati in Fase 1 (non necessari per un singolo utilizzatore); da valutare per le integrazioni della Fase 2.
- **Validità probatoria**: l'archivio supporta integrità e tracciabilità, ma non garantisce da solo i requisiti di catena di custodia forense o di ammissibilità in giudizio.
