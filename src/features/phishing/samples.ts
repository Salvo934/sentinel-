/**
 * Training samples for the Phishing Lab. Entirely fictitious: invented
 * brands, reserved domains (.example / example.com) and documentation IPs
 * (RFC 5737). No real organization or person is represented.
 */
export type PhishingSample = { key: string; label: string; scenario: string; raw: string };

const auth = (spf: string, dkim: string, dmarc: string, mailfrom: string, d: string, from: string) =>
  `Authentication-Results: mx.organizzazione.example;\n\tspf=${spf} smtp.mailfrom=${mailfrom};\n\tdkim=${dkim} header.d=${d};\n\tdmarc=${dmarc} header.from=${from}`;

export const PHISHING_SAMPLES: PhishingSample[] = [
  {
    key: "bank",
    label: "Phishing bancario",
    scenario: "Falsa comunicazione di Banca Aurora (fittizia) che segnala un accesso anomalo.",
    raw: `Received: from smtp.secure-aurorabank.example (unknown [203.0.113.21])
\tby mx.organizzazione.example with ESMTP; Mon, 16 Nov 2026 07:02:11 +0100
${auth("fail", "none", "fail", "alert@secure-aurorabank.example", "secure-aurorabank.example", "bancaaurora.example")}
From: "Banca Aurora - Sicurezza" <sicurezza@bancaaurora.example>
Reply-To: supporto@secure-aurorabank.example
Return-Path: <alert@secure-aurorabank.example>
To: cliente@organizzazione.example
Subject: Accesso sospetto: il tuo conto è stato sospeso
Date: Mon, 16 Nov 2026 07:02:05 +0100
Message-ID: <a81@secure-aurorabank.example>
Content-Type: text/html; charset=utf-8

<p>Gentile cliente, abbiamo rilevato un accesso anomalo. Il tuo conto è stato sospeso.</p>
<p>Per riattivarlo accedi immediatamente e conferma le tue credenziali:</p>
<a href="http://secure-aurorabank.example/login?ref=8812">https://www.bancaaurora.example/accesso</a>`,
  },
  {
    key: "fake-invoice",
    label: "Falsa fattura",
    scenario: "Fattura scaduta con richiesta di pagamento urgente e allegato.",
    raw: `Received: from mail.fatture-online-verifica.example (unknown [203.0.113.45])
\tby mx.organizzazione.example with ESMTP; Wed, 11 Nov 2026 09:41:00 +0100
${auth("fail", "none", "fail", "bounce@fatture-online-verifica.example", "fatture-online-verifica.example", "aurora-logistica.example")}
From: "Amministrazione Aurora" <amministrazione@aurora-logistica.example>
Reply-To: pagamenti@fatture-online-verifica.example
Return-Path: <bounce@fatture-online-verifica.example>
To: contabilita@organizzazione.example
Subject: URGENTE: Fattura n. 4471 scaduta
Date: Wed, 11 Nov 2026 09:40:51 +0100
Message-ID: <4471@fatture-online-verifica.example>
Content-Type: multipart/mixed; boundary="b1"

--b1
Content-Type: text/plain; charset=utf-8

Gentile cliente, la fattura n. 4471 risulta scaduta. Proceda al pagamento entro 24 ore tramite bonifico
all'IBAN indicato nel portale: https://fatture-online-verifica.example/login
--b1
Content-Type: application/zip; name="Fattura_4471.pdf.zip"
Content-Disposition: attachment; filename="Fattura_4471.pdf.zip"

[contenuto rimosso — campione sanitizzato]
--b1--`,
  },
  {
    key: "fake-courier",
    label: "Falso corriere",
    scenario: "Pacco in giacenza con richiesta di micro-pagamento (usato nell'esercitazione 3).",
    raw: `Received: from mail.spedirapido-tracking.example (unknown [198.51.100.77])
\tby mx.organizzazione.example with ESMTP id 4F2A1; Tue, 17 Nov 2026 08:14:03 +0100
Authentication-Results: mx.organizzazione.example;
\tspf=softfail (domain of transitioning bounce@bulkmail-sender.example does not designate 198.51.100.77 as permitted sender) smtp.mailfrom=bounce@bulkmail-sender.example;
\tdkim=fail header.d=bulkmail-sender.example;
\tdmarc=fail (p=none) header.from=spedirapido.example
From: "SpediRapido Notifiche" <notifiche@spedirapido.example>
Reply-To: assistenza@spedirapido-supporto.example
Return-Path: <bounce@bulkmail-sender.example>
To: dipendente@organizzazione.example
Subject: Il tuo pacco è in giacenza - azione richiesta entro 24 ore
Date: Tue, 17 Nov 2026 08:13:58 +0100
Message-ID: <8812.ab@bulkmail-sender.example>
Content-Type: multipart/mixed

Gentile cliente,
il tuo pacco non può essere consegnato per mancato pagamento delle spese di sdoganamento (1,99 EUR).
Paga ora entro 24 ore per evitare la restituzione al mittente:
<a href="http://spedirapido.tracking-update.example/pay?id=7781">https://www.spedirapido.example/traccia</a>

Allegato: Ricevuta_Spedizione.pdf.html`,
  },
  {
    key: "credential-harvest",
    label: "Furto di credenziali",
    scenario: "Falsa notifica di casella di posta piena con pagina di login clone.",
    raw: `Received: from vps-881.hosting-economico.example (unknown [198.51.100.140])
\tby mx.organizzazione.example with ESMTP; Thu, 19 Nov 2026 22:10:44 +0100
${auth("none", "none", "fail", "it-support@organizzazione-helpdesk.example", "organizzazione-helpdesk.example", "organizzazione.example")}
From: "IT Helpdesk organizzazione.example" <it-support@organizzazione-helpdesk.example>
To: dipendente@organizzazione.example
Subject: Ultimo avviso: la tua casella email ha superato la quota
Date: Thu, 19 Nov 2026 22:10:40 +0100
Message-ID: <q1@organizzazione-helpdesk.example>
Content-Type: text/html

<p>La tua casella ha raggiunto il 99% dello spazio. I nuovi messaggi verranno bloccati.</p>
<p>Accedi per aumentare la quota gratuitamente:</p>
<a href="https://bit.ly/3xQuota">Aumenta quota</a>
<a href="http://198.51.100.140/owa/login.php">Webmail aziendale</a>`,
  },
  {
    key: "bec",
    label: "Business Email Compromise",
    scenario: "Presunto amministratore delegato chiede un bonifico urgente e riservato.",
    raw: `Received: from mail.organizzazione.example (mail.organizzazione.example [192.0.2.10])
\tby mx.organizzazione.example with ESMTPS; Fri, 20 Nov 2026 16:55:02 +0100
${auth("pass", "pass", "pass", "g.ferri.ceo@organizzazione-mail.example", "organizzazione-mail.example", "organizzazione-mail.example")}
From: "Giulia Ferri (CEO)" <g.ferri.ceo@organizzazione-mail.example>
Reply-To: giulia.ferri.ceo@gmail.com
To: tesoreria@organizzazione.example
Subject: Operazione riservata - serve bonifico oggi
Date: Fri, 20 Nov 2026 16:54:58 +0100
Message-ID: <ceo-77@organizzazione-mail.example>
Content-Type: text/plain

Ciao, sono in riunione e non posso telefonare. Stiamo chiudendo un'acquisizione riservata:
devi disporre immediatamente un bonifico di 48.500 EUR al fornitore. Ti mando l'IBAN in risposta.
Non parlarne con nessuno fino all'annuncio. Grazie, Giulia`,
  },
  {
    key: "brand-impersonation",
    label: "Impersonificazione aziendale",
    scenario: "Dominio sosia di un fornitore che comunica un cambio di coordinate bancarie.",
    raw: `Received: from mx.velora-componenti.example.co (unknown [203.0.113.99])
\tby mx.organizzazione.example with ESMTP; Thu, 12 Nov 2026 11:20:00 +0100
${auth("pass", "pass", "none", "ufficio.acquisti@velora-cornponenti.example", "velora-cornponenti.example", "velora-cornponenti.example")}
From: "Velora Componenti - Ufficio Acquisti" <ufficio.acquisti@velora-cornponenti.example>
To: fornitori@organizzazione.example
Subject: Aggiornamento coordinate bancarie
Date: Thu, 12 Nov 2026 11:19:57 +0100
Message-ID: <iban-2026@velora-cornponenti.example>
Content-Type: text/plain

Gentile partner, a seguito di un cambio di istituto bancario vi chiediamo di aggiornare l'IBAN
per tutti i pagamenti futuri. Il nuovo IBAN è riportato nel modulo: https://velora-cornponenti.example/modulo-iban
Cordiali saluti, Ufficio Acquisti`,
  },

  // ---------------------------------------------------------------------------
  // Ricostruzioni didattiche dei "Casi reali": lo schema riproduce campagne
  // documentate da CERT-AGID/INPS/ACN, ma domini, IP e persone sono fittizi.
  // ---------------------------------------------------------------------------
  {
    key: "real-pagopa-multa",
    label: "Caso reale — Falso avviso PagoPA (multa)",
    scenario: "Ricostruzione didattica delle campagne a tema PagoPA/sanzioni stradali documentate dal CERT-AGID nel 2025. Domini fittizi.",
    raw: `Received: from mail.pagopa-sanzioni-servizi.example (unknown [203.0.113.140])
\tby mx.organizzazione.example with ESMTP; Mon, 16 Nov 2026 10:02:11 +0100
${auth("fail", "none", "fail", "avvisi@pagopa-sanzioni-servizi.example", "pagopa-sanzioni-servizi.example", "pagopa-avvisi.example")}
From: "PagoPA - Avvisi di Pagamento" <notifiche@pagopa-avvisi.example>
Reply-To: assistenza@pagopa-sanzioni-servizi.example
Return-Path: <avvisi@pagopa-sanzioni-servizi.example>
To: dipendente@organizzazione.example
Subject: Sollecito di pagamento relativo a sanzione stradale - ultimo avviso
Date: Mon, 16 Nov 2026 10:02:05 +0100
Message-ID: <sanz-88213@pagopa-sanzioni-servizi.example>
Content-Type: text/html; charset=utf-8

<p>Gentile contribuente, risulta non pagata la sanzione stradale n. 2026/88213 per un importo di 37,80 EUR.</p>
<p>Il pagamento deve essere effettuato entro 48 ore, altrimenti l'importo verrà maggiorato e trasmesso alla riscossione.</p>
<a href="https://pagopa-sanzioni-servizi.example/avviso?id=88213">Paga ora su pagopa.gov.it</a>`,
  },
  {
    key: "real-inps-sms",
    label: "Caso reale — Smishing INPS (documenti e selfie)",
    scenario: "Ricostruzione didattica dello smishing a tema INPS segnalato da CERT-AGID e INPS (2025-2026). SMS trascritto; dominio fittizio.",
    raw: `From: INPS (SMS)
To: +39 3XX XXX XXXX
Subject: [SMS trascritto]
Date: Tue, 11 Aug 2026 09:14:00 +0200

INPS: gentile utente, per evitare la sospensione del pagamento in corso e necessario aggiornare i tuoi dati entro 24 ore. Accedi qui: https://inps-aggiornamento-dati.example/verifica e carica documento e selfie.`,
  },
  {
    key: "real-malspam-ordine",
    label: "Caso reale — Malspam 'nuovo ordine' (infostealer)",
    scenario: "Ricostruzione didattica del malspam B2B a tema ordini/preventivi che distribuisce FormBook, Remcos o AgentTesla (CERT-AGID 2024-2025). Domini fittizi.",
    raw: `Received: from vps-77.hosting-rapido.example (unknown [198.51.100.61])
\tby mx.organizzazione.example with ESMTP; Wed, 18 Nov 2026 08:31:40 +0100
${auth("softfail", "none", "none", "sales@meccanica-forniture-srl.example", "meccanica-forniture-srl.example", "meccanica-forniture-srl.example")}
From: "Ufficio Vendite" <sales@meccanica-forniture-srl.example>
To: acquisti@organizzazione.example
Subject: Nuovo ordine PO-2026-0453 - conferma urgente
Date: Wed, 18 Nov 2026 08:31:35 +0100
Message-ID: <po0453@meccanica-forniture-srl.example>
Content-Type: multipart/mixed; boundary="b2"

--b2
Content-Type: text/plain; charset=utf-8

Buongiorno, in allegato il nuovo ordine PO-2026-0453 con quantita e prezzi.
Vi preghiamo di confermare urgentemente la disponibilita entro oggi.
Cordiali saluti, Ufficio Vendite
--b2
Content-Type: application/x-rar-compressed; name="PO-2026-0453.pdf.rar"
Content-Disposition: attachment; filename="PO-2026-0453.pdf.rar"

[contenuto rimosso — campione sanitizzato]
--b2--`,
  },
  {
    key: "real-pec-sollecito",
    label: "Caso reale — PEC compromessa con falso sollecito",
    scenario: "Ricostruzione didattica delle campagne via caselle PEC compromesse (Vidar, MintsLoader) documentate dal CERT-AGID. L'autenticazione passa perché la casella è reale ma compromessa. Domini fittizi.",
    raw: `Received: from smtps.pec-provider.example (smtps.pec-provider.example [192.0.2.25])
\tby mx.pec-organizzazione.example with ESMTPS; Thu, 19 Nov 2026 15:44:02 +0100
${auth("pass", "pass", "pass", "studio.verdi@pec-provider.example", "pec-provider.example", "pec-provider.example")}
From: "Per conto di: studio.verdi@pec-provider.example" <posta-certificata@pec-provider.example>
Reply-To: studio.verdi@pec-provider.example
To: amministrazione@pec-organizzazione.example
Subject: POSTA CERTIFICATA: Sollecito di pagamento fattura n. 1207
Date: Thu, 19 Nov 2026 15:44:00 +0100
Message-ID: <opec-1207@pec-provider.example>
Content-Type: text/plain; charset=utf-8

Gentile cliente,
con la presente si sollecita il pagamento della fattura in oggetto, scaduta. Per visualizzare la fattura e le coordinate di pagamento scaricare il documento al seguente link entro 24 ore:
https://documenti-condivisi-cloud.example/d/fattura_1207.zip
Distinti saluti`,
  },
  {
    key: "real-clickfix-corriere",
    label: "Caso reale — ClickFix con esca 'corriere'",
    scenario: "Ricostruzione didattica delle campagne ClickFix a tema spedizioni (es. falso supporto di un corriere) segnalate dal CERT-AGID. La pagina chiede di premere Win+R e incollare un comando. Domini fittizi.",
    raw: `Received: from mailer.spedizioni-assistenza.example (unknown [203.0.113.188])
\tby mx.organizzazione.example with ESMTP; Fri, 20 Nov 2026 11:05:20 +0100
${auth("none", "none", "fail", "support@spedizioni-assistenza.example", "spedizioni-assistenza.example", "corriere-espresso.example")}
From: "Supporto Corriere Espresso" <support@corriere-espresso.example>
Reply-To: support@spedizioni-assistenza.example
To: magazzino@organizzazione.example
Subject: La tua spedizione e bloccata - verifica richiesta
Date: Fri, 20 Nov 2026 11:05:15 +0100
Message-ID: <trk-55120@spedizioni-assistenza.example>
Content-Type: text/html; charset=utf-8

<p>La spedizione n. 5512077 non puo essere consegnata. Verifica l'indirizzo entro oggi per evitare la restituzione.</p>
<a href="https://verifica-spedizione-captcha.example/track?n=5512077">Traccia la spedizione su corriere-espresso.example</a>
<p>Per motivi di sicurezza ti verra chiesto di confermare di non essere un robot.</p>`,
  },
  {
    key: "real-mirax-sms",
    label: "Caso reale — Falso rimborso Agenzia Entrate e app IO",
    scenario: "Ricostruzione didattica della campagna Mirax (novembre 2026, riportata dalla stampa): falso sito dell'Agenzia delle Entrate e finto aggiornamento dell'app IO per Android. Il canale (SMS) è un'ipotesi didattica. Domini fittizi.",
    raw: `From: AgEntrate (SMS)
To: +39 3XX XXX XXXX
Subject: [SMS trascritto]
Date: Tue, 17 Nov 2026 18:22:00 +0100

Agenzia Entrate: ti spetta un rimborso fiscale di 248,60 EUR. Per riceverlo aggiorna subito l'app IO dal portale: https://agenziaentrate-rimborsi.example/io-aggiornamento`,
  },
];
