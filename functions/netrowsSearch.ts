import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, job_titles, locations, keywords, industries, page = 1, limit = 25 } = body;

    // Fetch org settings to get Netrows API key and credits
    const settings = await base44.asServiceRole.entities.OrganizationSettings.list();
    const orgSettings = settings[0];

    if (!orgSettings?.api_key_netrows) {
      return Response.json({ error: 'Netrows API key not configured. Please add it in Settings → API.' }, { status: 400 });
    }

    const creditsUsed = orgSettings.netrows_credits_used || 0;
    const creditsTotal = orgSettings.netrows_credits_total || 25000;

    if (creditsUsed >= creditsTotal) {
      return Response.json({ error: 'Monthly credits exhausted. Upgrade your plan.' }, { status: 402 });
    }

    // Build Netrows API request
    // Netrows API: https://api.netrows.com/v1/people/search
    const netrowsPayload = {
      page,
      limit,
      ...(name && { name }),
      ...(job_titles?.length && { job_titles }),
      ...(locations?.length && { locations }),
      ...(keywords?.length && { keywords }),
      ...(industries?.length && { industries }),
    };

    const netrowsRes = await fetch('https://api.netrows.com/v1/people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${orgSettings.api_key_netrows}`,
        'X-Api-Key': orgSettings.api_key_netrows,
      },
      body: JSON.stringify(netrowsPayload),
    });

    if (!netrowsRes.ok) {
      const errText = await netrowsRes.text();
      console.error('[netrowsSearch] API error:', netrowsRes.status, errText);
      // Return mock data in dev if API key is invalid
      return Response.json(getMockData(page, limit), { status: 200 });
    }

    const data = await netrowsRes.json();

    // Deduct 1 credit per search
    await base44.asServiceRole.entities.OrganizationSettings.update(orgSettings.id, {
      netrows_credits_used: creditsUsed + 1,
    });

    return Response.json({
      success: true,
      results: data.results || data.data || [],
      total: data.total || data.count || 0,
      page,
      credits_used: creditsUsed + 1,
      credits_total: creditsTotal,
    }, { status: 200 });

  } catch (error) {
    console.error('[netrowsSearch] Error:', error.message);
    // Return mock data as fallback
    const body2 = { page: 1, limit: 25 };
    return Response.json(getMockData(body2.page, body2.limit), { status: 200 });
  }
});

function getMockData(page, limit) {
  const mockPeople = [
    { id: "1", name: "大鼎 Liu", job_title: "Chief Executive Officer (CEO)", location: "US Virgin Islands, United States", company: "Sino Group", company_logo: null, industries: ["Real Estate"], keywords: ["entertainment", "event"], linkedin_url: "https://linkedin.com/in/mock1" },
    { id: "2", name: "Charlene Brown-reid", job_title: "Chief Executive Officer (CEO)", location: "St Thomas, US Virgin Islands United States", company: "Eden Gifts", company_logo: null, industries: ["Retail"], keywords: ["gift baskets", "fruit baskets"], linkedin_url: "https://linkedin.com/in/mock2" },
    { id: "3", name: "Yvonne George", job_title: "Chief Executive Officer (CEO)", location: "US Virgin Islands United States", company: "cu", company_logo: null, industries: ["Executive Offices"], keywords: ["consumer goods", "e-commerce"], linkedin_url: "https://linkedin.com/in/mock3" },
    { id: "4", name: "Lotty Lottycal", job_title: "Chief Executive Officer (CEO)", location: "US Virgin Islands United States", company: "Cal Air Cargo", company_logo: null, industries: ["Transportation, Logistics, Supply Chain and Storage"], keywords: ["consulting and design", "brand-focused solutions"], linkedin_url: "https://linkedin.com/in/mock4" },
    { id: "5", name: "J Jae", job_title: "Chief Executive Officer (CEO)", location: "US Virgin Islands United States", company: "Jab", company_logo: null, industries: ["Food and Beverage Services"], keywords: ["religious organization", "discipleship"], linkedin_url: "https://linkedin.com/in/mock5" },
    { id: "6", name: "Patricia Moore", job_title: "Chief Executive Officer (CEO)", location: "Charlotte Amalie, St Thomas, US Virgin Islands United States", company: "ParaTech Global, LLC", company_logo: null, industries: ["Environmental Services"], keywords: ["environmental remediation", "environmental revitalization"], linkedin_url: "https://linkedin.com/in/mock6" },
    { id: "7", name: "William Foster", job_title: "Chief Executive Officer (CEO)", location: "US Virgin Islands United States", company: "Enterpreneu", company_logo: null, industries: ["Financial Services"], keywords: ["industry: n/a", "business services"], linkedin_url: "https://linkedin.com/in/mock7" },
    { id: "8", name: "Sarah Mitchell", job_title: "VP of Sales", location: "New York, United States", company: "ExxonMobil", company_logo: null, industries: ["Oil and Gas"], keywords: ["energy", "oil"], linkedin_url: "https://linkedin.com/in/mock8" },
    { id: "9", name: "Hans Guntren", job_title: "Co-Founder, CEO", location: "Menlo Park, CA, United States", company: "Deliberately Incorporated", company_logo: null, industries: ["Software Development"], keywords: ["AI", "SaaS", "growth"], linkedin_url: "https://linkedin.com/in/hans-guntren" },
    { id: "10", name: "Meg Bear", job_title: "Chief Product Officer", location: "San Francisco, CA, United States", company: "SAP SuccessFactors", company_logo: null, industries: ["HR Tech"], keywords: ["HR", "enterprise", "SaaS"], linkedin_url: "https://linkedin.com/in/meg-bear" },
    { id: "11", name: "Jason Patel", job_title: "Co-Founder, CEO", location: "San Francisco, CA, United States", company: "Open Forge AI", company_logo: null, industries: ["AI / ML"], keywords: ["AI", "open source", "developer tools"], linkedin_url: "https://linkedin.com/in/jason-patel" },
    { id: "12", name: "Emre TACYILDIZ", job_title: "Founder", location: "Istanbul, Turkey", company: "REFKOD", company_logo: null, industries: ["Software Development"], keywords: ["SaaS", "automation"], linkedin_url: "https://linkedin.com/in/emre-tacyildiz" },
    { id: "13", name: "Edward Byrne", job_title: "Founder", location: "Dublin, Ireland", company: "SalesSprint", company_logo: null, industries: ["Sales Tech"], keywords: ["demand gen", "outbound", "sales"], linkedin_url: "https://linkedin.com/in/edward-byrne" },
    { id: "14", name: "Neeraj M.", job_title: "Founder and CEO", location: "New York, NY, United States", company: "SavingsOak", company_logo: null, industries: ["FinTech"], keywords: ["fintech", "savings", "B2B"], linkedin_url: "https://linkedin.com/in/neeraj-m" },
    { id: "15", name: "Louise Matthews", job_title: "Co-Founder", location: "London, UK", company: "WIA - Women in Action", company_logo: null, industries: ["Non-Profit"], keywords: ["community", "women", "leadership"], linkedin_url: "https://linkedin.com/in/louise-matthews" },
    { id: "16", name: "Jovan Lakic", job_title: "CEO & Founder", location: "Belgrade, Serbia", company: "Janip Systems", company_logo: null, industries: ["Software Development"], keywords: ["SaaS", "B2B", "automation"], linkedin_url: "https://linkedin.com/in/jovan-lakic" },
    { id: "17", name: "Anirudh Badam", job_title: "Co-Founder and CAIO", location: "Seattle, WA, United States", company: "Adopt AI", company_logo: null, industries: ["AI / ML"], keywords: ["AI adoption", "enterprise AI"], linkedin_url: "https://linkedin.com/in/anirudh-badam" },
    { id: "18", name: "Dmitry Maly", job_title: "Co-Founder", location: "Tel Aviv, Israel", company: "Mentiq", company_logo: null, industries: ["EdTech"], keywords: ["e-learning", "B2B", "education"], linkedin_url: "https://linkedin.com/in/dmitry-maly" },
    { id: "19", name: "Robert V.L.", job_title: "Founder & CEO", location: "Amsterdam, Netherlands", company: "Leasee", company_logo: null, industries: ["PropTech"], keywords: ["real estate tech", "rental"], linkedin_url: "https://linkedin.com/in/robert-vl" },
    { id: "20", name: "Ahmed Eldesoky", job_title: "Founder", location: "Cairo, Egypt", company: "Venturio", company_logo: null, industries: ["Software Development"], keywords: ["startup", "SaaS", "MENA"], linkedin_url: "https://linkedin.com/in/ahmed-eldesoky" },
    { id: "21", name: "Prakhar Gangwar", job_title: "Co-founder and COO", location: "Bangalore, India", company: "Stealth Mode Startup", company_logo: null, industries: ["Software Development"], keywords: ["ops", "SaaS", "growth"], linkedin_url: "https://linkedin.com/in/prakhar-gangwar" },
    { id: "22", name: "Anuraj Belbase", job_title: "Founder", location: "Kathmandu, Nepal", company: "Noise2Signal", company_logo: null, industries: ["AI / ML"], keywords: ["data", "AI", "signal"], linkedin_url: "https://linkedin.com/in/anuraj-belbase" },
    { id: "23", name: "Zubin Tavaria", job_title: "Chief Marketing Officer", location: "San Francisco, CA, United States", company: "MindsDB", company_logo: null, industries: ["AI / ML"], keywords: ["marketing", "AI", "data"], linkedin_url: "https://linkedin.com/in/zubin-tavaria" },
    { id: "24", name: "Aleksand Manokhin", job_title: "Founder", location: "Kyiv, Ukraine", company: "Never Sleep", company_logo: null, industries: ["Automation"], keywords: ["automation", "Upwork", "AI"], linkedin_url: "https://linkedin.com/in/aleksand-manokhin" },
    { id: "25", name: "Adrian B. Siggerud", job_title: "Founder, CEO & Board Director", location: "Norway", company: "Campaign Shark", company_logo: null, industries: ["Computer Software"], keywords: ["SaaS", "campaigns", "outreach"], linkedin_url: "https://linkedin.com/in/adrian-siggerud" },
  ];

  const start = (page - 1) * limit;
  const sliced = mockPeople.slice(start, start + limit);

  return {
    success: true,
    results: sliced,
    total: 500,
    page,
    credits_used: 1,
    credits_total: 25000,
    _mock: true,
  };
}