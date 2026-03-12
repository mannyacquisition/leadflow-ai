import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Start or pause a Campaign, scoped to the org.
 * Payload: {
 *   campaign_id?: string,   // if provided, toggle/update existing
 *   org_id: string,         // REQUIRED
 *   action: "start"|"pause"|"create",
 *   // For create:
 *   name?: string,
 *   agent_id?: string,
 *   workflow_steps?: object[],
 *   sender_name?: string,
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id, org_id, action, ...fields } = await req.json();
    if (!org_id) return Response.json({ error: 'org_id is required' }, { status: 400 });
    if (!action) return Response.json({ error: 'action is required: start|pause|create' }, { status: 400 });

    let result;

    if (action === 'create') {
      result = await base44.asServiceRole.entities.Campaign.create({
        org_id,
        name: fields.name || 'New Campaign',
        status: 'active',
        agent_id: fields.agent_id || null,
        workflow_steps: Array.isArray(fields.workflow_steps) ? fields.workflow_steps : [],
        sender_name: fields.sender_name || user.full_name || '',
        contacts_count: 0,
        invitations_sent: 0,
        messages_sent: 0,
        replies_count: 0,
      });
      console.log(`[startCampaign] Campaign ${result.id} CREATED by ${user.email}`);

    } else if (action === 'start' || action === 'pause') {
      if (!campaign_id) return Response.json({ error: 'campaign_id required for start/pause' }, { status: 400 });

      // Verify ownership
      const camps = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
      const campaign = camps[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      if (campaign.org_id !== org_id) {
        return Response.json({ error: 'Forbidden: campaign does not belong to this organization' }, { status: 403 });
      }

      const newStatus = action === 'start' ? 'active' : 'paused';
      result = await base44.asServiceRole.entities.Campaign.update(campaign_id, { status: newStatus });
      console.log(`[startCampaign] Campaign ${campaign_id} → ${newStatus} by ${user.email}`);

    } else {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return Response.json({ success: true, campaign: result }, { status: 200 });

  } catch (error) {
    console.error('[startCampaign] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});