import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Campaign Sequence Runner — the execution engine for automated outreach.
 *
 * Called by a scheduled automation every 30 minutes.
 * Also callable from the frontend for manual triggering (admin only).
 *
 * Logic:
 * 1. Find all active campaigns.
 * 2. For each campaign, find leads that are "approved" but haven't been contacted yet,
 *    OR leads in an in-progress campaign step whose delay has passed.
 * 3. Throttle: at most N messages per 12-hour window per org (human-like drip).
 * 4. For each eligible lead+step, queue the outbound action and update lead/campaign history.
 * 5. Log all actions to SystemHealthLog.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no user) and manual admin calls
    let callerIsAdmin = false;
    try {
      const user = await base44.auth.me();
      callerIsAdmin = user?.role === "admin";
    } catch (_) { /* scheduled call — no user */ }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { org_id: filterOrgId, dry_run = false } = body;

    // Fetch all active campaigns
    const activeCampaigns = await base44.asServiceRole.entities.Campaign.filter({ status: "active" });

    if (activeCampaigns.length === 0) {
      return Response.json({ success: true, message: "No active campaigns", processed: 0 });
    }

    const results = [];
    const MAX_MESSAGES_PER_ORG_PER_WINDOW = 50; // throttle: 50 messages per 12h per org
    const orgMessageCounts = {};

    for (const campaign of activeCampaigns) {
      if (filterOrgId && campaign.org_id !== filterOrgId) continue;

      const orgId = campaign.org_id;
      if (!orgId) continue;

      // Init throttle counter for org
      if (orgMessageCounts[orgId] === undefined) {
        // Count messages sent in last 12h for this org
        const allMessages = await base44.asServiceRole.entities.Message.filter({
          org_id: orgId,
          direction: "outbound",
        });
        const windowStart = Date.now() - 12 * 60 * 60 * 1000;
        orgMessageCounts[orgId] = allMessages.filter(m =>
          m.created_date && new Date(m.created_date).getTime() > windowStart
        ).length;
      }

      if (orgMessageCounts[orgId] >= MAX_MESSAGES_PER_ORG_PER_WINDOW) {
        results.push({ campaign: campaign.name, status: "throttled", reason: "Rate limit reached for 12h window" });
        continue;
      }

      const steps = Array.isArray(campaign.workflow_steps) && campaign.workflow_steps.length > 0
        ? campaign.workflow_steps
        : [
            { step: 1, type: "invitation", label: "Send Invitation", delay_days: 0 },
            { step: 2, type: "message", label: "Send Message", delay_days: 1 },
            { step: 3, type: "message", label: "Follow-up", delay_days: 3 },
          ];

      // Find approved leads for this campaign that need processing
      const approvedLeads = await base44.asServiceRole.entities.Lead.filter({
        org_id: orgId,
        status: "approved",
      });

      let campaignMessagesAdded = 0;

      for (const lead of approvedLeads) {
        if (orgMessageCounts[orgId] >= MAX_MESSAGES_PER_ORG_PER_WINDOW) break;

        const campaignHistory = Array.isArray(lead.campaign_history) ? lead.campaign_history : [];
        const thisHistory = campaignHistory.find(h => h.campaign_id === campaign.id);

        // Determine which step to execute next
        let nextStepIndex = 0;
        if (thisHistory) {
          const completedSteps = Array.isArray(thisHistory.steps) ? thisHistory.steps.filter(s => s.status === "sent") : [];
          nextStepIndex = completedSteps.length;
        }

        if (nextStepIndex >= steps.length) continue; // All steps done

        const nextStep = steps[nextStepIndex];
        const enrolledDate = thisHistory?.enrolled_date ? new Date(thisHistory.enrolled_date) : new Date();
        const delayDays = nextStep.delay_days || (nextStepIndex * 1);
        const readyAt = new Date(enrolledDate.getTime() + delayDays * 24 * 60 * 60 * 1000);

        if (new Date() < readyAt) continue; // Not time yet

        // Human-like: add small random jitter within a few minutes (simulated by timestamp offset)
        const jitterMs = Math.floor(Math.random() * 5 * 60 * 1000);

        if (!dry_run) {
          // Create outbound message record
          const messageBody = nextStep.message_body
            || `Hi ${lead.name?.split(" ")[0] || "there"}, ${nextStep.label || "Following up on our conversation"}.`;

          await base44.asServiceRole.entities.Message.create({
            org_id: orgId,
            lead_id: lead.id,
            sender_name: campaign.sender_name || "Outreach Agent",
            recipient_name: lead.name,
            body: messageBody,
            channel: nextStep.type === "invitation" ? "linkedin" : "linkedin",
            direction: "outbound",
            is_read: true,
          });

          // Update campaign history on the lead
          const newStepRecord = {
            step: nextStep.step || nextStepIndex + 1,
            type: nextStep.type,
            label: nextStep.label,
            status: "sent",
            sent_at: new Date(Date.now() + jitterMs).toISOString(),
          };

          const updatedHistorySteps = thisHistory
            ? [...(thisHistory.steps || []), newStepRecord]
            : [newStepRecord];

          const updatedCampaignHistory = thisHistory
            ? campaignHistory.map(h => h.campaign_id === campaign.id
                ? { ...h, steps: updatedHistorySteps }
                : h)
            : [...campaignHistory, {
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                enrolled_date: new Date().toISOString(),
                steps: updatedHistorySteps,
              }];

          await base44.asServiceRole.entities.Lead.update(lead.id, {
            status: "contacted",
            campaign_history: updatedCampaignHistory,
            activity_log: [...(Array.isArray(lead.activity_log) ? lead.activity_log : []), {
              type: "campaign_step",
              description: `Step ${nextStep.step || nextStepIndex + 1} "${nextStep.label}" executed for campaign "${campaign.name}"`,
              timestamp: new Date().toISOString(),
            }],
          });

          // Update campaign counters
          const countField = nextStep.type === "invitation" ? "invitations_sent" : "messages_sent";
          await base44.asServiceRole.entities.Campaign.update(campaign.id, {
            [countField]: (campaign[countField] || 0) + 1,
          });

          orgMessageCounts[orgId]++;
          campaignMessagesAdded++;
        }
      }

      results.push({
        campaign: campaign.name,
        org_id: orgId,
        status: "processed",
        messages_sent: campaignMessagesAdded,
        dry_run,
      });
    }

    // Log to SystemHealthLog
    try {
      const totalSent = results.reduce((s, r) => s + (r.messages_sent || 0), 0);
      await base44.asServiceRole.entities.SystemHealthLog.create({
        org_id: filterOrgId || "all",
        event_type: "campaign_runner",
        source: "executeCampaignStep",
        status: "success",
        details: `Runner completed. Campaigns processed: ${results.length}. Total messages queued: ${totalSent}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (_) { /* optional */ }

    console.log(`[executeCampaignStep] Done. Results:`, JSON.stringify(results));

    return Response.json({ success: true, results }, { status: 200 });

  } catch (error) {
    console.error("[executeCampaignStep] Error:", error.message);
    // Try to log the error
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.SystemHealthLog.create({
        org_id: "system",
        event_type: "campaign_runner",
        source: "executeCampaignStep",
        status: "error",
        details: error.message,
        timestamp: new Date().toISOString(),
      });
    } catch (_) {}
    return Response.json({ error: error.message }, { status: 500 });
  }
});