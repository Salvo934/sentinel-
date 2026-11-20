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
];
