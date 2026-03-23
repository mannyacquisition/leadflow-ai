import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch(e) {}
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { action, conversation_id, message, org_id } = await req.json();

    if (action === "create_conversation") {
      // Auto-derive org_id from the authenticated user — never require the frontend to pass it
      const effectiveOrgId = org_id || user.org_id || user.email || "default";
      const conv = await base44.agents.createConversation({
        agent_name: "monara",
        metadata: { org_id: effectiveOrgId, user_id: user.id || user.email }
      });
      return Response.json({ ...conv, org_id: effectiveOrgId });
    }

    if (action === "send_message") {
      if (!conversation_id) return Response.json({ error: "conversation_id required" }, { status: 400 });

      // Get the full conversation object
      const conv = await base44.agents.getConversation(conversation_id);
      const messageCountBefore = (conv?.messages || []).length;

      // Inject org_id context so Monara never has to ask for it
      const effectiveOrgId = conv?.metadata?.org_id || user.org_id || user.email || "default";
      const enrichedMessage = `[Session context: org_id="${effectiveOrgId}", user="${user.full_name || user.email}"]\n\n${message}`;

      // Send the message
      await base44.agents.addMessage(conv, { role: "user", content: enrichedMessage });

      // Poll for the assistant response (up to 30s)
      let assistantMsg = null;
      let updatedMsgs = [];
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const updated = await base44.agents.getConversation(conversation_id);
        updatedMsgs = updated?.messages || [];
        // Look for a new assistant message after the messages we had before
        const newMsgs = updatedMsgs.slice(messageCountBefore);
        assistantMsg = [...newMsgs].reverse().find(m => m.role === "assistant");
        if (assistantMsg) break;
      }

      return Response.json({
        messages: updatedMsgs,
        latest_assistant_message: assistantMsg || null
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});