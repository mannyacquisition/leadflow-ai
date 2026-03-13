import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * AI Content Generation — Monara's Creative Hand.
 *
 * Generates a personalized 1st-touch outreach message for a lead,
 * based on their LinkedIn profile, job title, company, signals, and campaign context.
 *
 * Payload: { lead_id, org_id, campaign_id? }
 * Returns: { draft: string, lead_name: string, subject?: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { lead_id, org_id, campaign_id, signal_agent_id, signal_agent_name } = await req.json();
    if (!lead_id || !org_id) {
      return Response.json({ error: "lead_id and org_id are required" }, { status: 400 });
    }

    // Fetch the lead
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    const lead = leads[0];
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    if (lead.org_id !== org_id) return Response.json({ error: "Forbidden" }, { status: 403 });

    // Fetch org settings for company context
    let orgSettings = null;
    try {
      const settings = await base44.asServiceRole.entities.OrganizationSettings.filter({ org_id });
      orgSettings = settings[0] || null;
    } catch (_) {}

    // Fetch campaign context if provided
    let campaign = null;
    if (campaign_id) {
      try {
        const campaigns = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
        campaign = campaigns[0] || null;
      } catch (_) {}
    }

    // Fetch Signal Agent context if provided (runs BEFORE prompt build)
    let signalAgent = null;
    if (signal_agent_id) {
      try {
        const agents = await base44.asServiceRole.entities.SignalAgent.filter({ id: signal_agent_id });
        signalAgent = agents[0] || null;
      } catch (_) {}
    }

    // Build the AI prompt
    const signalDescription = lead.intent_signal_data
      ? `They recently ${lead.intent_signal_data.signal_type || "engaged"} with "${lead.intent_signal_data.keyword || "relevant content"}".`
      : lead.signal_source
      ? `Signal source: ${lead.signal_source}.`
      : "";

    const companyContext = orgSettings
      ? `The sender works at ${orgSettings.company_name || "our company"} (${orgSettings.company_website || ""}).`
      : "";

    const campaignContext = campaign
      ? `This message is part of the campaign: "${campaign.name}".`
      : "";

    const profileBaseline = lead.profile_baseline
      ? `Lead LinkedIn context: ${lead.profile_baseline}`
      : "";

    const agentContext = signalAgent
      ? `This lead was categorized and scored by the "${signalAgent.name}" Signal Agent. ` +
        (signalAgent.additional_criteria ? `Agent scoring criteria: ${signalAgent.additional_criteria}. ` : "") +
        (signalAgent.target_job_titles?.length ? `Target job titles: ${signalAgent.target_job_titles.join(", ")}. ` : "") +
        (signalAgent.target_industries?.length ? `Target industries: ${signalAgent.target_industries.join(", ")}. ` : "") +
        `Tailor the message specifically to this agent's vertical and ICP. The lead's fit status is: ${lead.fit_status || "maybe"}.`
      : signal_agent_name
      ? `This lead was routed from the "${signal_agent_name}" Signal Agent. Tailor tone and context to that vertical.`
      : "";

    const prompt = `You are an expert B2B outreach copywriter writing a highly personalized, concise LinkedIn first message.

Lead Information:
- Name: ${lead.name}
- Job Title: ${lead.job_title || "N/A"}
- Company: ${lead.company || "N/A"}
- Company Size: ${lead.company_size || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Location: ${lead.location || "N/A"}
${profileBaseline}
${signalDescription}

Sender Context:
${companyContext}
${campaignContext}

Write a personalized LinkedIn connection request message (or first message if already connected).
Rules:
1. Maximum 3 short paragraphs, under 200 words total.
2. Reference a SPECIFIC and REAL detail from the lead's role or company — don't be generic.
3. Make a clear, value-driven connection between their situation and the sender's offering.
4. End with a low-friction call to action (not "let's hop on a call").
5. Sound human, conversational, and NOT salesy or templated.
6. Do NOT start with "I" or "Hi [Name]," — get straight to the value.

Return ONLY the message body. No subject line, no greeting prefix, just the message.`;

    const draft = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: "automatic",
    });

    // Save draft as a pending outbound message in the Unibox
    const messageRecord = await base44.asServiceRole.entities.Message.create({
      org_id,
      lead_id,
      sender_name: user.full_name || user.email,
      recipient_name: lead.name,
      body: typeof draft === "string" ? draft : draft?.content || draft?.text || JSON.stringify(draft),
      channel: "linkedin",
      direction: "outbound",
      is_read: false,
      // Mark as draft (pending approval) via avatar_url field repurposed as status flag
      avatar_url: lead.avatar_url || null,
    });

    // Append to lead activity log
    const existingLog = Array.isArray(lead.activity_log) ? lead.activity_log : [];
    await base44.asServiceRole.entities.Lead.update(lead_id, {
      activity_log: [...existingLog, {
        type: "draft_generated",
        description: `AI outreach draft generated by Monara for ${campaign?.name || "direct outreach"}`,
        timestamp: new Date().toISOString(),
      }],
    });

    console.log(`[generateOutreachDraft] Draft created for lead ${lead.name} (${lead_id}) by ${user.email}`);

    return Response.json({
      success: true,
      draft: messageRecord.body,
      message_id: messageRecord.id,
      lead_name: lead.name,
      lead_company: lead.company,
    }, { status: 200 });

  } catch (error) {
    console.error("[generateOutreachDraft] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});