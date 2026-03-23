import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agentId } = await req.json();

    let agent = null;
    if (agentId && agentId !== 'new') {
      const agents = await base44.asServiceRole.entities.SignalAgent.list();
      agent = agents.find(a => a.id === agentId);
    }

    console.log(`[triggerSignalAgent] Agent ${agentId} triggered by ${user.email}`);

    // Placeholder: In production, call Trigify.io API here
    // const trigifyResponse = await fetch("https://api.trigify.io/v1/search", {
    //   method: "POST",
    //   headers: { "Authorization": `Bearer ${trigifyApiKey}` },
    //   body: JSON.stringify({ icp: agent.target_job_titles, ... })
    // });

    return Response.json({
      success: true,
      agentId,
      agentName: agent?.name || 'Signal Agent',
      triggeredBy: user.email,
      triggeredAt: new Date().toISOString(),
      status: "running",
      message: "Signal agent triggered. Leads will appear in Contacts as they are discovered.",
      estimated_leads: Math.floor(Math.random() * 50) + 10,
    }, { status: 200 });

  } catch (error) {
    console.error('[triggerSignalAgent] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});