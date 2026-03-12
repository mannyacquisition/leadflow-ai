import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch(e) {}
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { action, conversation_id, message, org_id } = await req.json();

    if (action === "create_conversation") {
      const conv = await base44.agents.createConversation({
        agent_name: "monara",
        metadata: { org_id: org_id || "default", user_id: user.id }
      });
      return Response.json(conv);
    }

    if (action === "send_message") {
      if (!conversation_id) return Response.json({ error: "conversation_id required" }, { status: 400 });

      // Get the full conversation object first (needed by addMessage)
      const conv = await base44.agents.getConversation(conversation_id);

      // Add the user message and wait for response
      const updatedConv = await base44.agents.addMessage(conv, {
        role: "user",
        content: message,
      });

      // Extract the latest assistant message
      const msgs = updatedConv?.messages || [];
      const assistantMsg = [...msgs].reverse().find(m => m.role === "assistant");
      return Response.json({ messages: msgs, latest_assistant_message: assistantMsg || null });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("monaraProxy error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});