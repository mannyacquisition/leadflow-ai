import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Unified CRM update for a Lead record.
 * Monara and the frontend slide-over both call this for any lead mutation.
 *
 * Payload: {
 *   lead_id: string,          // REQUIRED
 *   org_id: string,           // REQUIRED - enforced server-side
 *   // any subset of Lead fields:
 *   internal_notes?: string,
 *   fit_status?: "good"|"maybe"|"bad",
 *   status?: "pending"|"approved"|"removed"|"contacted",
 *   profile_baseline?: string,
 *   industry?: string,
 *   company_size?: string,
 *   company_url?: string,
 *   location?: string,
 *   intent_signal_data?: object,
 *   campaign_history?: array,
 *   activity_log?: array,      // pass full array; or use append_activity to add a single entry
 *   append_activity?: { type: string, description: string }  // convenience: appends one entry
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { lead_id, org_id, append_activity, ...fields } = body;

    if (!lead_id) return Response.json({ error: 'lead_id is required' }, { status: 400 });
    if (!org_id) return Response.json({ error: 'org_id is required' }, { status: 400 });

    // Security: verify lead belongs to this org
    let lead;
    try {
      const leads = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
      lead = leads[0];
    } catch (_) { lead = null; }
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.org_id !== org_id) {
      return Response.json({ error: 'Forbidden: lead does not belong to this organization' }, { status: 403 });
    }

    // Build safe update payload — only whitelisted CRM fields
    const allowedFields = [
      'internal_notes', 'fit_status', 'status', 'profile_baseline',
      'industry', 'company_size', 'company_url', 'location',
      'intent_signal_data', 'campaign_history', 'activity_log',
      'name', 'job_title', 'company', 'email', 'linkedin_url',
      'avatar_url', 'ai_score', 'is_hot', 'list_name',
    ];

    const updatePayload = {};
    for (const key of allowedFields) {
      if (fields[key] !== undefined) updatePayload[key] = fields[key];
    }

    // Handle append_activity convenience helper
    if (append_activity && append_activity.description) {
      const existingLog = Array.isArray(lead.activity_log) ? lead.activity_log : [];
      updatePayload.activity_log = [...existingLog, {
        type: append_activity.type || 'note',
        description: append_activity.description,
        timestamp: new Date().toISOString(),
      }];
    }

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Lead.update(lead_id, updatePayload);
    console.log(`[updateLeadCrm] Lead ${lead_id} updated by ${user.email}`);

    return Response.json({ success: true, lead: updated }, { status: 200 });

  } catch (error) {
    console.error('[updateLeadCrm] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});