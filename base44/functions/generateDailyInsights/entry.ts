import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Daily Insights Generator — Proactive intelligence for the Dashboard.
 *
 * Called daily by a scheduled automation (or manually by admin).
 * Analyzes Leads and Campaigns, then writes insights to DailyInsight entity.
 *
 * Also triggers Monara's "Autonomous Pulse" — posts proactive alerts for 3-fire leads.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled calls (no user) and admin manual calls
    let callerEmail = "system";
    try {
      const user = await base44.auth.me();
      if (user?.role !== "admin" && req.method === "POST") {
        const body = await req.clone().json().catch(() => ({}));
        if (body._manual_call) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      callerEmail = user?.email || "system";
    } catch (_) {}

    // Fetch all data needed for analysis
    const [leads, campaigns, messages] = await Promise.all([
      base44.asServiceRole.entities.Lead.list("-created_date", 1000),
      base44.asServiceRole.entities.Campaign.list("-created_date", 100),
      base44.asServiceRole.entities.Message.filter({ direction: "inbound" }, "-created_date", 200),
    ]);

    if (leads.length === 0) {
      return Response.json({ success: true, message: "Not enough data for insights yet." });
    }

    // Compute metrics for AI analysis
    const totalLeads = leads.length;
    const hotLeads = leads.filter(l => l.is_hot || l.ai_score === 3);
    const contactedLeads = leads.filter(l => l.status === "contacted" || l.status === "approved");
    const pendingLeads = leads.filter(l => l.status === "pending");

    // Industry breakdown
    const industryCounts = {};
    for (const l of leads) {
      if (l.industry) industryCounts[l.industry] = (industryCounts[l.industry] || 0) + 1;
    }
    const topIndustries = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${v}`);

    // Fit status breakdown
    const goodFit = leads.filter(l => l.fit_status === "good").length;
    const maybeFit = leads.filter(l => l.fit_status === "maybe").length;
    const badFit = leads.filter(l => l.fit_status === "bad").length;

    // Campaign performance
    const activeCampaigns = campaigns.filter(c => c.status === "active");
    const bestCampaign = campaigns.sort((a, b) => (b.replies_count || 0) - (a.replies_count || 0))[0];

    // Recent reply rate
    const recentReplies = messages.filter(m => {
      const d = new Date(m.created_date);
      return d > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    });

    // Group by org_id for multi-tenant insights
    const orgIds = [...new Set(leads.map(l => l.org_id).filter(Boolean))];

    for (const org_id of orgIds) {
      const orgLeads = leads.filter(l => l.org_id === org_id);
      const orgHot = orgLeads.filter(l => l.is_hot || l.ai_score === 3);
      const orgReplies = messages.filter(m => m.org_id === org_id);
      const orgCampaigns = campaigns.filter(c => c.org_id === org_id);

      const prompt = `You are a B2B sales intelligence analyst. Analyze this platform data and generate 3-4 sharp, actionable insights for the sales team. Be specific and data-driven.

Data snapshot (org: ${org_id}):
- Total leads in CRM: ${orgLeads.length}
- Hot leads (score 3): ${orgHot.length} (${((orgHot.length / Math.max(orgLeads.length, 1)) * 100).toFixed(1)}%)
- Contacted leads: ${orgLeads.filter(l => l.status === "contacted").length}
- Pending review: ${orgLeads.filter(l => l.status === "pending").length}
- Good fit: ${orgLeads.filter(l => l.fit_status === "good").length}, Maybe: ${orgLeads.filter(l => l.fit_status === "maybe").length}
- Active campaigns: ${orgCampaigns.filter(c => c.status === "active").length}
- Inbound replies (all time): ${orgReplies.length}
- Top industries: ${Object.entries(orgLeads.reduce((acc, l) => { if (l.industry) acc[l.industry] = (acc[l.industry] || 0) + 1; return acc; }, {})).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}(${v})`).join(", ") || "N/A"}
- Best campaign by replies: ${orgCampaigns.sort((a,b)=>(b.replies_count||0)-(a.replies_count||0))[0]?.name || "N/A"} (${orgCampaigns[0]?.replies_count || 0} replies)

Generate insights as a JSON array of objects: [{ "type": "insight|warning|opportunity|action", "title": "short title", "body": "2-3 sentence insight", "metric": "key number or stat" }]
Focus on: conversion opportunities, ICP segments performing best, campaign improvements, and urgent actions needed.`;

      let insights = [];
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    title: { type: "string" },
                    body: { type: "string" },
                    metric: { type: "string" },
                  },
                },
              },
            },
          },
        });
        insights = result?.insights || [];
      } catch (e) {
        insights = [{
          type: "insight",
          title: "CRM Overview",
          body: `You have ${orgLeads.length} leads in your CRM. ${orgHot.length} are hot prospects ready for outreach.`,
          metric: `${orgLeads.length} total leads`,
        }];
      }

      // Save insights
      await base44.asServiceRole.entities.DailyInsight.create({
        org_id,
        date: new Date().toISOString().split("T")[0],
        insights,
        summary: `${insights.length} insights generated for ${orgLeads.length} leads across ${orgCampaigns.filter(c => c.status === "active").length} active campaigns.`,
        generated_by: "monara_autonomous",
      });

      // Autonomous Pulse: post proactive alert if there are hot uncontacted leads
      const uncontactedHot = orgHot.filter(l => l.status === "pending");
      if (uncontactedHot.length > 0) {
        // Find or create a Monara conversation for this org to post the alert
        try {
          const alertBody = `🔥 **Autonomous Alert:** I found ${uncontactedHot.length} high-fit lead${uncontactedHot.length > 1 ? "s" : ""} (3-fire score) that haven't been contacted yet:\n\n${uncontactedHot.slice(0, 3).map(l => `• **${l.name}** — ${l.job_title || ""} @ ${l.company || "Unknown"}`).join("\n")}\n\nShould I generate personalized outreach drafts for them? Reply "yes" or visit the Contacts page to review.`;

          // Post as a system Message so it shows in Unibox
          await base44.asServiceRole.entities.Message.create({
            org_id,
            sender_name: "Monara AI",
            recipient_name: "Team",
            body: alertBody,
            channel: "linkedin",
            direction: "inbound",
            is_read: false,
            avatar_url: null,
          });
        } catch (_) {}
      }
    }

    console.log(`[generateDailyInsights] Insights generated for ${orgIds.length} org(s) by ${callerEmail}`);

    return Response.json({
      success: true,
      orgs_processed: orgIds.length,
      message: `Daily insights generated for ${orgIds.length} organization(s).`,
    }, { status: 200 });

  } catch (error) {
    console.error("[generateDailyInsights] Error:", error.message);
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.SystemHealthLog.create({
        org_id: "system",
        event_type: "daily_insights",
        source: "generateDailyInsights",
        status: "error",
        details: error.message,
        timestamp: new Date().toISOString(),
      });
    } catch (_) {}
    return Response.json({ error: error.message }, { status: 500 });
  }
});