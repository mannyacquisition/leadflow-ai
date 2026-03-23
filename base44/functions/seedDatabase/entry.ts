import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SEED_LEADS = [
  { name: "Hans Guntren", job_title: "Co-Founder, CEO", company: "Deliberately Incorporated", linkedin_url: "https://linkedin.com/in/hans-guntren", ai_score: 3, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", is_hot: true, status: "pending", industry: "Software Development", location: "Menlo Park, CA, US", company_size: "11-50 employees" },
  { name: "Ahmed Eldesoky", job_title: "Founder", company: "Venturio", linkedin_url: "https://linkedin.com/in/ahmed-eldesoky", ai_score: 3, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", is_hot: true, status: "pending", industry: "Software Development", location: "Cairo, Egypt" },
  { name: "Robert V.L.", job_title: "Founder & CEO", company: "Leasee®", linkedin_url: "https://linkedin.com/in/robert-vl", ai_score: 3, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", is_hot: true, status: "pending", industry: "PropTech", location: "Amsterdam, Netherlands" },
  { name: "Louise Matthews", job_title: "Co-Founder", company: "WIA - Women in Action", linkedin_url: "https://linkedin.com/in/louise-matthews", ai_score: 2, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", status: "pending", industry: "Non-Profit", location: "London, UK" },
  { name: "Jovan Lakic", job_title: "CEO & Founder", company: "Janip Systems", linkedin_url: "https://linkedin.com/in/jovan-lakic", ai_score: 3, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", is_hot: true, status: "pending", industry: "Software Development", location: "Belgrade, Serbia" },
  { name: "Loic LE MEE", job_title: "Founding Partner", company: "YORS ADVISORY", linkedin_url: "https://linkedin.com/in/loic-le-mee", ai_score: 2, fit_status: "maybe", signal_source: "demand gen", list_name: "Manny list", status: "pending", industry: "Consulting", location: "Paris, France" },
  { name: "Edward Byrne", job_title: "Founder", company: "SalesSprint", linkedin_url: "https://linkedin.com/in/edward-byrne", ai_score: 3, fit_status: "good", signal_source: "demand gen", list_name: "My List", is_hot: true, status: "approved", industry: "Sales Tech", location: "Dublin, Ireland" },
  { name: "Jason Patel", job_title: "Co-Founder, CEO", company: "Open Forge AI", linkedin_url: "https://linkedin.com/in/jason-patel", ai_score: 3, fit_status: "good", signal_source: "demand gen", list_name: "My List", is_hot: true, status: "pending", industry: "AI / ML", location: "San Francisco, CA" },
  { name: "Neeraj M.", job_title: "Founder and CEO", company: "SavingsOak", linkedin_url: "https://linkedin.com/in/neeraj-m", ai_score: 2, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", status: "pending", industry: "FinTech", location: "New York, NY" },
  { name: "Dmitry Maly", job_title: "Co-Founder", company: "Mentiq", linkedin_url: "https://linkedin.com/in/dmitry-maly", ai_score: 2, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", status: "pending", industry: "EdTech", location: "Tel Aviv, Israel" },
  { name: "Prakhar Gangwar", job_title: "Co-founder and COO", company: "Stealth Mode Startup", linkedin_url: "https://linkedin.com/in/prakhar-gangwar", ai_score: 2, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", status: "pending", industry: "Software Development", location: "Bangalore, India" },
  { name: "Anuraj Belbase", job_title: "Founder", company: "Noise2Signal", linkedin_url: "https://linkedin.com/in/anuraj-belbase", ai_score: 2, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", status: "pending", industry: "AI / ML", location: "Kathmandu, Nepal" },
  { name: "Emre TACYILDIZ", job_title: "Founder", company: "REFKOD", linkedin_url: "https://linkedin.com/in/emre-tacyildiz", ai_score: 3, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", is_hot: true, status: "pending", industry: "Software Development", location: "Istanbul, Turkey" },
  { name: "Aleksand Manokhin", job_title: "Founder", company: "Never Sleep Upwork Auto-Responder", linkedin_url: "https://linkedin.com/in/aleksand-manokhin", ai_score: 3, fit_status: "good", signal_source: "SaaS", list_name: "Manny list", is_hot: true, status: "pending", industry: "Automation", location: "Kyiv, Ukraine" },
  { name: "Adrian B. Siggerud", job_title: "Founder, CEO & Board Director", company: "Campaign Shark", linkedin_url: "https://linkedin.com/in/adrian-siggerud", ai_score: 3, fit_status: "good", signal_source: "SaaS", list_name: "My List", is_hot: true, status: "contacted", industry: "Computer Software", location: "Norway" },
  { name: "Meg Bear", job_title: "CPO", company: "SAP SuccessFactors", linkedin_url: "https://linkedin.com/in/meg-bear", ai_score: 2, fit_status: "good", signal_source: "SaaS", list_name: "My List", status: "contacted", industry: "HR Tech", location: "San Francisco, CA" },
  { name: "Michael Williamson", job_title: "VP of Sales", company: "Salesforce", linkedin_url: "https://linkedin.com/in/michael-williamson", ai_score: 2, fit_status: "maybe", signal_source: "SaaS", list_name: "My List", status: "contacted", industry: "CRM", location: "San Francisco, CA" },
];

const SEED_MESSAGES = [
  { sender_name: "Manny Artino", recipient_name: "Adrian B. Siggerud", body: "Adrian, noticed you checked out my profile.\n\nQuick q - how many times have you re-explained your product and ICP to GPT/Claude this week?\n\nRecently built GrowthCodex, AI consultant that generates your strategy and builds your assets in one click.", channel: "linkedin", direction: "outbound", is_read: true },
  { sender_name: "Manny Artino", recipient_name: "Meg Bear", body: "Meg, saw you engaging with content about AI-powered sales...", channel: "linkedin", direction: "outbound", is_read: true },
  { sender_name: "Manny Artino", recipient_name: "Michael Williamson", body: "Michael, noticed you're building out your sales tech stack...", channel: "linkedin", direction: "outbound", is_read: true },
  { sender_name: "Harshul Gupta", recipient_name: "Manny Artino", body: "Will the model be trained on our data?", channel: "linkedin", direction: "inbound", is_read: false },
  { sender_name: "Michael Bremmer", recipient_name: "Manny Artino", body: "No, I don't do cold emails. But thanks", channel: "linkedin", direction: "inbound", is_read: true },
  { sender_name: "Nigel Thomas", recipient_name: "Manny Artino", body: "Great to connect Manny! What prior experience do you have in this space?", channel: "linkedin", direction: "inbound", is_read: true },
];

const SEED_CAMPAIGNS = [
  { name: "My Campaign", status: "active", sender_name: "Manny Artino", contacts_count: 460, invitations_sent: 116, messages_sent: 53, replies_count: 13, workflow_steps: [{ type: "invitation", label: "Send Invitation", step: 1 }, { type: "message", label: "Send Message", step: 2, note: "AI Icebreaker" }, { type: "message", label: "Send Message", step: 3, note: "Follow up" }] },
  { name: "Healthcare Outreach", status: "paused", sender_name: "Manny Artino", contacts_count: 120, invitations_sent: 45, messages_sent: 20, replies_count: 5, workflow_steps: [{ type: "invitation", step: 1 }, { type: "message", step: 2 }] },
];

const SEED_AGENTS = [
  { name: "GrowthCodex - Agent", target_job_titles: ["Founder", "CEO", "Head of Growth", "Co-founder"], target_locations: ["North America", "Europe", "Canada"], target_industries: ["Software Development & SaaS"], company_sizes: ["1-10 employees", "11-50 employees"], excluded_keywords: ["Clay", "Lavender", "Apollo.io"], lead_matching_mode: 80, linkedin_page_url: "https://www.linkedin.com/company/growthcodex/", track_profile_visitors: true, track_job_changes: true, track_top_profiles: true, status: "active", leads_generated: 739 },
  { name: "My Agent", target_job_titles: ["VP Sales", "Sales Director", "Revenue Leader"], target_locations: ["United States", "United Kingdom"], target_industries: ["B2B SaaS", "Enterprise Software"], company_sizes: ["51-200 employees", "201-500 employees"], excluded_keywords: [], lead_matching_mode: 60, track_profile_visitors: false, track_job_changes: true, track_funding_events: true, status: "active", leads_generated: 284 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orgId = user.email;
    const results = { leads: 0, messages: 0, campaigns: 0, agents: 0 };

    // Seed Leads
    for (const lead of SEED_LEADS) {
      const existing = await base44.asServiceRole.entities.Lead.filter({ name: lead.name });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Lead.create({
          ...lead,
          org_id: orgId,
          import_date: new Date().toISOString().split('T')[0],
        });
        results.leads++;
      }
    }

    // Seed Messages
    for (const msg of SEED_MESSAGES) {
      const existing = await base44.asServiceRole.entities.Message.filter({ sender_name: msg.sender_name, recipient_name: msg.recipient_name });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Message.create({ ...msg, org_id: orgId });
        results.messages++;
      }
    }

    // Seed Campaigns
    for (const campaign of SEED_CAMPAIGNS) {
      const existing = await base44.asServiceRole.entities.Campaign.filter({ name: campaign.name });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Campaign.create({ ...campaign, org_id: orgId });
        results.campaigns++;
      }
    }

    // Seed Signal Agents
    for (const agent of SEED_AGENTS) {
      const existing = await base44.asServiceRole.entities.SignalAgent.filter({ name: agent.name });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.SignalAgent.create({ ...agent, org_id: orgId });
        results.agents++;
      }
    }

    console.log('[seedDatabase] Seed complete:', results);
    return Response.json({ success: true, seeded: results }, { status: 200 });

  } catch (error) {
    console.error('[seedDatabase] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});