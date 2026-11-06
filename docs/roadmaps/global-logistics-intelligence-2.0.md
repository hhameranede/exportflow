# Global Logistics Intelligence 2.0 Roadmap

## Strategic Objectives

Build ExportFlow into a production-grade shipment tracking and logistics intelligence platform with verifiable carrier coverage, deterministic event resolution, and enterprise-ready observability.

## Baseline and Target Interpretation

Current-state figures below are repository or CI snapshots and must be read with their stated source and revision. Numeric values in objectives, phase tables, and milestone targets are **proposals**, not present capabilities, measured performance, or delivery commitments. Validate proposals against observed demand, operating cost, carrier access, privacy requirements, and a measured baseline before approval. A carrier catalogue entry or adapter record does not establish successful live tracking.

---

## Pillar 1: Global Carrier Network

### Objectives
- Work toward a proposed target of up to 200 live-verified carriers across major regions, subject to demand, technical feasibility, and partner access
- Establish adapter contract standards for contribution
- Implement live-verification evidence collection for each integration

### Current State
- Single universal fallback provider (UPU) enabled by default
- The CI catalog test for pinned upstream revision `e64a466772ef25ce68e02d9c7c9f1613eec1208b` reported 1,339 catalog records across 249 assigned ISO country/territory codes; 123 ISO entries had at least one direct adapter. This is a catalogue snapshot, not a carrier count or proof of successful live tracking.
- The catalog test does not produce per-carrier live-verification evidence. Do not describe an adapter as live-verified without reproducible external test evidence.

### Phases

| Phase | Work | Dependencies | Risks | Acceptance Criteria | Metrics |
|-------|------|--------------|-------|---------------------|---------|
| 2.1 | Audit current adapter catalog and identify a prioritized carrier cohort using measured ExportFlow demand or a cited, current parcel-volume source | Upstream catalog data | External provider API changes | Catalog of top 50 carriers with adapter status | 50 carrier entries documented |
| 2.2 | Implement modular carrier adapter facade | Phase 2.1 completed | Credential management | CarrierAdapter interface with health/status methods | 10 adapters with test coverage |
| 2.3 | Add live verification for first 5 carriers | Test credentials obtained | Rate limiting, blocking | Verified tracking lookups with evidence | 5 carriers with live test records |

---

## Pillar 2: Predictive Logistics Intelligence

### Objectives
- Generate evidence-based delay predictions calibrated on real outcomes
- Classify customs events with confidence intervals
- Provide ETAs with uncertainty ranges from provider sources only

### Current State
- Delay classification: "possible" vs "insufficient_evidence" based on signal detection
- Customs state detection: distinguishes "hold" from "processing" based on text patterns
- ETA only from carrier-reported expected_delivery field; no fabricated estimates

### Phases

| Phase | Work | Dependencies | Risks | Acceptance Criteria | Metrics |
|-------|------|--------------|-------|---------------------|---------|
| 2.1 | Document delay/customs/ETA evidence rules | Truth engine implementation | False predictions | Public documentation of all rules | 100% rule coverage documented |
| 2.2 | Add historical data collection (opt-in) | User consent flow | Privacy regulations | Anonymous shipment outcome data | 1000+ shipment records collected |
| 2.3 | Calibrate ETA uncertainty model | Phase 2.2 data | Model drift | Calibrated uncertainty bands | MAPE < 24h for 70% of predictions |

---

## Pillar 3: Merchant Command Center

### Objectives
- Multi-shipment operations dashboard
- Exception management workflow
- Shipment lifecycle tracking

### Current State
- Single shipment tracking API endpoint
- No merchant account or dashboard

### Phases

| Phase | Work | Dependencies | Risks | Acceptance Criteria | Metrics |
|-------|------|--------------|-------|---------------------|---------|
| 2.1 | Design merchant data model | User account system | Data exposure | Merchant API with shipment lists | Merchant API operational |
| 2.2 | Build exception workflow | Phase 2.1 | Complex state management | Exception notification system | 95% exceptions routed |

---

## Pillar 4: Autonomous Shipment Operations

### Objectives
- Scheduled monitoring with polling strategies
- Stalled-shipment detection
- Safe intervention workflows

### Current State
- On-demand tracking only
- No scheduled or automatic monitoring

### Phases

| Phase | Work | Dependencies | Risks | Acceptance Criteria | Metrics |
|-------|------|--------------|-------|---------------------|---------|
| 2.1 | Implement polling scheduler | Rate limiting | Throttling limits | Configurable shipment monitoring | 1000 shipments monitored |
| 2.2 | Add stalled detection algorithm | Monitoring system | False positives | Stalled shipment alerts | 90% detection accuracy |

---

## Pillar 5: Developer Ecosystem

### Objectives
- Documented public API
- Webhook infrastructure
- SDK distribution via CDN

### Current State
- Internal API only
- No public documentation
- No webhooks

### Phases

| Phase | Work | Dependencies | Risks | Acceptance Criteria | Metrics |
|-------|------|--------------|-------|---------------------|---------|
| 2.1 | Publish API documentation (OpenAPI) | API stabilization | Documentation drift | OpenAPI spec at /api.md | 100% endpoints documented |
| 2.2 | Implement webhook system | Merchant accounts | Message delivery | Webhook delivery with retries | 99.9% delivery success |

---

## Pillar 6: Global Growth & SEO

### Objectives
- Real country/carrier pages with structured data
- Full localization (8 languages)
- Crawl/index quality optimization

### Current State
- Country directory with catalog-based classification
- 8 language routes with hreflang (en, ar, es, zh, hi, pt, fr, ru)
- No dynamic content pages

### Phases

| Phase | Work | Dependencies | Risks | Acceptance Criteria | Metrics |
|-------|------|--------------|-------|---------------------|---------|
| 2.1 | Generate country pages per ISO codes | Country data | Thin content | 249 country pages indexed | 100% countries covered |
| 2.2 | Add carrier detail pages | Adapter metadata | Duplicate content | Individual carrier pages | 500+ carrier pages indexed |

---

## Pillar 7: Enterprise Security & Reliability

### Objectives
- Tenancy isolation for multi-tenant support
- Comprehensive observability
- Rate limiting and resilience testing

### Current State
- Single-tenant architecture
- Per-isolate rate limiting (12 req/min)
- No structured observability

### Phases

| Phase | Work | Dependencies | Risks | Acceptance Criteria | Metrics |
|-------|------|--------------|-------|---------------------|---------|
| 2.1 | Add tenancy boundary model | Account system | Data leakage | Tenant isolation tests passing | 0 cross-tenant leaks |
| 2.2 | Implement structured logging | Observability stack | Log volume | All requests logged with redacted PII | 100% request coverage |

---

## Phase Delivery Order

1. **Foundation** - Complete the Issue #29 truth and adapter foundations, then audit demand and dependencies.
2. **Pilot** - Implement adapter contracts and controlled tests for carriers with available official interfaces.
3. **Expansion** - Add live verification and data collection only when credentials, consent, and partner access exist.

---

## Blocked / Externally Dependent Work

| Work | Reason | Owner |
|------|--------|-------|
| Live carrier credentials | Requires external partnership agreements | External |
| Historical shipment data | Requires user consent and data processing | Product |
| Dedicated monitoring infrastructure | Requires external service setup | DevOps |

---

## Implemented Components (v2.0 Planning)

| Component | Location | Status |
|-----------|----------|--------|
| Shipment Truth Engine | `functions/lib/shipment-truth.mjs` | Complete |
| Carrier Engine Facade | `functions/lib/exportflow-carrier-engine.mjs` | Complete |
| Tracking API | `functions/api/track.js` | Integrated |
| Shipment Truth Tests | `scripts/shipment-truth-test.mjs` | Complete |