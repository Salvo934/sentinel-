# Modulo MITRE ATT&CK

Sentinel integra la base di conoscenza **MITRE ATT&CK® Enterprise** per aiutare a capire *come* operano gli attaccanti e a dare un nome condiviso ai comportamenti osservati nei casi.

> © The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation. MITRE ATT&CK® is a registered trademark of The MITRE Corporation.

## Cosa offre

| Funzione | Dove | A cosa serve |
|---|---|---|
| **Matrice** con ricerca (ID, nome, descrizioni), filtro per piattaforma e **heatmap** dei casi | `/attack` | Vedere il quadro d'insieme e le tecniche già osservate nella tua organizzazione |
| **Tattiche spiegate** in italiano | `/attack?view=tactics` | Per ognuna delle 15 tattiche: obiettivo dell'attaccante, esempi concreti, cosa fa l'analista |
| **Scheda tecnica** | `/attack/T1566.002` | Fase dell'attacco, descrizione MITRE con link interni, sotto-tecniche, **mitigazioni**, **come rilevarla** (strategie e analisi per piattaforma), gruppi che la usano, casi in cui è mappata |
| **Gruppi di minaccia** | `/attack?view=groups`, `/attack/groups/G0007` | Profilo degli attori documentati e tecniche per tattica, con avvertenza sull'attribuzione |
| **Mappatura sui casi** | Caso → scheda *ATT&CK* | Tecniche del caso ordinate lungo le fasi dell'attacco, con stato (fatto/ipotesi), confidenza, evidenza a supporto, osservazione |
| **Suggerimenti automatici** | Phishing Lab, Domain Analysis | Ipotesi motivate (es. T1566.002, T1684.001, T1583.001) da confermare, mappabili sul caso con un clic |
| **Report** | Allegato "Tecniche MITRE ATT&CK" | Le tecniche del caso entrano nel PDF con stato e confidenza |
| **Dashboard** | "Tecniche più osservate" | Le tecniche più ricorrenti nei casi |

### Principi
- Una tecnica è **fatto verificato** solo con un'evidenza; altrimenti è **ipotesi** (valore predefinito).
- I suggerimenti spiegano sempre il motivo e non vengono mai salvati automaticamente.
- Le tecniche in comune con un gruppo **non** bastano ad attribuire un caso.
- Le descrizioni MITRE restano in inglese (testo originale); la guida alle tattiche è in italiano. I link esterni delle fonti non vengono resi cliccabili.

## Dati

- Versione caricata: **Enterprise ATT&CK 20.1** (5 novembre 2026): 15 tattiche, 706 tecniche (479 sotto-tecniche), 44 mitigazioni, 178 gruppi, 1.477 collegamenti tecnica-mitigazione, 4.815 collegamenti gruppo-tecnica, 706 strategie di rilevamento.
- Tabelle `attack_*`: in sola lettura via API per gli utenti autenticati. `case_attack_techniques` segue l'RLS del caso ed è registrata nell'audit log.
- Non importati (per ora): software/malware, campagne, matrici Mobile e ICS.

## Aggiornare a una nuova versione di ATT&CK

```bash
mkdir -p /tmp/attack
curl -sSL -o /tmp/attack/enterprise-attack.json \
  https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json
python3 -I scripts/attack/build-attack-dataset.py /tmp/attack/enterprise-attack.json
npm run deploy                       # pubblica public/data/mitre-attack-enterprise.json
```

Poi, nell'SQL Editor di Supabase (ruolo `postgres`):

```sql
create extension if not exists http with schema extensions;
select public.load_attack_bundle(
  (extensions.http_get('https://sentinel-intelligence.salvo-bonavita9808.workers.dev/data/mitre-attack-enterprise.json')).content::jsonb
);
```

Il caricamento fa upsert di tecniche, tattiche, mitigazioni e gruppi e ricostruisce le tabelle di relazione; le mappature sui casi restano intatte. Se una nuova versione revoca una tecnica già mappata su un caso, la tecnica resta nel database (vincolo `on delete restrict`).

## Test
- `supabase/tests/03_attack.sql` (13 asserzioni): dati di riferimento in sola lettura, loader non invocabile via API, isolamento delle mappature, conteggi della heatmap, audit, dati demo.
- `tests/unit/attack.test.tsx`: integrità del dataset, guida italiana per ogni tattica, suggerimenti solo con ID esistenti nella release caricata, rendering sicuro delle descrizioni.
