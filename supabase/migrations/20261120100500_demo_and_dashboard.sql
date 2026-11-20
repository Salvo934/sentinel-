-- =============================================================================
-- Sentinel Intelligence — 006 Demo mode and dashboard statistics
--
-- Demo data is entirely fictitious: invented organizations, reserved
-- documentation domains (RFC 2606 / RFC 6761: example.com, *.example, *.test)
-- and documentation IP ranges (RFC 5737: 192.0.2.0/24, 198.51.100.0/24,
-- 203.0.113.0/24; RFC 3849: 2001:db8::/32). Every row is flagged is_demo so
-- it can be filtered out and removed with one call.
-- =============================================================================

create function public.seed_demo_data(p_org uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_src_dns uuid; v_src_reg uuid; v_src_news uuid; v_src_ct uuid;
  v_case_osint uuid; v_case_phish uuid; v_case_domain uuid; v_case_cti uuid;
  v_ev1 uuid; v_ev2 uuid; v_ev3 uuid;
  v_ioc uuid;
begin
  if not public.has_org_role(p_org, array['admin']::public.org_role[]) then
    raise exception 'only organization admins can load demo data' using errcode = '42501';
  end if;
  if exists (select 1 from public.cases where organization_id = p_org and is_demo) then
    raise exception 'demo data already loaded' using errcode = '23505';
  end if;

  -- Sources --------------------------------------------------------------------
  insert into public.osint_sources (organization_id, name, source_type, url, description, default_reliability, is_demo)
  values (p_org, '[DEMO] Resolver DNS pubblico', 'dns', null, 'Interrogazioni DNS simulate su domini di documentazione.', 'B', true)
  returning id into v_src_dns;
  insert into public.osint_sources (organization_id, name, source_type, url, description, default_reliability, is_demo)
  values (p_org, '[DEMO] Registro imprese fittizio', 'public_registry', 'https://registro.example', 'Registro societario immaginario usato per le esercitazioni.', 'A', true)
  returning id into v_src_reg;
  insert into public.osint_sources (organization_id, name, source_type, url, description, default_reliability, is_demo)
  values (p_org, '[DEMO] Testata giornalistica locale', 'news_media', 'https://notizie.example', 'Fonte giornalistica fittizia.', 'C', true)
  returning id into v_src_news;
  insert into public.osint_sources (organization_id, name, source_type, url, description, default_reliability, is_demo)
  values (p_org, '[DEMO] Log Certificate Transparency', 'certificate_transparency', null, 'Estratto simulato di log CT.', 'B', true)
  returning id into v_src_ct;

  -- Cases ----------------------------------------------------------------------
  insert into public.cases (organization_id, title, description, objective, category, status, priority, risk_level, assigned_to, is_demo, opened_at)
  values (p_org, '[DEMO] Due diligence su Aurora Logistica S.r.l.',
          'Verifica reputazionale e societaria di un potenziale fornitore (società fittizia).',
          'Accertare coerenza tra dati societari dichiarati e fonti aperte; individuare incongruenze.',
          'corporate_due_diligence', 'in_progress', 'medium', 'medium', v_uid, true, now() - interval '12 days')
  returning id into v_case_osint;

  insert into public.cases (organization_id, title, description, objective, category, status, priority, risk_level, assigned_to, is_demo, opened_at)
  values (p_org, '[DEMO] Campagna phishing "fattura scaduta"',
          'Segnalazione di email sospette ricevute dall''ufficio amministrazione (scenario simulato).',
          'Determinare se le email sono malevole, estrarre gli indicatori e proporre contromisure.',
          'phishing_investigation', 'open', 'high', 'high', v_uid, true, now() - interval '5 days')
  returning id into v_case_phish;

  insert into public.cases (organization_id, title, description, objective, category, status, priority, risk_level, assigned_to, is_demo, opened_at)
  values (p_org, '[DEMO] Dominio sosia aurora-logistica-pagamenti.example',
          'Possibile dominio di impersonificazione del brand rilevato nei log CT simulati.',
          'Valutare la natura del dominio e il rischio di brand impersonation.',
          'brand_impersonation', 'open', 'high', 'high', v_uid, true, now() - interval '3 days')
  returning id into v_case_domain;

  insert into public.cases (organization_id, title, description, objective, category, status, priority, risk_level, assigned_to, is_demo, opened_at, closed_at)
  values (p_org, '[DEMO] Brief CTI: infrastruttura "GreyHeron" (fittizia)',
          'Analisi di un gruppo di minaccia immaginario a partire da un dataset formativo.',
          'Correlare gli IOC e produrre un Intelligence Brief.',
          'cyber_threat_intelligence', 'closed', 'medium', 'medium', v_uid, true, now() - interval '30 days', now() - interval '20 days')
  returning id into v_case_cti;

  -- Tasks ----------------------------------------------------------------------
  insert into public.case_tasks (case_id, title, status, due_at) values
    (v_case_osint, 'Verificare visura nel registro imprese', 'done', now() - interval '8 days'),
    (v_case_osint, 'Confrontare sede legale dichiarata e fonti aperte', 'in_progress', now() + interval '2 days'),
    (v_case_osint, 'Redigere report di due diligence', 'todo', now() + interval '6 days'),
    (v_case_phish, 'Analizzare gli header delle email segnalate', 'in_progress', now() + interval '1 day'),
    (v_case_phish, 'Estrarre e classificare gli URL', 'todo', now() + interval '2 days'),
    (v_case_domain, 'Raccogliere record DNS e RDAP del dominio sosia', 'todo', now() + interval '3 days');

  -- Evidence (descriptive only: no files are attached in demo mode) -----------
  insert into public.evidence (case_id, title, description, evidence_type, source, acquisition_method, reliability, verification_status, notes, is_demo, collected_at, metadata)
  values (v_case_osint, '[DEMO] Visura camerale fittizia', 'Estratto testuale della visura della società fittizia Aurora Logistica S.r.l.',
          'document', '[DEMO] Registro imprese fittizio', 'Consultazione manuale del registro (simulata)', 'A', 'verified_fact',
          'Nessun file allegato: evidenza dimostrativa.', true, now() - interval '10 days', '{"demo": true}')
  returning id into v_ev1;
  insert into public.evidence (case_id, title, description, evidence_type, source, acquisition_method, reliability, verification_status, notes, is_demo, collected_at, metadata)
  values (v_case_osint, '[DEMO] Articolo su cambio sede', 'Articolo che riporta il trasferimento della sede a Verona nel 2024.',
          'web_capture', '[DEMO] Testata giornalistica locale', 'Lettura articolo (simulata)', 'C', 'contradictory',
          'Contrasta con la visura (sede a Padova).', true, now() - interval '9 days', '{"demo": true}')
  returning id into v_ev2;
  insert into public.evidence (case_id, title, description, evidence_type, source, acquisition_method, reliability, verification_status, is_demo, collected_at, metadata)
  values (v_case_phish, '[DEMO] Email "Fattura n. 4471 scaduta"', 'Messaggio segnalato dall''ufficio amministrazione, sanitizzato.',
          'email', 'Segnalazione interna (simulata)', 'Esportazione .eml sanitizzata', 'B', 'verified_fact', true, now() - interval '5 days', '{"demo": true}')
  returning id into v_ev3;

  -- OSINT findings ---------------------------------------------------------------
  insert into public.osint_findings (organization_id, case_id, source_id, title, subject, source_name, source_url, collected_at, acquisition_method, data, reliability, info_status, verification_notes, limitations, is_demo) values
    (p_org, v_case_osint, v_src_reg, 'Sede legale registrata a Padova', 'Aurora Logistica S.r.l.', '[DEMO] Registro imprese fittizio', 'https://registro.example/aurora',
     now() - interval '10 days', 'Consultazione registro pubblico', 'Sede legale: Via dei Mille 10, Padova (PD). Costituita nel 2015. Amministratore unico: persona fittizia "M. Rossi".',
     'A', 'verified_fact', 'Dato letto direttamente dalla fonte primaria.', 'Il registro fittizio non riporta le unità locali.', true),
    (p_org, v_case_osint, v_src_news, 'Notizia di trasferimento a Verona', 'Aurora Logistica S.r.l.', '[DEMO] Testata giornalistica locale', 'https://notizie.example/aurora-verona',
     now() - interval '9 days', 'Ricerca su fonte giornalistica', 'L''articolo afferma che la società ha trasferito la sede a Verona nel marzo 2024.',
     'C', 'contradictory', 'In contrasto con il registro. Possibile unità operativa e non sede legale.', 'Articolo non firmato; data di pubblicazione non verificabile.', true),
    (p_org, v_case_osint, null, 'Ipotesi: unità locale non dichiarata', 'Aurora Logistica S.r.l.', 'Valutazione dell''analista', null,
     now() - interval '8 days', 'Inferenza analitica', 'La discrepanza potrebbe dipendere da un magazzino operativo a Verona non ancora registrato.',
     'F', 'hypothesis', null, 'Ipotesi da verificare con richiesta documentale al fornitore.', true),
    (p_org, v_case_domain, v_src_ct, 'Certificato emesso per dominio sosia', 'aurora-logistica-pagamenti.example', '[DEMO] Log Certificate Transparency', null,
     now() - interval '3 days', 'Consultazione log CT (simulata)', 'Certificato DV emesso 2 giorni dopo la registrazione del dominio; SAN: aurora-logistica-pagamenti.example, www.aurora-logistica-pagamenti.example.',
     'B', 'to_verify', null, 'Dato simulato a scopo formativo.', true);

  -- IOC -----------------------------------------------------------------------------
  insert into public.ioc_indicators (organization_id, case_id, indicator_type, indicator_value, source, confidence, analyst_verdict, analyst_notes, is_demo) values
    (p_org, v_case_phish, 'domain', 'fatture-online-verifica.example', 'Header email (Return-Path)', 'moderate', 'suspicious', 'Dominio non collegato al mittente dichiarato.', true),
    (p_org, v_case_phish, 'url', 'hxxps://fatture-online-verifica.example/login', 'Corpo email', 'moderate', 'malicious', 'Pagina di raccolta credenziali (simulata).', true),
    (p_org, v_case_phish, 'ipv4', '203.0.113.45', 'Header Received', 'low', 'suspicious', 'Indirizzo di documentazione RFC 5737.', true),
    (p_org, v_case_domain, 'domain', 'aurora-logistica-pagamenti.example', 'Log CT', 'moderate', 'suspicious', null, true),
    (p_org, v_case_cti, 'ipv4', '198.51.100.23', 'Dataset formativo GreyHeron', 'moderate', 'malicious', null, true),
    (p_org, v_case_cti, 'ipv6', '2001:db8:85a3::8a2e:370:7334', 'Dataset formativo GreyHeron', 'low', 'undetermined', null, true),
    (p_org, v_case_cti, 'sha256', encode(sha256(convert_to('sentinel-demo-greyheron-loader', 'UTF8')), 'hex'), 'Dataset formativo GreyHeron', 'high', 'malicious', 'Hash fittizio generato per l''esercitazione.', true),
    (p_org, v_case_cti, 'md5', md5('sentinel-demo-greyheron-dropper'), 'Dataset formativo GreyHeron', 'moderate', 'suspicious', 'Hash fittizio.', true);

  select id into v_ioc from public.ioc_indicators where organization_id = p_org and indicator_value = '198.51.100.23';
  insert into public.ioc_analysis_results (indicator_id, provider, data_mode, result) values
    (v_ioc, 'demo-reputation', 'simulated', '{"detections": 7, "engines": 70, "first_seen": "2026-09-02", "tags": ["c2", "demo"]}'),
    (v_ioc, 'demo-passive-dns', 'simulated', '{"resolutions": ["cdn-update.greyheron.example", "sync.greyheron.example"]}');

  -- Timeline ---------------------------------------------------------------------------
  insert into public.investigation_events (case_id, title, description, category, source, reliability, info_status, event_at, recorded_at, evidence_id) values
    (v_case_osint, 'Costituzione della società', 'Data di costituzione riportata dal registro.', 'corporate', '[DEMO] Registro imprese fittizio', 'A', 'verified_fact', '2015-04-14 09:00+02', now() - interval '10 days', v_ev1),
    (v_case_osint, 'Presunto trasferimento sede a Verona', 'Secondo l''articolo di stampa.', 'corporate', '[DEMO] Testata giornalistica locale', 'C', 'contradictory', '2024-03-01 09:00+01', now() - interval '9 days', v_ev2),
    (v_case_phish, 'Ricezione prima email sospetta', 'Email "Fattura n. 4471 scaduta" ricevuta da amministrazione.', 'communication', 'Segnalazione interna', 'B', 'verified_fact', now() - interval '6 days', now() - interval '5 days', v_ev3),
    (v_case_domain, 'Registrazione dominio sosia', 'Data di registrazione riportata dai dati RDAP simulati.', 'infrastructure', 'RDAP (simulato)', 'B', 'to_verify', now() - interval '20 days', now() - interval '3 days', null);

  -- Phishing analysis -------------------------------------------------------------------
  insert into public.phishing_analyses (organization_id, case_id, title, input_mode, sample_key, raw_message, parsed, indicators, verdict, confidence, analyst_assessment, is_demo)
  values (p_org, v_case_phish, '[DEMO] Fattura n. 4471 scaduta', 'training_sample', 'fake-invoice',
    'From: "Amministrazione Aurora" <amministrazione@aurora-logistica.example>' || chr(10) ||
    'Reply-To: pagamenti@fatture-online-verifica.example' || chr(10) ||
    'Return-Path: <bounce@fatture-online-verifica.example>' || chr(10) ||
    'Subject: URGENTE: Fattura n. 4471 scaduta' || chr(10) ||
    'Authentication-Results: mx.example; spf=fail smtp.mailfrom=fatture-online-verifica.example; dkim=none; dmarc=fail header.from=aurora-logistica.example' || chr(10) || chr(10) ||
    'Gentile cliente, la fattura risulta scaduta. Verifichi entro 24 ore: https://fatture-online-verifica.example/login',
    '{"demo": true}', '[]', 'malicious', 'high',
    'SPF e DMARC falliscono, Reply-To e Return-Path puntano a un dominio diverso dal mittente, linguaggio di urgenza e link a pagina di login esterna.', true);

  -- Domain analysis (simulated) ---------------------------------------------------------
  insert into public.domain_analyses (organization_id, case_id, domain, data_mode, dns, rdap, anomalies, analyst_notes, risk_level, risk_rationale, is_demo)
  values (p_org, v_case_domain, 'aurora-logistica-pagamenti.example', 'simulated',
    '{"A": ["203.0.113.80"], "AAAA": [], "MX": [], "NS": ["ns1.parking.example", "ns2.parking.example"], "TXT": []}',
    '{"registrar": "Registrar Fittizio S.p.A.", "events": {"registration": "2026-10-31T10:00:00Z"}, "status": ["client transfer prohibited"]}',
    '["Dominio registrato da meno di 30 giorni", "Nessun record MX/SPF", "Name server di parcheggio"]',
    'Il nome combina il brand con il termine "pagamenti": tipico di domini usati per frodi sui pagamenti.', 'high',
    'Recente registrazione + somiglianza con il brand + assenza di configurazione email legittima.', true);

  -- Report draft --------------------------------------------------------------------------
  insert into public.reports (case_id, report_type, title, classification, status, content, is_demo)
  values (v_case_cti, 'executive_brief', '[DEMO] Executive Intelligence Brief — GreyHeron', 'confidential', 'draft',
    jsonb_build_object(
      'executive_summary', 'Dataset formativo: l''infrastruttura fittizia GreyHeron utilizza indirizzi di documentazione e domini .example. Contenuto dimostrativo.',
      'objective', 'Correlare gli indicatori del dataset e valutarne la rilevanza per l''organizzazione simulata.',
      'methodology', 'Analisi degli IOC presenti nel dataset; confronto tra risultati di reputazione simulati; valutazione dell''analista.',
      'analysis', '', 'risk_assessment', '', 'confidence', 'moderate',
      'conclusions', '', 'recommendations', '', 'limitations', 'Tutti i dati sono simulati a scopo formativo.'),
    true);


  perform public.write_audit(p_org, null, 'demo.seeded', 'organization', p_org, '{}'::jsonb);
  return jsonb_build_object('cases', 4, 'evidence', 3, 'iocs', 8, 'findings', 4);
end;
$$;

create function public.clear_demo_data(p_org uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.has_org_role(p_org, array['admin']::public.org_role[]) then
    raise exception 'only organization admins can remove demo data' using errcode = '42501';
  end if;
  delete from public.ioc_indicators where organization_id = p_org and is_demo;
  delete from public.osint_findings where organization_id = p_org and is_demo;
  delete from public.phishing_analyses where organization_id = p_org and is_demo;
  delete from public.domain_analyses where organization_id = p_org and is_demo;
  delete from public.cases where organization_id = p_org and is_demo;
  delete from public.osint_sources where organization_id = p_org and is_demo;
  perform public.write_audit(p_org, null, 'demo.cleared', 'organization', p_org, '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Dashboard statistics. SECURITY INVOKER: every count is filtered by RLS, so
-- the function can never reveal data the caller could not read directly.
-- -----------------------------------------------------------------------------
create function public.dashboard_stats(p_org uuid, p_include_demo boolean default true)
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
declare v jsonb;
begin
  with c as (
    select * from public.cases where organization_id = p_org and (p_include_demo or not is_demo)
  ),
  i as (
    select * from public.ioc_indicators where organization_id = p_org and (p_include_demo or not is_demo)
  )
  select jsonb_build_object(
    'cases_open',        (select count(*) from c where status = 'open'),
    'cases_in_progress', (select count(*) from c where status in ('in_progress', 'on_hold')),
    'cases_closed',      (select count(*) from c where status = 'closed'),
    'cases_archived',    (select count(*) from c where status = 'archived'),
    'iocs_total',        (select count(*) from i),
    'threats_identified',(select count(*) from i where analyst_verdict in ('suspicious', 'malicious')),
    'reports_total',     (select count(*) from public.reports r join c on c.id = r.case_id),
    'tasks_open',        (select count(*) from public.case_tasks t join c on c.id = t.case_id
                           where t.status in ('todo', 'in_progress')),
    'phishing_analyses', (select count(*) from public.phishing_analyses p
                           where p.organization_id = p_org and (p_include_demo or not p.is_demo)),
    'domain_analyses',   (select count(*) from public.domain_analyses d
                           where d.organization_id = p_org and (p_include_demo or not d.is_demo)),
    'cases_by_category', coalesce((select jsonb_object_agg(category, n) from
                           (select category, count(*) n from c group by category) s), '{}'::jsonb),
    'cases_by_risk',     coalesce((select jsonb_object_agg(risk_level, n) from
                           (select risk_level, count(*) n from c where status <> 'archived' group by risk_level) s), '{}'::jsonb),
    'iocs_by_type',      coalesce((select jsonb_object_agg(indicator_type, n) from
                           (select indicator_type, count(*) n from i group by indicator_type) s), '{}'::jsonb),
    'activity_30d',      coalesce((select jsonb_agg(jsonb_build_object('day', d::date, 'count', coalesce(n, 0)) order by d)
                           from generate_series(current_date - 29, current_date, interval '1 day') d
                           left join (select created_at::date as day, count(*) n from public.audit_logs
                                      where organization_id = p_org and created_at >= current_date - 29
                                      group by 1) a on a.day = d::date), '[]'::jsonb),
    'demo_loaded',       exists (select 1 from public.cases where organization_id = p_org and is_demo)
  ) into v;
  return v;
end;
$$;

revoke execute on function public.seed_demo_data(uuid) from public, anon;
revoke execute on function public.clear_demo_data(uuid) from public, anon;
revoke execute on function public.dashboard_stats(uuid, boolean) from public, anon;
grant execute on function public.seed_demo_data(uuid) to authenticated;
grant execute on function public.clear_demo_data(uuid) to authenticated;
grant execute on function public.dashboard_stats(uuid, boolean) to authenticated;
