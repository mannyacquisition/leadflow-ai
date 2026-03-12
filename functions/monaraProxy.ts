import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BASE_URL = "https://app.base44.com/api/apps/69b251ab62e42de666cb5b37/agents";
const API_KEY = Deno.env.get("MONARA_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { action, conversation_id, message, org_id, user_id } = await req.json();

    if (action === "create_conversation") {
      const res = await fetch(`${BASE_URL}/conversations`, {
        method: "POST",
        headers: { "api_key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: "default",
          metadata: { org_id: org_id || "default", user_id: user_id || user.id }
        })
      });
      const data = await res.json();
      return Response.json(data);
    }

    if (action === "send_message") {
      if (!conversation_id) return Response.json({ error: "conversation_id required" }, { status: 400 });
      const res = await fetch(`${BASE_URL}/conversations/${conversation_id}/messages`, {
        method: "POST",
        headers: { "api_key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: message })
      });
      const data = await res.json();
      // Extract the latest assistant message
      const messages = data.messages || [];
      const assistantMsg = [...messages].reverse().find(m => m.role === "assistant");
      return Response.json({ ...data, latest_assistant_message: assistantMsg || null });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});