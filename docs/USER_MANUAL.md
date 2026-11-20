# Manuale utente

## Primo accesso
1. Registrati da **/signup** e conferma l'email. Viene creata la tua organizzazione personale (sei Administrator).
2. Vai in **Settings → Modalità demo → Carica dati demo** per esplorare la piattaforma con casi fittizi (etichetta "Demo"). Puoi rimuoverli in un clic.
3. Il tema scuro è predefinito; cambialo dall'icona in alto a destra.

## Principi di lavoro incorporati nello strumento
- **Fatti vs ipotesi**: ogni informazione ha uno stato — *Fatto verificato, Informazione da verificare, Ipotesi analitica, Informazione contraddittoria, Dato non disponibile*.
- **Affidabilità delle fonti** (scala Admiralty): A completamente affidabile … E inaffidabile, F non valutabile.
- **Data dell'evento ≠ data di acquisizione** nella timeline.
- **Reputazione delle fonti ≠ verdetto dell'analista** negli IOC.
- **Il rischio è un giudizio motivato**, non un punteggio automatico.
- Nessun link viene reso cliccabile, nessun allegato aperto, nessun sito target visitato.

## Dashboard
Indicatori (casi aperti/in lavorazione/chiusi, attività, IOC, minacce, report, esercitazioni), grafici per categoria, rischio, tipologia IOC e attività degli ultimi 30 giorni (dall'audit log). Il pulsante *Escludi dati demo* ricalcola tutto senza i dati simulati.

## Investigations
- **Nuovo caso**: titolo, tipologia (9 categorie), obiettivo, responsabile, stato, priorità, rischio, descrizione, note. Riceve un riferimento `SI-AAAA-NNNN`.
- **Elenco**: ricerca testuale, filtri per stato/tipologia/priorità, ordinamento. I casi archiviati compaiono filtrando per stato "Archiviato".
- **Dettaglio** (schede):
  - *Panoramica*: modifica dei dati; *Chiudi*, *Riapri*, *Archivia* (sola lettura), *Ripristina*, *Elimina definitivamente* (solo admin, solo casi archiviati).
  - *Attività*: crea, cambia stato, elimina.
  - *Evidenze*: elenco e collegamento al caricamento.
  - *Timeline*: eventi con data dell'evento e data di acquisizione, categoria, fonte, affidabilità, stato, evidenza collegata; filtri per categoria; modifica ed eliminazione.
  - *OSINT e IOC*: risultati e indicatori collegati.
  - *Report*: report del caso.
  - *Cronologia*: storico delle modifiche dall'audit log.

## Evidence Library
- **Nuova evidenza**: caso, titolo, tipologia, file facoltativo (pdf, txt, csv, json, eml, png, jpg, webp, docx, xlsx; max 20 MB), fonte, URL (solo testo), metodo e data di acquisizione, affidabilità, stato di verifica, note.
- Il server calcola lo **SHA-256**; file, percorso e hash non sono più modificabili.
- **Scarica**: link valido 60 secondi, sempre come download.
- **Verifica integrità**: ricalcola l'hash del file archiviato e registra l'esito nell'audit log.
- L'archivio supporta l'integrità ma **non** attesta da solo catena di custodia o validità probatoria.

## OSINT Workspace
Registra risultati con fonte, URL, data e ora di raccolta, metodo di acquisizione, dati ottenuti, affidabilità, stato dell'informazione, note di verifica e limitazioni; collegali a un caso. Filtra per caso, stato, affidabilità, testo. Gestisci il **registro delle fonti**. Le informazioni contraddittorie sono evidenziate.

## Threat Intelligence
Inserisci un indicatore: il tipo è rilevato automaticamente e il formato validato (accetta valori defanged). Assegna verdetto, confidenza, TLP, fonte, caso e note. I risultati di reputazione (in questa versione solo simulati nei dati demo) sono mostrati separatamente dal verdetto. Le integrazioni VirusTotal/OTX/NVD/MITRE sono pianificate per la Fase 2.

## Domain Analysis
Inserisci un dominio (anche un URL: viene estratto l'host). Il backend raccoglie **record A, AAAA, MX, NS, TXT, DMARC** e i **dati RDAP**, produce osservazioni automatiche (SPF permissivo, DMARC assente, registrazione recente, name server di parcheggio…) e mostra i collegamenti con casi esistenti.
- I domini riservati (`example.com`, `*.example`, `*.test`) restituiscono **dati simulati** etichettati.
- *Confronta due domini* affianca i risultati ed evidenzia le differenze.
- *Salva analisi* richiede livello di rischio e motivazione; ogni analisi salvata è esportabile in **PDF**.
- Limite: 10 interrogazioni al minuto; risultati in cache per 10 minuti; cronologia delle tue interrogazioni in fondo alla pagina.

## Phishing Lab
1. Incolla il sorgente, carica un `.eml`/`.txt` (max 1 MB) o scegli un'**email simulata** (bancario, falsa fattura, falso corriere, furto credenziali, BEC, impersonificazione aziendale).
2. **Analizza**: mittente/destinatario, Reply-To, Return-Path, risultati SPF/DKIM/DMARC, percorso Received, URL estratti in forma defanged con confronto testo/destinazione, allegati (mai aperti), elementi sospetti ordinati per gravità.
3. Formula **verdetto, confidenza e valutazione motivata**, collega un caso e, se vuoi, registra gli indicatori estratti nel registro IOC.

## Reports
1. *Nuovo report*: caso, tipologia (7), classificazione, titolo. Nasce come **bozza**; solo l'obiettivo del caso è precompilato.
2. Compila le sezioni (Executive Summary, Obiettivo, Metodologia, Analisi, Valutazione del rischio, Confidenza, Conclusioni, Raccomandazioni, Limitazioni, Allegati).
3. Gli **allegati** (fonti, evidenze con hash, risultati OSINT, IOC, cronologia, analisi collegate) sono generati dal database a ogni esportazione.
4. **Esporta PDF**: scarica il file e lo archivia nel bucket privato. Le sezioni vuote sono indicate come non compilate.
5. **Finalizza versione**: la versione diventa immutabile; per correggere usa **Nuova versione**.

## Training Academy
- Scegli un'esercitazione: scenario, briefing, obiettivo, documenti/dataset, attività, strumenti, istruzioni, tempo indicativo, griglia di valutazione.
- **Inizia** → rispondi alle domande, scrivi la consegna, autovaluta la griglia; *Salva bozza* in qualsiasi momento.
- **Consegna**: il database corregge le domande e sblocca **feedback e soluzione guidata**. Puoi ripetere l'esercitazione.
- **Esporta portfolio PDF**: miglior tentativo per esercitazione con competenze ed elaborati.
- I punteggi sono formativi, non certificazioni.

## Settings
Profilo (nome, tema, password), nome dell'organizzazione (admin), membri e ruoli (admin: aggiunta per email di utenti già registrati, cambio ruolo — almeno un admin resta sempre), modalità demo, stato delle integrazioni.
