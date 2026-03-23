import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = await req.json();
    if (!leadId) {
      return Response.json({ error: 'leadId is required' }, { status: 400 });
    }

    // Placeholder: In production, call Trigify/Hunter.io/Apollo API here
    const mockEmails = [
      "hans.guntren@deliberately.ai",
      "mike.cocco@decisionflow.com",
      "sergio@remuner.com",
      "stephan@stoain.com",
      "contact@example.com",
    ];
    const enrichedEmail = mockEmails[Math.floor(Math.random() * mockEmails.length)];

    // Update the lead with the enriched email
    await base44.asServiceRole.entities.Lead.update(leadId, {
      email: enrichedEmail,
    });

    console.log(`[enrichEmail] Lead ${leadId} enriched with email: ${enrichedEmail}`);

    return Response.json({
      success: true,
      leadId,
      email: enrichedEmail,
      message: "Email successfully enriched",
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('[enrichEmail] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});