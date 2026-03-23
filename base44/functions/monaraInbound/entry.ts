import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Universal inbound webhook for Monara AI
 * Route: POST /api/webhooks/monara-inbound
 * Accepts payloads from: Twilio (WhatsApp/SMS), Slack API, Discord API
 */
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    // Detect source platform
    let platform = 'web';
    let senderExternalId = null;
    let messageText = '';
    let orgId = body.org_id || null;

    // Twilio WhatsApp/SMS
    if (body.From && body.Body) {
      platform = body.From.startsWith('whatsapp:') ? 'whatsapp' : 'sms';
      senderExternalId = body.From;
      messageText = body.Body;
    }
    // Slack
    else if (body.event && body.event.type === 'message') {
      platform = 'slack';
      senderExternalId = body.event.user;
      messageText = body.event.text;
      orgId = body.team_id;
    }
    // Discord
    else if (body.content !== undefined && body.author) {
      platform = 'discord';
      senderExternalId = body.author.id;
      messageText = body.content;
    }
    // Generic
    else if (body.message) {
      messageText = body.message;
      platform = body.platform || 'web';
      senderExternalId = body.user_id;
      orgId = body.org_id;
    }

    if (!messageText) {
      return Response.json({ error: 'No message content found' }, { status: 400 });
    }

    // Match org from external user ID (simplified — in prod query OmnichannelIntegration table)
    if (!orgId) {
      const integrations = await base44.asServiceRole.entities.OmnichannelIntegration.list();
      const match = integrations.find(i => i.platform === platform && i.is_active);
      if (match) orgId = match.org_id;
    }

    // Find or create conversation
    const conversations = await base44.asServiceRole.entities.MonaraConversation.list();
    let conversation = conversations.find(
      c => c.external_user_id === senderExternalId && c.source_channel === platform
    );

    if (!conversation) {
      conversation = await base44.asServiceRole.entities.MonaraConversation.create({
        org_id: orgId || 'default',
        source_channel: platform,
        external_user_id: senderExternalId,
        title: `${platform} conversation`,
        last_message: messageText,
      });
    }

    // Save inbound message
    await base44.asServiceRole.entities.MonaraMessage.create({
      conversation_id: conversation.id,
      org_id: orgId || 'default',
      role: 'user',
      content: messageText,
      source_channel: platform,
    });

    // Process through LLM (Monara)
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are Monara, AI assistant for a B2B lead generation platform.
Platform: ${platform}. Keep response concise for ${platform} format.
User message: "${messageText}"
Respond helpfully. No markdown for SMS/WhatsApp.`,
    });

    const responseText = typeof llmResponse === 'string' ? llmResponse : llmResponse?.content || 'I processed your request.';

    // Save assistant response
    await base44.asServiceRole.entities.MonaraMessage.create({
      conversation_id: conversation.id,
      org_id: orgId || 'default',
      role: 'assistant',
      content: responseText,
      source_channel: platform,
    });

    // Update conversation last message
    await base44.asServiceRole.entities.MonaraConversation.update(conversation.id, {
      last_message: responseText,
    });

    console.log(`[monaraInbound] Processed ${platform} message from ${senderExternalId}`);

    // Return platform-specific response format
    if (platform === 'slack') {
      return Response.json({ text: responseText }, { status: 200 });
    } else if (platform === 'discord') {
      return Response.json({ content: responseText }, { status: 200 });
    } else {
      // Twilio-compatible TwiML for WhatsApp/SMS
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${responseText}</Message></Response>`;
      return new Response(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

  } catch (error) {
    console.error('[monaraInbound] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});