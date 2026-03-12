import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Securely delete a SignalAgent, verifying org ownership first.
 * Payload: { agent_id: string, org_id: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agent_id, org_id } = await req.json();
    if (!agent_id) return Response.json({ error: 'agent_id is required' }, { status: 400 });
    if (!org_id) return Response.json({ error: 'org_id is required' }, { status: 400 });

    // Security: verify ownership before delete
    const agents = await base44.asServiceRole.entities.SignalAgent.filter({ id: agent_id });
    const agent = agents[0];
    if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 });
    if (agent.org_id !== org_id) {
      return Response.json({ error: 'Forbidden: agent does not belong to this organization' }, { status: 403 });
    }

    await base44.asServiceRole.entities.SignalAgent.delete(agent_id);
    console.log(`[deleteSignalAgent] Agent ${agent_id} deleted by ${user.email}`);

    return Response.json({ success: true, deleted_id: agent_id }, { status: 200 });

  } catch (error) {
    console.error('[deleteSignalAgent] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});