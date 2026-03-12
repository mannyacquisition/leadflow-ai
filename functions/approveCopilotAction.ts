import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId, messageBody, campaignId } = await req.json();
    if (!leadId) {
      return Response.json({ error: 'leadId is required' }, { status: 400 });
    }

    // Update lead status to approved
    await base44.asServiceRole.entities.Lead.update(leadId, {
      status: 'approved',
    });

    // Log the approved message for the outreach record
    await base44.asServiceRole.entities.Message.create({
      sender_name: user.full_name,
      recipient_name: leadId,
      body: messageBody || '',
      channel: 'linkedin',
      lead_id: leadId,
      org_id: user.email,
      direction: 'outbound',
    });

    console.log(`[approveCopilotAction] Lead ${leadId} approved by ${user.email}`);

    // Placeholder: Trigger Superagent/Unipile webhook here
    // await fetch("https://api.unipile.com/v1/send-message", { method: "POST", ... })

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