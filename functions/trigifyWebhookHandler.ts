import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Trigify Webhook — Signal-First Lead Routing
 *
 * Flow:
 *   1. Receive Trigify payload
 *   2. Deduplicate by linkedin_url
 *   3. Keyword-route to a Signal Agent (Fintech | SaaS | fallback)
 *   4. Run Signal Agent scoring/categorization on the lead
 *   5. Save the enriched lead
 *   6. Trigger generateOutreachDraft with agent context
 *   7. Monara reports — she does NOT drive this pipeline
 */

const ORG_ID = "seed";

// --- Keyword routing map ---
// Keys are Signal Agent name substrings to match; values are keyword lists (lowercased)
const ROUTING_RULES = [
  {
    agentNameMatch: "test agent",
    keywords: ["fintech", "bank", "banking", "payment", "payments", "financial", "finance", "lending", "credit", "insurance", "insurtech", "saas", "software", "cloud", "platform", "b2b software", "product-led", "plg", "founder", "ceo", "growth"],
  },
  {
    agentNameMatch: "My Agent",
    keywords: ["sales", "revenue", "enterprise", "vp sales", "sales director"],
  },
];

/**
 * Determine which Signal Agent a lead belongs to based on
 * trigger_event, industry, signal_source, and list_name fields.
 */
function resolveAgentName(raw) {
  const haystack = [
    raw.trigger_event,
    raw.industry,
    raw.signal_source,
    raw.list_name,
    raw.company_name,
    raw.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const rule of ROUTING_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.agentNameMatch;
    }
  }
  return null; // no match → no agent link, still save the lead
}

/**
 * Run Signal Agent scoring against the lead.
 * Returns enriched fields: ai_score, fit_status, is_hot, internal_notes
 */
function applyAgentScoring(raw, agent) {
  if (!agent) return {};

  const haystack = [
    raw.industry,
    raw.job_title || raw.title,
    raw.company_name || raw.company,
    raw.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Score 3 (hot) if lead matches mandatory keywords or target job titles
  const mandatoryHit = (agent.mandatory_keywords || []).some((kw) =>
    haystack.includes(kw.toLowerCase())
  );
  const jobTitleHit = (agent.target_job_titles || []).some((t) =>
    haystack.includes(t.toLowerCase())
  );
  const industryHit = (agent.target_industries || []).some((i) =>
    haystack.includes(i.toLowerCase())
  );

  // Score 1 (bad) if excluded keywords found
  const excludedHit = (agent.excluded_keywords || []).some((kw) =>
    haystack.includes(kw.toLowerCase())
  );

  let ai_score = 2;       // default: maybe
  let fit_status = "maybe";
  let is_hot = false;

  if (excludedHit) {
    ai_score = 1;
    fit_status = "bad";
  } else if (mandatoryHit || (jobTitleHit && industryHit)) {
    ai_score = 3;
    fit_status = "good";
    is_hot = true;
  } else if (jobTitleHit || industryHit) {
    ai_score = 2;
    fit_status = "maybe";
  }

  const internal_notes = `Scored by Signal Agent "${agent.name}" on ${new Date().toISOString().split("T")[0]}. Fit: ${fit_status}.`;

  return { ai_score, fit_status, is_hot, internal_notes };
}

Deno.serve(async (req) => {
  try {
    // --- Webhook secret validation ---
    const secret = Deno.env.get("TRIGIFY_WEBHOOK_SECRET");
    if (secret) {
      const headerSecret =
        req.headers.get("x-webhook-secret") || req.headers.get("x-api-key");
      if (headerSecret !== secret) {
        console.warn("[trigifyWebhookHandler] Rejected: invalid webhook secret");
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const incomingLeads = Array.isArray(body.leads) ? body.leads : [body];
    if (incomingLeads.length === 0) {
      return Response.json({ success: true, inserted: 0, skipped: 0 });
    }

    // --- Fetch existing leads for dedup + agent list ---
    const [existingLeads, allAgents] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ org_id: ORG_ID }),
      base44.asServiceRole.entities.SignalAgent.filter({ org_id: ORG_ID }),
    ]);

    const existingLinkedins = new Set(
      existingLeads.map((l) => l.linkedin_url?.toLowerCase()).filter(Boolean)
    );

    // Build a lookup map: agent name (lowercased) → agent record
    const agentMap = {};
    for (const agent of allAgents) {
      agentMap[agent.name?.toLowerCase()] = agent;
    }

    let inserted = 0;
    let skipped = 0;
    const newLeadIds = [];
    const routingSummary = [];
    const errors = [];

    for (const raw of incomingLeads) {
      // --- Field mapping ---
      const name     = raw.person_name  || raw.name      || raw.full_name || "Unknown";
      const company  = raw.company_name || raw.company   || null;
      const linkedin = raw.linkedin_url || raw.linkedin  || null;

      // --- Deduplication ---
      if (linkedin && existingLinkedins.has(linkedin.toLowerCase())) {
        console.log(`[trigifyWebhookHandler] Duplicate skipped: ${linkedin}`);
        skipped++;
        continue;
      }

      // --- Signal Agent Routing (Step 3) ---
      const matchedAgentName = resolveAgentName(raw);
      const matchedAgent = matchedAgentName
        ? agentMap[matchedAgentName.toLowerCase()] || null
        : null;

      if (matchedAgentName) {
        console.log(`[trigifyWebhookHandler] "${name}" → Signal Agent: "${matchedAgentName}" (${matchedAgent ? "found" : "not deployed yet"})`);
      } else {
        console.log(`[trigifyWebhookHandler] "${name}" → No agent match, saving as unrouted lead`);
      }

      // --- Signal Agent Scoring (Step 4) — runs BEFORE save ---
      const agentScore = applyAgentScoring(raw, matchedAgent);

      const leadRecord = {
        org_id:        ORG_ID,
        name,
        company,
        linkedin_url:  linkedin,
        email:         raw.email         || null,
        job_title:     raw.job_title     || raw.title || null,
        company_size:  raw.company_size  || null,
        company_url:   raw.company_url   || raw.company_website || null,
        industry:      raw.industry      || null,
        location:      raw.location      || null,
        signal_source: raw.signal_source || "Trigify",
        list_name:     raw.list_name     || body.list_name || "Trigify Import",
        import_date:   new Date().toISOString().split("T")[0],
        status:        "pending",
        // Agent scoring overrides defaults
        ai_score:      agentScore.ai_score   ?? raw.ai_score   ?? 2,
        fit_status:    agentScore.fit_status ?? raw.fit_status ?? "maybe",
        is_hot:        agentScore.is_hot     ?? raw.is_hot     ?? false,
        internal_notes: agentScore.internal_notes || null,
        intent_signal_data: raw.intent_signal_data || (raw.signal_type ? {
          signal_type: raw.signal_type,
          keyword:     raw.keyword    || null,
          category:    raw.category   || null,
          source_url:  raw.source_url || null,
        } : null),
        activity_log: [{
          type:        "imported",
          description: `Lead imported via Trigify. Routed to Signal Agent: "${matchedAgentName || "none"}". Fit: ${agentScore.fit_status || "maybe"}.`,
          timestamp:   new Date().toISOString(),
        }],
      };

      try {
        const created = await base44.asServiceRole.entities.Lead.create(leadRecord);
        inserted++;
        if (linkedin) existingLinkedins.add(linkedin.toLowerCase());
        if (created?.id) {
          newLeadIds.push({
            id:           created.id,
            name,
            agentName:    matchedAgentName,
            agentId:      matchedAgent?.id || null,
            fit_status:   agentScore.fit_status || "maybe",
          });
        }
      } catch (e) {
        console.error(`[trigifyWebhookHandler] Failed to create lead "${name}":`, e.message);
        errors.push({ lead: name, error: e.message });
      }
    }

    // --- Trigger generateOutreachDraft with agent context (Step 5) ---
    // Only for "good" fit leads — Signal Agent brain already scored them
    for (const lead of newLeadIds) {
      if (lead.fit_status !== "good" && lead.fit_status !== "maybe") {
        console.log(`[trigifyWebhookHandler] Skipping outreach draft for "${lead.name}" — fit: ${lead.fit_status}`);
        continue;
      }
      try {
        await base44.asServiceRole.functions.invoke("generateOutreachDraft", {
          lead_id:           lead.id,
          org_id:            ORG_ID,
          signal_agent_id:   lead.agentId,
          signal_agent_name: lead.agentName,
        });
        routingSummary.push(`"${lead.name}" → ${lead.agentName || "unrouted"} → draft triggered`);
        console.log(`[trigifyWebhookHandler] Draft triggered for "${lead.name}" via agent "${lead.agentName || "none"}"`);
      } catch (e) {
        // Fallback: log and continue — draft failure must not fail lead ingestion
        console.warn(`[trigifyWebhookHandler] Draft trigger failed for "${lead.name}" (will retry manually): ${e.message}`);
        routingSummary.push(`"${lead.name}" → lead saved, draft pending (${e.message})`);
        // Attempt a standard fallback draft with no agent context
        try {
          await base44.asServiceRole.functions.invoke("generateOutreachDraft", {
            lead_id: lead.id,
            org_id:  ORG_ID,
          });
          routingSummary.push(`"${lead.name}" → fallback draft triggered successfully`);
          console.log(`[trigifyWebhookHandler] Fallback draft triggered for "${lead.name}"`);
        } catch (fallbackErr) {
          console.warn(`[trigifyWebhookHandler] Fallback draft also failed for "${lead.name}":`, fallbackErr.message);
        }
      }
    }

    // --- SystemHealthLog ---
    try {
      await base44.asServiceRole.entities.SystemHealthLog.create({
        org_id:     ORG_ID,
        event_type: "webhook_received",
        source:     "trigify",
        status:     "success",
        details:    `Signal-First routing complete. Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors.length}. Routing: ${routingSummary.join(" | ") || "none"}`,
        timestamp:  new Date().toISOString(),
      });
    } catch (_) {}

    return Response.json({
      success:          true,
      inserted,
      skipped,
      routing_summary:  routingSummary,
      errors:           errors.length > 0 ? errors : undefined,
    }, { status: 200 });

  } catch (error) {
    console.error("[trigifyWebhookHandler] Fatal error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});