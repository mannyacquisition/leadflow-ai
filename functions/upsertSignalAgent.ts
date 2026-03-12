import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Master upsert function for SignalAgent.
 * Handles both create (new agent) and update (existing agent).
 * Used by: Wizard UI, Monara AI agent.
 *
 * Payload shape:
 * {
 *   agent_id?: string,          // if present → update, else → create
 *   org_id: string,             // REQUIRED - enforced server-side
 *
 *   // ICP fields
 *   name?: string,
 *   target_job_titles?: string[],
 *   target_locations?: string[],
 *   target_industries?: string[],
 *   company_sizes?: string[],
 *   company_types?: string[],
 *   excluded_keywords?: string[],
 *   mandatory_keywords?: string[],
 *   additional_criteria?: string,
 *   lead_matching_mode?: number,    // 0-100 (0=discovery, 100=high precision)
 *   exclude_service_providers?: boolean,
 *   skip_icp_filtering?: boolean,
 *   include_open_to_work?: boolean,
 *
 *   // Signal fields
 *   linkedin_page_url?: string,
 *   linkedin_profile_url?: string,
 *   track_profile_visitors?: boolean,
 *   profile_visitors_account?: string,
 *   company_followers_url?: string,
 *   company_followers_account?: string,
 *   track_job_changes?: boolean,
 *   track_funding_events?: boolean,
 *   track_top_profiles?: boolean,
 *   keywords?: { text: string, track_mode: string }[],
 *   influencer_urls?: string[],
 *   competitor_urls?: string[],
 *
 *   // Leads fields
 *   lead_list_id?: string,
 *   lead_list_name?: string,
 *
 *   // Status
 *   status?: "active" | "paused",
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Auth check ────────────────────────────────────────────────────────────
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { agent_id, org_id, ...fields } = body;

    // ── Validate org_id presence ──────────────────────────────────────────────
    if (!org_id) {
      return Response.json({ error: 'org_id is required' }, { status: 400 });
    }

    // ── Sanitize & map payload to DB columns ──────────────────────────────────
    const payload = {
      org_id,
      // Core identity
      ...(fields.name !== undefined && { name: String(fields.name).trim() }),

      // ICP arrays — always store as arrays
      ...(fields.target_job_titles !== undefined && { target_job_titles: toArray(fields.target_job_titles) }),
      ...(fields.target_locations !== undefined && { target_locations: toArray(fields.target_locations) }),
      ...(fields.target_industries !== undefined && { target_industries: toArray(fields.target_industries) }),
      ...(fields.company_sizes !== undefined && { company_sizes: toArray(fields.company_sizes) }),
      ...(fields.company_types !== undefined && { company_types: toArray(fields.company_types) }),
      ...(fields.excluded_keywords !== undefined && { excluded_keywords: toArray(fields.excluded_keywords) }),
      ...(fields.mandatory_keywords !== undefined && { mandatory_keywords: toArray(fields.mandatory_keywords) }),

      // ICP scalars
      ...(fields.additional_criteria !== undefined && { additional_criteria: String(fields.additional_criteria || '') }),
      ...(fields.lead_matching_mode !== undefined && { lead_matching_mode: clamp(Number(fields.lead_matching_mode), 0, 100) }),
      ...(fields.exclude_service_providers !== undefined && { exclude_service_providers: Boolean(fields.exclude_service_providers) }),
      ...(fields.skip_icp_filtering !== undefined && { skip_icp_filtering: Boolean(fields.skip_icp_filtering) }),
      ...(fields.include_open_to_work !== undefined && { include_open_to_work: Boolean(fields.include_open_to_work) }),

      // Signal scalars
      ...(fields.linkedin_page_url !== undefined && { linkedin_page_url: String(fields.linkedin_page_url || '') }),
      ...(fields.linkedin_profile_url !== undefined && { linkedin_profile_url: String(fields.linkedin_profile_url || '') }),
      ...(fields.track_profile_visitors !== undefined && { track_profile_visitors: Boolean(fields.track_profile_visitors) }),
      ...(fields.profile_visitors_account !== undefined && { profile_visitors_account: String(fields.profile_visitors_account || 'first') }),
      ...(fields.company_followers_url !== undefined && { company_followers_url: String(fields.company_followers_url || '') }),
      ...(fields.company_followers_account !== undefined && { company_followers_account: String(fields.company_followers_account || 'first') }),
      ...(fields.track_job_changes !== undefined && { track_job_changes: Boolean(fields.track_job_changes) }),
      ...(fields.track_funding_events !== undefined && { track_funding_events: Boolean(fields.track_funding_events) }),
      ...(fields.track_top_profiles !== undefined && { track_top_profiles: Boolean(fields.track_top_profiles) }),

      // Signal arrays (complex objects)
      ...(fields.keywords !== undefined && { keywords: toKeywords(fields.keywords) }),
      ...(fields.influencer_urls !== undefined && { influencer_urls: toArray(fields.influencer_urls) }),
      ...(fields.competitor_urls !== undefined && { competitor_urls: toArray(fields.competitor_urls) }),

      // Leads
      ...(fields.lead_list_id !== undefined && { lead_list_id: String(fields.lead_list_id || '') }),
      ...(fields.lead_list_name !== undefined && { lead_list_name: String(fields.lead_list_name || '') }),

      // Status
      ...(fields.status !== undefined && { status: ['active', 'paused'].includes(fields.status) ? fields.status : 'active' }),
    };

    let result;

    if (agent_id) {
      // ── UPDATE existing agent ─────────────────────────────────────────────
      // Security: verify this agent actually belongs to the org
      const existingAgents = await base44.asServiceRole.entities.SignalAgent.filter({ id: agent_id });
      const existing = existingAgents[0];

      if (!existing) {
        return Response.json({ error: 'Agent not found' }, { status: 404 });
      }
      if (existing.org_id !== org_id) {
        return Response.json({ error: 'Forbidden: agent does not belong to this organization' }, { status: 403 });
      }

      result = await base44.asServiceRole.entities.SignalAgent.update(agent_id, payload);
      console.log(`[upsertSignalAgent] UPDATED agent ${agent_id} by ${user.email}`);

    } else {
      // ── CREATE new agent ──────────────────────────────────────────────────
      if (!payload.name) payload.name = 'New Agent';
      payload.status = payload.status || 'active';
      payload.leads_generated = 0;

      result = await base44.asServiceRole.entities.SignalAgent.create(payload);
      console.log(`[upsertSignalAgent] CREATED agent ${result.id} by ${user.email} for org ${org_id}`);
    }

    return Response.json({ success: true, agent: result }, { status: 200 });

  } catch (error) {
    console.error('[upsertSignalAgent] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v !== null && v !== undefined).map(String);
  return [String(val)];
}

function toKeywords(val) {
  if (!Array.isArray(val)) return [];
  return val
    .filter(k => k && typeof k === 'object' && k.text)
    .map(k => ({
      text: String(k.text).trim(),
      track_mode: ['Posts', 'Likes', 'Comments', 'All'].includes(k.track_mode) ? k.track_mode : 'All',
    }));
}

function clamp(val, min, max) {
  if (isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}