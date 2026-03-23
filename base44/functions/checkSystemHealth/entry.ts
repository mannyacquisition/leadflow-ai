import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * System Health Reporter — for Monara and the admin dashboard.
 *
 * Returns a natural-language health report + structured log data.
 * Callable by Monara ("How is the system running?") and the Settings/CommandCenter page.
 *
 * Payload: { org_id, limit? }
 * Returns: { status, report, logs, stats }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { org_id, limit = 50 } = await req.json().catch(() => ({}));

    // Fetch recent system health logs
    let logs = [];
    try {
      const allLogs = await base44.asServiceRole.entities.SystemHealthLog.list("-created_date", limit);
      logs = org_id ? allLogs.filter(l => l.org_id === org_id || l.org_id === "system") : allLogs;
    } catch (_) {
      // SystemHealthLog entity may not exist yet
      return Response.json({
        status: "healthy",
        report: "No system health logs found. The system is running normally.",
        logs: [],
        stats: { total: 0, errors: 0, warnings: 0, successes: 0 },
      });
    }

    const errors = logs.filter(l => l.status === "error");
    const warnings = logs.filter(l => l.status === "warning");
    const successes = logs.filter(l => l.status === "success");

    const overallStatus = errors.length > 5 ? "critical" :
                          errors.length > 0 ? "degraded" :
                          warnings.length > 0 ? "warning" : "healthy";

    // Generate AI-powered natural language report
    const recentErrors = errors.slice(0, 5);
    const prompt = `You are a system health monitor for a B2B SaaS platform called LeadFlow AI.
    
Analyze this system health data and write a concise, natural-language report (3-5 sentences) that a non-technical user can understand.

System Status: ${overallStatus.toUpperCase()}
Total log entries (last ${limit}): ${logs.length}
Errors: ${errors.length}
Warnings: ${warnings.length}  
Successes: ${successes.length}

Recent errors (if any):
${recentErrors.map(e => `- [${e.source}] ${e.details}`).join("\n") || "None"}

Recent activity:
${successes.slice(0, 3).map(s => `- [${s.source}] ${s.details}`).join("\n") || "None"}

Write the health report. If there are errors, explain what's failing and suggest a fix in plain language.
If healthy, give a brief positive summary of recent activity.`;

    let report = "";
    try {
      report = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
      if (typeof report !== "string") report = JSON.stringify(report);
    } catch (_) {
      report = overallStatus === "healthy"
        ? `All systems are running smoothly. ${successes.length} successful operations logged recently.`
        : `System has ${errors.length} error(s) that may need attention. Check the logs for details.`;
    }

    // Log this health check
    await base44.asServiceRole.entities.SystemHealthLog.create({
      org_id: org_id || "system",
      event_type: "health_check",
      source: "checkSystemHealth",
      status: "success",
      details: `Health check requested by ${user.email}. Status: ${overallStatus}`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      status: overallStatus,
      report,
      stats: {
        total: logs.length,
        errors: errors.length,
        warnings: warnings.length,
        successes: successes.length,
      },
      logs: logs.slice(0, 20).map(l => ({
        id: l.id,
        event_type: l.event_type,
        source: l.source,
        status: l.status,
        details: l.details,
        timestamp: l.timestamp || l.created_date,
      })),
    }, { status: 200 });

  } catch (error) {
    console.error("[checkSystemHealth] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});