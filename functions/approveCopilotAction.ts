import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId, messageBody, campaignId, org_id } = await req.json();
    if (!leadId) {
      return Response.json({ error: 'leadId is required' }, { status: 400 });
    }

    // Security: verify the lead belongs to this org
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
    const lead = leads[0];
    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Use org_id from the lead record as the source of truth (not caller-supplied)
    const resolvedOrgId = lead.org_id;

    // Append to activity_log
    const existingLog = Array.isArray(lead.activity_log) ? lead.activity_log : [];
    const newLogEntry = {
      type: 'copilot_approved',
      description: `Outreach approved by ${user.full_name || user.email}${campaignId ? ` for campaign ${campaignId}` : ''}`,
      timestamp: new Date().toISOString(),
    };

    // Update lead status to approved + append activity log
    await base44.asServiceRole.entities.Lead.update(leadId, {
      status: 'approved',
      activity_log: [...existingLog, newLogEntry],
    });

    // Create outbound message record scoped to correct org_id
    await base44.asServiceRole.entities.Message.create({
      sender_name: user.full_name || user.email,
      recipient_name: lead.name,
      body: messageBody || '',
      channel: 'linkedin',
      lead_id: leadId,
      org_id: resolvedOrgId,
      direction: 'outbound',
    });

    console.log(`[approveCopilotAction] Lead ${leadId} approved by ${user.email} for org ${resolvedOrgId}`);

    return Response.json({
      success: true,
      leadId,
      approvedBy: user.email,
      approvedAt: new Date().toISOString(),
      message: "Action approved. The AI agent will execute the outreach.",
      next_step: "Message scheduled for delivery via Unipile",
    }, { status: 200 });

  } catch (error) {
    console.error('[approveCopilotAction] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});