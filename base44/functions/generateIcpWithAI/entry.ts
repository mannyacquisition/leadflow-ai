import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Monara's "Generate ICP with AI" tool.
 * Takes a natural language description of the ideal customer and returns
 * a structured ICP config, then writes it back to the SignalAgent record.
 *
 * Payload: { agent_id: string, org_id: string, description?: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agent_id, org_id, description } = await req.json();

    if (!org_id) {
      return Response.json({ error: 'org_id is required' }, { status: 400 });
    }

    // ── If agent_id provided, load existing agent for context ─────────────────
    let existingAgent = null;
    if (agent_id) {
      const agents = await base44.asServiceRole.entities.SignalAgent.filter({ id: agent_id });
      existingAgent = agents[0];
      if (existingAgent && existingAgent.org_id !== org_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const prompt = `You are an expert B2B sales strategist. Generate a precise Ideal Customer Profile (ICP) configuration for a B2B sales outreach agent.

${description ? `User's description of their ideal customer: "${description}"` : ''}
${existingAgent ? `Existing agent context: ${JSON.stringify({
  name: existingAgent.name,
  target_industries: existingAgent.target_industries,
  target_job_titles: existingAgent.target_job_titles,
})}` : ''}

Generate a complete ICP with realistic, specific values. Return ONLY valid JSON matching this schema exactly:
{
  "target_job_titles": ["array of 5-8 specific job titles"],
  "target_industries": ["array of 3-6 specific industries"],
  "target_locations": ["array of 2-4 locations or regions"],
  "company_sizes": ["array of 2-3 company size ranges from: 1-10 employees, 11-50 employees, 51-200 employees, 201-500 employees, 501-1000 employees, 1001-5000 employees"],
  "company_types": ["array from: Private Company, Public Company, Startup, Non-profit"],
  "excluded_keywords": ["array of 2-4 keywords/companies to exclude"],
  "mandatory_keywords": ["array of 1-3 must-have keywords"],
  "additional_criteria": "1-2 sentence description of additional targeting nuance",
  "lead_matching_mode": 80,
  "exclude_service_providers": true,
  "skip_icp_filtering": false,
  "include_open_to_work": false
}`;

    const icpConfig = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          target_job_titles: { type: "array", items: { type: "string" } },
          target_industries: { type: "array", items: { type: "string" } },
          target_locations: { type: "array", items: { type: "string" } },
          company_sizes: { type: "array", items: { type: "string" } },
          company_types: { type: "array", items: { type: "string" } },
          excluded_keywords: { type: "array", items: { type: "string" } },
          mandatory_keywords: { type: "array", items: { type: "string" } },
          additional_criteria: { type: "string" },
          lead_matching_mode: { type: "number" },
          exclude_service_providers: { type: "boolean" },
          skip_icp_filtering: { type: "boolean" },
          include_open_to_work: { type: "boolean" },
        }
      }
    });

    // ── Write ICP back to DB via upsert ───────────────────────────────────────
    const upsertPayload = { agent_id, org_id, ...icpConfig };
    const upsertRes = await base44.asServiceRole.functions.invoke('upsertSignalAgent', upsertPayload);

    console.log(`[generateIcpWithAI] ICP generated and saved for agent ${agent_id} by ${user.email}`);

    return Response.json({
      success: true,
      icp: icpConfig,
      agent: upsertRes?.agent || null,
    }, { status: 200 });

  } catch (error) {
    console.error('[generateIcpWithAI] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});