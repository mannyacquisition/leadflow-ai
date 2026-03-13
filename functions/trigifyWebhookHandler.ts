import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Webhook receiver for Trigify lead ingestion.
 * POST /trigifyWebhookHandler
 * Headers: x-webhook-secret: <TRIGIFY_WEBHOOK_SECRET>  (optional but recommended)
 *
 * Trigify field mapping:
 *   person_name   → name
 *   company_name  → company
 *   linkedin_url  → linkedin_url
 *
 * org_id is ALWAYS hardcoded to "seed".
 * Deduplication is performed by linkedin_url.
 * After save, Monara autonomous chain is triggered to analyze + draft outreach.
 */

const ORG_ID = "seed";

Deno.serve(async (req) => {
  try {
    // --- Optional webhook secret validation ---
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

    // Support both array payload { leads: [...] } and a single lead object
    const incomingLeads = Array.isArray(body.leads) ? body.leads : [body];

    if (incomingLeads.length === 0) {
      return Response.json({ success: true, inserted: 0, skipped: 0 });
    }

    // --- Fetch existing LinkedIn URLs for this org to dedup ---
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({ org_id: ORG_ID });
    const existingLinkedins = new Set(
      existingLeads.map(l => l.linkedin_url?.toLowerCase()).filter(Boolean)
    );

    let inserted = 0;
    let skipped = 0;
    const newLeadIds = [];
    const errors = [];

    for (const raw of incomingLeads) {
      // --- Trigify field mapping ---
      const name        = raw.person_name   || raw.name       || raw.full_name    || "Unknown";
      const company     = raw.company_name  || raw.company    || null;
      const linkedin    = raw.linkedin_url  || raw.linkedin   || null;

      // --- LinkedIn-based deduplication ---
      if (linkedin && existingLinkedins.has(linkedin.toLowerCase())) {
        console.log(`[trigifyWebhookHandler] Skipping duplicate: ${linkedin}`);
        skipped++;
        continue;
      }

      const leadRecord = {
        org_id:         ORG_ID,
        name,
        company,
        linkedin_url:   linkedin,
        email:          raw.email          || null,
        job_title:      raw.job_title      || raw.title       || null,
        company_size:   raw.company_size   || null,
        company_url:    raw.company_url    || raw.company_website || null,
        industry:       raw.industry       || null,
        location:       raw.location       || null,
        signal_source:  raw.signal_source  || "Trigify",
        list_name:      raw.list_name      || body.list_name  || "Trigify Import",
        ai_score:       raw.ai_score       || 2,
        is_hot:         raw.is_hot         || false,
        fit_status:     raw.fit_status     || "maybe",
        status:         "pending",
        import_date:    new Date().toISOString().split("T")[0],
        intent_signal_data: raw.intent_signal_data || (raw.signal_type ? {
          signal_type: raw.signal_type,
          keyword:     raw.keyword    || null,
          category:    raw.category   || null,
          source_url:  raw.source_url || null,
        } : null),
        activity_log: [{
          type:        "imported",
          description: `Lead imported via Trigify webhook. Signal: ${raw.signal_source || "N/A"}`,
          timestamp:   new Date().toISOString(),
        }],
      };

      try {
        const created = await base44.asServiceRole.entities.Lead.create(leadRecord);
        inserted++;
        if (linkedin) existingLinkedins.add(linkedin.toLowerCase());
        if (created?.id) newLeadIds.push(created.id);
      } catch (e) {
        console.error(`[trigifyWebhookHandler] Failed to create lead "${name}":`, e.message);
        errors.push({ lead: name, error: e.message });
      }
    }

    // --- Autonomous Monara chain: analyze + draft outreach for each new lead ---
    for (const leadId of newLeadIds) {
      try {
        await base44.asServiceRole.functions.invoke("generateOutreachDraft", {
          lead_id: leadId,
          org_id:  ORG_ID,
        });
        console.log(`[trigifyWebhookHandler] Monara outreach draft triggered for lead ${leadId}`);
      } catch (e) {
        console.warn(`[trigifyWebhookHandler] Monara chain failed for lead ${leadId}:`, e.message);
        // Non-fatal — lead is still saved
      }
    }

    // --- Log to SystemHealthLog ---
    try {
      await base44.asServiceRole.entities.SystemHealthLog.create({
        org_id:     ORG_ID,
        event_type: "webhook_received",
        source:     "trigify",
        status:     "success",
        details:    `Processed ${incomingLeads.length} leads. Inserted: ${inserted}, Skipped (dup): ${skipped}, Errors: ${errors.length}. Monara drafts triggered: ${newLeadIds.length}`,
        timestamp:  new Date().toISOString(),
      });
    } catch (_) { /* optional */ }

    console.log(`[trigifyWebhookHandler] org=${ORG_ID} inserted=${inserted} skipped=${skipped} drafts=${newLeadIds.length} errors=${errors.length}`);

    return Response.json({
      success:  true,
      inserted,
      skipped,
      drafts_triggered: newLeadIds.length,
      errors:   errors.length > 0 ? errors : undefined,
    }, { status: 200 });

  } catch (error) {
    console.error("[trigifyWebhookHandler] Fatal error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});