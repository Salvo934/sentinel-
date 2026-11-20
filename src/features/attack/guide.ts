/**
 * Italian guide to the ATT&CK Enterprise tactics (v20).
 * Written for junior analysts: what the adversary is trying to achieve,
 * what it looks like in practice, and what an analyst should look for.
 * Original MITRE descriptions are shown alongside, in English.
 */
export type TacticGuide = {
  shortname: string;
  title: string;
  goal: string;
  examples: string[];
  analyst: string[];
};

export const TACTIC_GUIDE: Record<string, TacticGuide> = {
  reconnaissance: {
    shortname: "reconnaissance",
    title: "Ricognizione",
    goal: "L'attaccante raccoglie informazioni sul bersaglio per pianificare l'operazione: persone, domini, tecnologie, fornitori.",
    examples: [
      "Ricerca dei dipendenti e dei loro ruoli su siti e profili pubblici",
      "Enumerazione di domini, sottodomini e servizi esposti",
      "Raccolta di indirizzi email per una campagna di phishing",
    ],
    analyst: [
      "È la fase più difficile da osservare: avviene spesso fuori dal perimetro",
      "Valuta l'esposizione OSINT dell'organizzazione (cosa può vedere un attaccante?)",
      "Collega eventuali scansioni o richieste anomale ai casi aperti",
    ],
  },
  "resource-development": {
    shortname: "resource-development",
    title: "Sviluppo delle risorse",
    goal: "L'attaccante prepara l'infrastruttura e gli strumenti: domini, server, account, malware, certificati.",
    examples: [
      "Registrazione di un dominio sosia del brand (typosquatting)",
      "Creazione di account email o social falsi",
      "Acquisto di VPS o compromissione di siti legittimi da usare come appoggio",
    ],
    analyst: [
      "Domini registrati di recente e simili al brand sono un segnale precoce",
      "Monitora i log di Certificate Transparency per il nome dell'organizzazione",
      "Usa Domain Analysis: età del dominio, SPF/DMARC, name server",
    ],
  },
  "initial-access": {
    shortname: "initial-access",
    title: "Accesso iniziale",
    goal: "L'attaccante cerca di entrare nella rete o negli account dell'organizzazione.",
    examples: [
      "Phishing con link o allegato malevolo",
      "Sfruttamento di un servizio esposto non aggiornato",
      "Uso di credenziali valide rubate o acquistate",
    ],
    analyst: [
      "È la tattica più frequente nei casi di phishing: analizza header, link e allegati",
      "Distingui il tentativo (email ricevuta) dall'accesso riuscito (evidenze di login o esecuzione)",
      "Documenta il vettore con evidenze: è la base della timeline dell'incidente",
    ],
  },
  execution: {
    shortname: "execution",
    title: "Esecuzione",
    goal: "L'attaccante esegue codice o comandi malevoli su un sistema.",
    examples: [
      "L'utente apre un allegato che avvia uno script",
      "Uso di PowerShell, interpreti di comandi o macro",
      "Esecuzione tramite attività pianificate o servizi",
    ],
    analyst: [
      "Cerca la catena processo padre → processo figlio (es. client email → interprete di script)",
      "Non aprire mai gli allegati sospetti: documenta nome, hash e contesto",
    ],
  },
  persistence: {
    shortname: "persistence",
    title: "Persistenza",
    goal: "L'attaccante vuole mantenere l'accesso anche dopo riavvii, cambi di password o interruzioni.",
    examples: [
      "Creazione di account o chiavi di accesso aggiuntive",
      "Regole di inoltro della posta verso indirizzi esterni",
      "Attività pianificate o chiavi di avvio automatico",
    ],
    analyst: [
      "Dopo un accesso riuscito, verifica sempre account, regole email e attività create di recente",
      "Una bonifica senza rimuovere la persistenza lascia l'attaccante dentro",
    ],
  },
  "privilege-escalation": {
    shortname: "privilege-escalation",
    title: "Escalation dei privilegi",
    goal: "L'attaccante cerca permessi più elevati (amministratore, sistema, ruoli cloud).",
    examples: ["Sfruttamento di vulnerabilità locali", "Abuso di configurazioni errate", "Uso di account privilegiati compromessi"],
    analyst: ["Valuta quali privilegi aveva l'account compromesso e quali ha ottenuto", "Molte tecniche condividono persistenza ed escalation"],
  },
  stealth: {
    shortname: "stealth",
    title: "Occultamento",
    goal: "L'attaccante nasconde le proprie azioni facendole sembrare attività normali.",
    examples: [
      "Nomi di file o processi che imitano quelli legittimi",
      "Impersonificazione di persone o organizzazioni fidate",
      "Offuscamento di file e comandi",
    ],
    analyst: [
      "L'assenza di allarmi non significa assenza di attività",
      "Confronta ciò che appare (nome visualizzato, testo del link) con ciò che è (indirizzo reale, destinazione)",
    ],
  },
  "defense-impairment": {
    shortname: "defense-impairment",
    title: "Compromissione delle difese",
    goal: "L'attaccante disattiva o altera gli strumenti di sicurezza per non essere visto.",
    examples: ["Disattivazione dell'antivirus o dell'EDR", "Cancellazione o manipolazione dei log", "Modifica delle regole del firewall"],
    analyst: ["Log mancanti o interrotti sono essi stessi un indicatore", "Verifica l'integrità delle fonti di log prima di trarre conclusioni"],
  },
  "credential-access": {
    shortname: "credential-access",
    title: "Accesso alle credenziali",
    goal: "L'attaccante ruba nomi utente, password, token o codici.",
    examples: ["Pagine di login clonate (credential harvesting)", "Keylogger o dump della memoria", "Intercettazione di token di sessione"],
    analyst: [
      "Se un utente ha inserito credenziali su una pagina sospetta, consideralo un incidente: reset e verifica degli accessi",
      "Collega le pagine di raccolta credenziali agli IOC (URL, domini)",
    ],
  },
  discovery: {
    shortname: "discovery",
    title: "Scoperta",
    goal: "Una volta dentro, l'attaccante esplora l'ambiente: utenti, sistemi, condivisioni, configurazioni.",
    examples: ["Enumerazione di utenti e gruppi", "Ricerca di file e condivisioni di rete", "Scansione della rete interna"],
    analyst: ["Picchi di comandi di enumerazione da un singolo account sono anomali", "Indica che l'attaccante si sta orientando: la fase successiva è spesso il movimento laterale"],
  },
  "lateral-movement": {
    shortname: "lateral-movement",
    title: "Movimento laterale",
    goal: "L'attaccante si sposta da un sistema all'altro per raggiungere il suo obiettivo.",
    examples: ["Desktop remoto con credenziali rubate", "Phishing interno da una casella compromessa", "Condivisioni amministrative"],
    analyst: ["Ricostruisci la sequenza dei sistemi toccati nella timeline del caso", "Un'email interna può essere un vettore: non fidarti solo del mittente"],
  },
  collection: {
    shortname: "collection",
    title: "Raccolta",
    goal: "L'attaccante raccoglie i dati di interesse prima di portarli fuori.",
    examples: ["Raccolta di email e documenti", "Archiviazione e compressione dei dati", "Acquisizioni di schermo"],
    analyst: ["Archivi compressi creati in posizioni insolite sono un segnale", "Identifica quali dati sono stati toccati: serve per la valutazione d'impatto"],
  },
  "command-and-control": {
    shortname: "command-and-control",
    title: "Comando e controllo",
    goal: "L'attaccante comunica con i sistemi compromessi per impartire istruzioni.",
    examples: ["Traffico web verso server dell'attaccante", "Uso di servizi cloud legittimi come canale", "DNS come canale nascosto"],
    analyst: ["Gli IOC di rete (IP, domini) si collegano spesso a questa tattica", "La reputazione delle fonti aiuta, ma la valutazione finale resta dell'analista"],
  },
  exfiltration: {
    shortname: "exfiltration",
    title: "Esfiltrazione",
    goal: "L'attaccante porta fuori i dati dall'organizzazione.",
    examples: ["Caricamento su servizi di archiviazione cloud", "Invio tramite il canale di comando e controllo", "Regole di inoltro email"],
    analyst: ["Volumi di traffico in uscita anomali o verso destinazioni nuove", "Determina cosa è uscito, quando e verso dove: ha rilevanza legale (es. data breach)"],
  },
  impact: {
    shortname: "impact",
    title: "Impatto",
    goal: "L'attaccante manipola, interrompe o distrugge sistemi e dati, oppure ottiene un vantaggio economico.",
    examples: ["Ransomware (cifratura dei dati)", "Frodi di pagamento e Business Email Compromise", "Interruzione di servizi"],
    analyst: ["È ciò che l'organizzazione percepisce come incidente: collegalo alle fasi precedenti", "Nel BEC l'impatto è finanziario anche senza malware"],
  },
};

export const ATTACK_HOW_TO = [
  {
    title: "Tattica = il perché",
    text: "Le colonne della matrice sono le tattiche: l'obiettivo dell'attaccante in quel momento (entrare, restare, muoversi, rubare dati…).",
  },
  {
    title: "Tecnica = il come",
    text: "Ogni cella è una tecnica: il modo in cui l'obiettivo viene raggiunto. Le sotto-tecniche ne descrivono varianti più specifiche (es. T1566.002 Spearphishing Link).",
  },
  {
    title: "Dall'evidenza alla tecnica",
    text: "Mappa una tecnica su un caso solo se un'evidenza la supporta. Se è una deduzione, etichettala come ipotesi: ATT&CK descrive comportamenti osservati, non sospetti.",
  },
  {
    title: "A cosa serve",
    text: "Parlare la stessa lingua di SOC e CTI, confrontare casi diversi, capire quali difese (mitigazioni) e quali rilevamenti contano davvero.",
  },
];
