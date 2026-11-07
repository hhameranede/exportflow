import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const expected = 743;
const pinned = '9c088edaa089135b89658f2b611f8a741d5238c6';
const input = resolve(process.argv[2] || 'artifacts/full-743-adapter-audit/adapter-audit.json');
const output = resolve(process.argv[3] || 'artifacts/full-743-adapter-audit/adapter-review-matrix.csv');

// Exact adapter-ID matches only. These are provisional ledger research references,
// not permissions and not classifications inherited by related slugs.
const direct = {
  usps: ['B','merchant-delegation-needed','USPS provider-access note','Account/EPS/IP agreement and Mailer-ID-specific authorization gates are recorded in the ledger; confirm current product terms and exact route.'],
  ups: ['B','merchant-delegation-needed','UPS provider-access note','Shipper-account linkage and restrictions on third-party display/distribution are recorded; obtain written permission or per-merchant authorization.'],
  fedex: ['B','official-api-contract-needed','FedEx provider-access note','Linked-account and third-party application/customer authorization gates are recorded; the public scraper route is not assumed to be Basic Integrated Visibility.'],
  yanwen: ['B','official-api-contract-needed','Yanwen provider-access note','Merchant/account authorization and secure production-endpoint verification remain gates; the adapter route is not assumed to be the official API.'],
  aramex: ['C','official-api-contract-needed','Aramex provider-access note','Official API/contract candidate; production access and public recipient-facing display rights remain unconfirmed.'],
  'emirates-post': ['C','official-api-contract-needed','Emirates Post provider-access note','Official Tracking/CrossBorder API candidate; contract and authorized testing remain required.'],
  'japan-post': ['C','official-api-contract-needed','Japan Post provider-access note','Official API/contract candidate; exact product scope and public display rights remain unconfirmed.'],
  'la-poste': ['C','official-api-contract-needed','La Poste / Colissimo provider-access note','Official API candidate exists separately from the upstream public-page adapter; confirm eligibility, contract and display rights.'],
  'sf-express': ['C','official-api-contract-needed','SF Express provider-access note','Official Open Platform candidate; confirm exact route, account eligibility and display/redistribution rights.'],
  'china-post': ['D','public-route-quarantined','China Post public-route note','An open developer API entitlement for the public route has not been established; keep hosted public lookup quarantined pending terms or approved API evidence.'],
  'india-post': ['D','public-route-quarantined','India Post public-route note','The upstream route is noted as third-party MySpeedPost, not an established official API; quarantine pending provenance, terms and approved access.'],
  'singapore-post': ['D','public-route-quarantined','Singapore Post public-route note','The upstream JSON endpoint is not proof of a licensed public API; quarantine pending official entitlement or written permission.'],
  yunexpress: ['D','public-route-quarantined','YunExpress public-route note','The upstream Yuntrack/browser route is a public-route candidate only; terms, automated access and public display rights are not cleared.']
};

function familyNote(id) {
  if (id === 'dhl' || id.startsWith('dhl-')) return 'DHL product-line variant: do not inherit MyDHL or Unified Tracking permissions/restrictions without matching exact API product and legal entity.';
  if (id.startsWith('fedex-')) return 'FedEx product/country variant: confirm the specific service, account and route; no rights inference from the exact fedex slug.';
  if (id === 'dpd' || id.startsWith('dpd-')) return 'DPD is country-specific: confirm exact national operator, contract and route; no group-wide permission is inferred.';
  if (id === 'gls' || id.startsWith('gls-')) return 'GLS is country-specific: confirm exact national operator, contract and route; no group-wide permission is inferred.';
  if (id === 'correos' || id.startsWith('correos-')) return 'Correos slugs can represent distinct national operators/services; confirm exact legal entity and rights.';
  if (id.startsWith('aramex-')) return 'Aramex country variant requires separate legal-entity and service confirmation; only exact aramex slug matches the ledger note.';
  return '';
}
function csv(value) {
  const raw = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
  const safe = /^[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"','""') + '"';
}
const report = JSON.parse(await readFile(input,'utf8'));
assert.equal(report.source?.commit,pinned,'Unexpected upstream snapshot; refusing to build a mismatched matrix.');
assert.equal(report.adapters?.length,expected,'Expected exactly 743 adapters.');
assert.equal(new Set(report.adapters.map(a=>a.id)).size,expected,'Adapter IDs must be unique.');

const columns = [
'adapter_id','adapter_display_name','adapter_directory','country_codes','tracking_mode','tracking_steps','tracking_adapter_reference',
'browser_indicator','fetch_indicator','axios_indicator','undici_indicator','other_http_client_indicator','source_file_count',
'offline_test_present','offline_test_files','live_test_definition_present_not_executed','live_test_definition_files',
'fixture_present','fixture_files','local_license_notice_files','license_provenance_review','upstream_declared_root_license',
'upstream_snapshot_commit','upstream_adapter_source_url','external_hostnames_static_source_signals','environment_variable_names_only',
'token_or_api_key_signal','cookie_or_csrf_signal','timeout_or_deadline_signal','abort_signal','retry_or_backoff_signal',
'rate_limit_signal','user_agent_signal','privacy_related_code_signals','dynamic_code_execution_heuristic',
'possible_credential_literal_heuristic','exact_legal_carrier_entity','ledger_exact_slug_match','ledger_research_tier_reference',
'ledger_reference_name','review_status','technical_review_priority','technical_triage_reasons','family_identity_boundary_note',
'official_api_evidence_status','official_api_evidence_url','account_or_merchant_delegation_gate',
'public_recipient_display_permission','commercial_tracking_and_ads_permission','data_retention_and_deletion_requirements',
'carrier_license_and_source_rights_status','rights_release_state','evidence_checked_date','reviewer','review_notes'
];

const rows = report.adapters.map(a => {
  const id=a.id, match=direct[id], family=familyNote(id);
  const cred=!!a.securityHeuristics?.possibleCredentialLiteral;
  const dynamic=!!a.securityHeuristics?.dynamicCodeExecution;
  const noBrowser=!!a.networkSignals?.fetch && !a.networkSignals?.browser && !!a.hasOfflineTest && (a.fixtureFiles||[]).length>0;
  const reasons=[];
  if (cred) reasons.push('possible credential-literal heuristic; inspect source manually without exposing values');
  if (dynamic) reasons.push('dynamic-code-execution heuristic; inspect source manually');
  if (noBrowser) reasons.push('HTTP/no-browser candidate with offline test and fixture; inspect endpoint provenance and terms');
  if (!a.hasOfflineTest) reasons.push('no offline test definition');
  if (!(a.fixtureFiles||[]).length) reasons.push('no fixture file detected');
  if (a.networkSignals?.browser) reasons.push('browser automation indicator; inspect terms, anti-bot and runtime dependency');
  if ((a.privacyRelatedCodeSignals||[]).length) reasons.push('privacy-related code signals require minimization review');
  const status=match ? match[1] : (cred||dynamic||noBrowser||family ? 'source-review-needed' : 'unreviewed');
  const priority=cred||dynamic ? 'P0-manual-source-security-review' : (noBrowser||!a.hasOfflineTest ? 'P1-source-or-test-gap-review' : (!(a.fixtureFiles||[]).length ? 'P2-fixture-gap-review' : ((a.privacyRelatedCodeSignals||[]).length ? 'P2-privacy-signal-review' : 'P3-standard-review')));
  const tier=match ? match[0] : '';
  const gate=match?.[0]==='B' ? 'Ledger records account/MID/delegation gates; verify current official terms for this exact route.' : match?.[0]==='C' ? 'Official API/contract candidate; verify eligibility, customer authorization and display scope.' : match?.[0]==='D' ? 'Public route not cleared; do not use for hosted public lookup until approved API/permission evidence exists.' : 'not_assessed';
  return {
    adapter_id:id, adapter_display_name:a.displayName||id, adapter_directory:a.directory||id,
    country_codes:(a.countries||[]).join('; '), tracking_mode:a.trackingMode||'not_declared',
    tracking_steps:(a.trackingSteps||[]).join('; '), tracking_adapter_reference:a.trackingAdapter||'',
    browser_indicator:!!a.networkSignals?.browser, fetch_indicator:!!a.networkSignals?.fetch,
    axios_indicator:!!a.networkSignals?.axios, undici_indicator:!!a.networkSignals?.undici,
    other_http_client_indicator:!!a.networkSignals?.otherHttpClient, source_file_count:a.sourceFileCount||0,
    offline_test_present:!!a.hasOfflineTest, offline_test_files:(a.offlineTestFiles||[]).join('; '),
    live_test_definition_present_not_executed:!!a.hasLiveTestDefinition, live_test_definition_files:(a.liveTestFiles||[]).join('; '),
    fixture_present:(a.fixtureFiles||[]).length>0, fixture_files:(a.fixtureFiles||[]).join('; '),
    local_license_notice_files:(a.localLicenseNoticeFiles||[]).join('; '),
    license_provenance_review:(a.localLicenseNoticeFiles||[]).length ? 'Adapter-local notice exists; inspect full text and scope.' : 'No adapter-local notice detected; root Apache-2.0 and repository NOTICE/nested materials still need file-level review.',
    upstream_declared_root_license:report.source.declaredLicense, upstream_snapshot_commit:pinned,
    upstream_adapter_source_url:'https://github.com/plhery/universal-parcel-scraper/tree/'+pinned+'/carriers/'+encodeURIComponent(a.directory||id),
    external_hostnames_static_source_signals:(a.externalHosts||[]).join('; '),
    environment_variable_names_only:(a.environmentVariableNamesOnly||[]).join('; '),
    token_or_api_key_signal:!!a.authenticationSignals?.tokenOrApiKey, cookie_or_csrf_signal:!!a.authenticationSignals?.cookieOrCsrf,
    timeout_or_deadline_signal:!!a.reliabilitySignals?.timeoutOrDeadline, abort_signal:!!a.reliabilitySignals?.abortSignal,
    retry_or_backoff_signal:!!a.reliabilitySignals?.retryOrBackoff, rate_limit_signal:!!a.reliabilitySignals?.rateLimit,
    user_agent_signal:!!a.reliabilitySignals?.userAgent, privacy_related_code_signals:(a.privacyRelatedCodeSignals||[]).join('; '),
    dynamic_code_execution_heuristic:dynamic, possible_credential_literal_heuristic:cred,
    exact_legal_carrier_entity:'', ledger_exact_slug_match:!!match,
    ledger_research_tier_reference:match ? tier+'-provisional-provider-research-reference' : 'no-exact-ledger-match',
    ledger_reference_name:match ? match[2] : '',
    review_status:status, technical_review_priority:priority, technical_triage_reasons:reasons.join(' | '),
    family_identity_boundary_note:match ? 'Exact adapter slug matches a provider note in the private rights ledger; this remains a research reference only, not an authorization.' : family,
    official_api_evidence_status:'not_recorded_for_this_adapter', official_api_evidence_url:'',
    account_or_merchant_delegation_gate:gate, public_recipient_display_permission:'not_established',
    commercial_tracking_and_ads_permission:'not_assessed', data_retention_and_deletion_requirements:'not_assessed',
    carrier_license_and_source_rights_status:'not_independently_assessed_for_this_adapter', rights_release_state:'not_cleared',
    evidence_checked_date:'', reviewer:'',
    review_notes:match ? match[3] : 'Research row only. Adapter presence, upstream tests, a public tracking page or software source license is not proof of carrier authorization or public/commercial display rights.'
  };
});
const lines=[columns.map(csv).join(',')];
for (const row of rows) lines.push(columns.map(k=>csv(row[k])).join(','));
await mkdir(dirname(output),{recursive:true});
await writeFile(output,lines.join('\n')+'\n','utf8');
const statuses={};
for (const r of rows) statuses[r.review_status]=(statuses[r.review_status]||0)+1;
const summary={rows:rows.length,uniqueIds:new Set(rows.map(r=>r.adapter_id)).size,exactLedgerSlugMatches:rows.filter(r=>r.ledger_exact_slug_match).length,credentialLiteralFlags:rows.filter(r=>r.possible_credential_literal_heuristic).length,httpNoBrowserCandidates:rows.filter(r=>r.technical_triage_reasons.includes('HTTP/no-browser candidate')).length,noOfflineTests:rows.filter(r=>!r.offline_test_present).length,noFixtures:rows.filter(r=>!r.fixture_present).length,rightsCleared:rows.filter(r=>r.rights_release_state!=='not_cleared').length,statuses};
assert.equal(summary.rows,expected); assert.equal(summary.uniqueIds,expected); assert.equal(summary.rightsCleared,0);
console.log(JSON.stringify(summary,null,2));
