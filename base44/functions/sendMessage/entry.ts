import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Unified Inbox Reply — send a message from the Unibox.
 *
 * Saves the message to the Message entity and triggers an outbound API call
 * to the appropriate channel (LinkedIn/Email via Unipile — placeholder).
 *
 * Payload: { lead_id, org_id, body, channel? }
 * Returns: { success, message_id }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { lead_id, org_id, body: messageBody, channel = "linkedin" } = await req.json();

    if (!lead_id || !org_id || !messageBody?.trim()) {
      return Response.json({ error: "lead_id, org_id, and body are required" }, { status: 400 });
    }

    // Security: verify lead belongs to org
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    const lead = leads[0];
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    if (lead.org_id !== org_id) return Response.json({ error: "Forbidden" }, { status: 403 });

    // Fetch org settings to get Unipile API key for actual sending
    let orgSettings = null;
    try {
      const settings = await base44.asServiceRole.entities.OrganizationSettings.filter({ org_id });
      orgSettings = settings[0] || null;
    } catch (_) {}

    const unipileKey = orgSettings?.api_key_unipile;

    // Save the message to the database
    const message = await base44.asServiceRole.entities.Message.create({
      org_id,
      lead_id,
      sender_name: user.full_name || user.email,
      recipient_name: lead.name,
      body: messageBody.trim(),
      channel,
      direction: "outbound",
      is_read: true,
      avatar_url: lead.avatar_url || null,
    });

    // Attempt real channel delivery if Unipile is configured
    let deliveryStatus = "queued";
    let deliveryError = null;

    if (unipileKey && lead.linkedin_url) {
      try {
        // Unipile messaging API (LinkedIn send message)
        const unipileRes = await fetch("https://api2.unipile.com:13226/api/v1/chats", {
          method: "POST",
          headers: {
            "X-API-KEY": unipileKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attendees_ids: [lead.linkedin_url],
            text: messageBody.trim(),
          }),
        });
        if (unipileRes.ok) {
          deliveryStatus = "sent";
        } else {
          const errBody = await unipileRes.text();
          deliveryError = `Unipile error: ${unipileRes.status} ${errBody}`;
          deliveryStatus = "failed";
        }
      } catch (e) {
        deliveryError = e.message;
        deliveryStatus = "failed";
      }
    } else {
      // No Unipile key — message is queued/saved only
      deliveryStatus = unipileKey ? "queued" : "saved_no_integration";
    }

    // Update lead activity log
    const existingLog = Array.isArray(lead.activity_log) ? lead.activity_log : [];
    await base44.asServiceRole.entities.Lead.update(lead_id, {
      status: "contacted",
      activity_log: [...existingLog, {
        type: "message_sent",
        description: `Message sent via ${channel} by ${user.full_name || user.email}. Status: ${deliveryStatus}`,
        timestamp: new Date().toISOString(),
      }],
    });

    // Log system health if delivery failed
    if (deliveryStatus === "failed") {
      try {
        await base44.asServiceRole.entities.SystemHealthLog.create({
          org_id,
          event_type: "message_delivery_failure",
          source: "sendMessage",
          status: "error",
          details: deliveryError || "Unknown delivery error",
          timestamp: new Date().toISOString(),
        });
      } catch (_) {}
    }

    console.log(`[sendMessage] Message sent by ${user.email} to ${lead.name} via ${channel}. Status: ${deliveryStatus}`);

    return Response.json({
      success: true,
      message_id: message.id,
      delivery_status: deliveryStatus,
      delivery_error: deliveryError || undefined,
    }, { status: 200 });

  } catch (error) {
    console.error("[sendMessage] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});