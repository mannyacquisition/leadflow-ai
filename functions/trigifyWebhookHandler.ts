import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Webhook receiver for Trigify / Netrows lead ingestion.
 * POST /trigifyWebhookHandler
 * Headers: x-webhook-secret: <TRIGIFY_WEBHOOK_SECRET>
 * Body: { org_id, leads: [{ name, email, linkedin_url, job_title, company, ... }] }
 *       OR a single lead object with org_id at the top level.
 *
 * Security: validates x-webhook-secret header.
 * Dedup: skips leads where email or linkedin_url already exist for this org.
 */
Deno.serve(async (req) => {
  try {
    // --- Webhook secret validation ---
    const secret = Deno.env.get("TRIGIFY_WEBHOOK_SECRET");
    if (secret) {
      const headerSecret = req.headers.get("x-webhook-secret") || req.headers.get("x-api-key");
      if (headerSecret !== secret) {
        console.warn("[trigifyWebhookHandler] Rejected: invalid webhook secret");
        return Response.json({ error: "Forbidden: invalid webhook secret" }, { status: 403 });
      }
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const org_id = body.org_id;
    if (!org_id) {
      return Response.json({ error: "org_id is required" }, { status: 400 });
    }

    // Support both array payload and single lead
    const incomingLeads = Array.isArray(body.leads) ? body.leads : [body];

    if (incomingLeads.length === 0) {
      return Response.json({ success: true, inserted: 0, skipped: 0 });
    }

    // Fetch existing leads for this org to dedup
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({ org_id });
    const existingEmails = new Set(existingLeads.map(l => l.email?.toLowerCase()).filter(Boolean));
    const existingLinkedins = new Set(existingLeads.map(l => l.linkedin_url?.toLowerCase()).filter(Boolean));

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const raw of incomingLeads) {
      const email = raw.email?.toLowerCase();
      const linkedin = raw.linkedin_url?.toLowerCase();

      // Dedup check
      if ((email && existingEmails.has(email)) || (linkedin && existingLinkedins.has(linkedin))) {
        skipped++;
        continue;
      }

      const leadRecord = {
        org_id,
        name: raw.name || raw.full_name || "Unknown",
        email: raw.email || null,
        linkedin_url: raw.linkedin_url || null,
        job_title: raw.job_title || raw.title || null,
        company: raw.company || raw.company_name || null,
        company_size: raw.company_size || null,
        company_url: raw.company_url || raw.company_website || null,
        industry: raw.industry || null,
        location: raw.location || null,
        signal_source: raw.signal_source || "Trigify",
        list_name: raw.list_name || body.list_name || "Trigify Import",
        ai_score: raw.ai_score || 2,
        is_hot: raw.is_hot || false,
        fit_status: raw.fit_status || "maybe",
        status: "pending",
        import_date: new Date().toISOString().split("T")[0],
        intent_signal_data: raw.intent_signal_data || (raw.signal_type ? {
          signal_type: raw.signal_type,
          keyword: raw.keyword || null,
          category: raw.category || null,
          source_url: raw.source_url || null,
        } : null),
        activity_log: [{
          type: "imported",
          description: `Lead imported via Trigify webhook. Signal: ${raw.signal_source || "N/A"}`,
          timestamp: new Date().toISOString(),
        }],
      };

      try {
        await base44.asServiceRole.entities.Lead.create(leadRecord);
        inserted++;
        if (email) existingEmails.add(email);
        if (linkedin) existingLinkedins.add(linkedin);
      } catch (e) {
        errors.push({ lead: raw.name, error: e.message });
      }
    }

    // Log to SystemHealthLog if available
    try {
      await base44.asServiceRole.entities.SystemHealthLog.create({
        org_id,
        event_type: "webhook_received",
        source: "trigify",
        status: "success",
        details: `Processed ${incomingLeads.length} leads. Inserted: ${inserted}, Skipped (dup): ${skipped}, Errors: ${errors.length}`,
        timestamp: new Date().toISOString(),
      });
    } catch (_) { /* SystemHealthLog is optional */ }

    console.log(`[trigifyWebhookHandler] org=${org_id} inserted=${inserted} skipped=${skipped} errors=${errors.length}`);

    return Response.json({
      success: true,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 200 });

  } catch (error) {
    console.error("[trigifyWebhookHandler] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});