import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Search the Lead CRM by name, email, or company.
 * Used by Monara to resolve lead_id before calling updateLeadCrm or generateOutreachDraft.
 *
 * Payload: { org_id: string, search_query: string, limit?: number }
 * Returns: { leads: [{ id, name, email, company, job_title, status, ai_score, linkedin_url }] }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { org_id, search_query, limit = 20 } = await req.json();

    if (!search_query || search_query.trim().length < 1) {
      return Response.json({ error: 'search_query is required' }, { status: 400 });
    }

    // Resolve org_id from session if not passed
    const effectiveOrgId = org_id || user.org_id || user.email || null;

    // Fetch all leads for this org (Lead entity uses 'name' as a single full-name field)
    const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 1000);

    // Filter to this org
    const orgLeads = effectiveOrgId
      ? allLeads.filter(l => l.org_id === effectiveOrgId)
      : allLeads;

    // Fuzzy search across name, email, company — case-insensitive
    const q = search_query.toLowerCase().trim();
    const matched = orgLeads.filter(lead => {
      const name = (lead.name || '').toLowerCase();
      const email = (lead.email || '').toLowerCase();
      const company = (lead.company || '').toLowerCase();
      const jobTitle = (lead.job_title || '').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        company.includes(q) ||
        jobTitle.includes(q)
      );
    });

    const results = matched.slice(0, limit).map(lead => ({
      id: lead.id,
      name: lead.name,
      email: lead.email || null,
      company: lead.company || null,
      job_title: lead.job_title || null,
      linkedin_url: lead.linkedin_url || null,
      status: lead.status || 'pending',
      ai_score: lead.ai_score || null,
      fit_status: lead.fit_status || null,
      location: lead.location || null,
      industry: lead.industry || null,
      is_hot: lead.is_hot || false,
    }));

    console.log(`[searchLeads] Query="${search_query}" by ${user.email} → ${results.length} result(s)`);

    return Response.json({
      success: true,
      query: search_query,
      total_found: results.length,
      leads: results,
    }, { status: 200 });

  } catch (error) {
    console.error('[searchLeads] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});