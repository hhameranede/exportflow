import { EXPORTFLOW_ENGINE_METADATA } from "../lib/exportflow-carrier-engine.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export async function onRequestGet({ env }) {
  if (!env?.EXPORTFLOW_DB) {
    return json({
      ok: false,
      service: EXPORTFLOW_ENGINE_METADATA.name,
      database: "not_bound",
      message: "The engine database binding is not available in this deployment."
    }, 503);
  }

  try {
    const [carriers, checks, sources, alerts] = await Promise.all([
      env.EXPORTFLOW_DB.prepare("SELECT COUNT(*) AS total FROM carrier_integrations").first(),
      env.EXPORTFLOW_DB.prepare("SELECT COUNT(*) AS total FROM carrier_health_checks").first(),
      env.EXPORTFLOW_DB.prepare("SELECT COUNT(*) AS total FROM upstream_sources").first(),
      env.EXPORTFLOW_DB.prepare("SELECT COUNT(*) AS total FROM maintenance_alerts WHERE state = 'open'").first()
    ]);

    return json({
      ok: true,
      service: EXPORTFLOW_ENGINE_METADATA.name,
      apiVersion: EXPORTFLOW_ENGINE_METADATA.apiVersion,
      runtimeAdapterSource: EXPORTFLOW_ENGINE_METADATA.upstream,
      runtimeAdapterRevision: EXPORTFLOW_ENGINE_METADATA.upstreamCommit,
      database: "connected",
      registry: {
        carriers: Number(carriers?.total || 0),
        healthChecks: Number(checks?.total || 0),
        upstreamSources: Number(sources?.total || 0),
        openMaintenanceAlerts: Number(alerts?.total || 0)
      },
      shipmentDataRetention: "not enabled by this endpoint"
    });
  } catch {
    return json( {
      ok: false,
      service: EXPORTFLOW_ENGINE_METADATA.name,
      database: "schema_not_ready",
      message: "The database is bound but the carrier-engine migrations have not been applied."
    }, 503);
  }
}
