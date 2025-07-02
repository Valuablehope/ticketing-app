import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface AuthUser {
  email: string;
}

interface HisUser {
  id: string;
  full_name: string;
  role: string;
  telegram_chat_id?: number;
  auth_user?: AuthUser;
}

interface TelegramUser {
  id: string;
  email: string;
  chat_id: string;
  created_at?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  try {
    console.log("🚀 Edge Function called");
    
    const authHeader = req.headers.get("Authorization");
    const expectedToken = Deno.env.get("SUPABASE_ANON_KEY");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or malformed authorization header");
      return new Response(
        JSON.stringify({ error: "Missing or malformed authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.split(" ")[1];
    if (expectedToken && token !== expectedToken) {
      console.error("❌ Unauthorized token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestBody = await req.json();
    console.log("📥 Request body:", requestBody);

    const {
      email,
      title,
      status,
      type,
      ticket_number,
      description,
      submitter_email,
    } = requestBody;

    // Validate required fields
    if (!email || !title || !status || !type || !ticket_number) {
      console.error("❌ Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!supabaseUrl || !supabaseKey || !botToken) {
      console.error("❌ Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    let chatId: string | null = null;
    let telegramMessage = "";
    let recipientInfo = "";

    console.log("🔍 Processing notification type:", type);

    if (type === "submit") {
      console.log("📧 Finding submitter chat ID for:", email);
      
      // Find submitter's Telegram chat ID
      chatId = await findUserChatId(email, supabaseUrl, supabaseHeaders);

      if (!chatId) {
        console.error("❌ Submitter not found:", email);
        return new Response(
          JSON.stringify({
            error: "User not found or no Telegram chat ID",
            email: email,
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      recipientInfo = `Submitter: ${email}`;
      telegramMessage = `
🎫 *Ticket Submitted Successfully*

🆔 *Ticket ID:* ${ticket_number}
📝 *Title:* ${title}
📌 *Status:* ${status}
🕒 *Submitted:* ${new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Beirut",
      })}

📋 *Description:*
${description}

✅ Your ticket has been submitted and our support team will review it shortly.

You can track your ticket status using the ticket ID above.
`.trim();

    } else if (type === "status_update") {
      console.log("🔄 Sending status update notification to:", email);
      
      // Find submitter's Telegram chat ID for status update
      chatId = await findUserChatId(email, supabaseUrl, supabaseHeaders);

      if (!chatId) {
        console.error("❌ Submitter not found for status update:", email);
        return new Response(
          JSON.stringify({
            error: "User not found or no Telegram chat ID",
            email: email,
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      recipientInfo = `Submitter: ${email}`;
      
      // Get status emoji and message
      const statusEmoji = getStatusEmoji(status);
      const statusMessage = getStatusMessage(status);
      
      telegramMessage = `
🔄 *Ticket Status Updated*

🆔 *Ticket ID:* ${ticket_number}
📝 *Title:* ${title}
${statusEmoji} *New Status:* ${status}
🕒 *Updated:* ${new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Beirut",
      })}

${statusMessage}

💡 You can track your ticket progress using the ticket ID above.
`.trim();

    } else if (type === "admin_notify") {
      console.log("👨‍💼 Finding admin chat ID");
      
      // Find an admin with Telegram chat ID
      const adminInfo = await findAdminChatId(supabaseUrl, supabaseHeaders);

      if (!adminInfo) {
        console.error("❌ No admin with Telegram chat ID found");
        return new Response(
          JSON.stringify({
            error: "No admin with Telegram chat ID found",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      chatId = adminInfo.chat_id;
      recipientInfo = `Admin: ${adminInfo.email}`;

      telegramMessage = `
🚨 *New Support Ticket*

🆔 *Ticket ID:* ${ticket_number}
👤 *Submitted by:* ${submitter_email || email}
📝 *Title:* ${title}
📌 *Status:* ${status}
🕒 *Date:* ${new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Beirut",
      })}

📋 *Description:*
${description}

⚡ Please review and assign this ticket to the appropriate team member.

🔗 Access the admin panel to manage this ticket.
`.trim();

    } else {
      console.error("❌ Invalid notification type:", type);
      return new Response(
        JSON.stringify({ error: "Invalid notification type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("📤 Sending Telegram message to chat_id:", chatId);
    console.log("💬 Message preview:", telegramMessage.substring(0, 100) + "...");

    // Send Telegram message
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramMessage,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    const telegramData = await telegramRes.json();
    console.log("📱 Telegram API response:", telegramData);

    if (!telegramRes.ok) {
      console.error("❌ Telegram API Error:", telegramData);
      return new Response(
        JSON.stringify({
          error: "Failed to send Telegram message",
          detail: telegramData,
          recipient: recipientInfo,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Telegram notification sent successfully to ${recipientInfo}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notification sent to ${
          type === "admin_notify" ? "admin" : "submitter"
        }`,
        recipient: recipientInfo,
        telegram_message_id: telegramData.message_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("❌ Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        detail: String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Get emoji for ticket status
 */
function getStatusEmoji(status: string): string {
  const statusEmojis: Record<string, string> = {
    "Open": "📋",
    "In Progress": "⚡",
    "Resolved": "✅",
    "Closed": "🔒",
    "On Hold": "⏸️",
  };
  return statusEmojis[status] || "📋";
}

/**
 * Get contextual message for status update
 */
function getStatusMessage(status: string): string {
  const statusMessages: Record<string, string> = {
    "Open": "🟡 Your ticket is waiting to be reviewed by our support team.",
    "In Progress": "🔧 Our team is actively working on resolving your issue.",
    "Resolved": "🎉 Great news! Your ticket has been resolved. Please check if the issue is fixed.",
    "Closed": "📋 This ticket has been closed. If you need further assistance, please submit a new ticket.",
    "On Hold": "⏳ Your ticket is temporarily on hold. We'll resume work as soon as possible.",
  };
  return statusMessages[status] || "📄 Your ticket status has been updated.";
}

/**
 * Find user's Telegram chat ID by email
 */
async function findUserChatId(
  email: string,
  supabaseUrl: string,
  headers: Record<string, string>
): Promise<string | null> {
  try {
    console.log("🔍 Looking for user chat ID:", email);
    
    // First, try telegram_users table
    const telegramRes = await fetch(
      `${supabaseUrl}/rest/v1/telegram_users?email=eq.${encodeURIComponent(
        email
      )}&select=chat_id`,
      { headers }
    );

    if (telegramRes.ok) {
      const telegramUsers: TelegramUser[] = await telegramRes.json();
      console.log("📱 Telegram users found:", telegramUsers);
      
      if (telegramUsers.length > 0 && telegramUsers[0].chat_id) {
        console.log("✅ Found user via telegram_users");
        return telegramUsers[0].chat_id;
      }
    }

    // Fallback: Get user ID from auth.users, then check his_users
    const authUserRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_user_by_email`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_email: email })
      }
    );

    if (authUserRes.ok) {
      const authUser = await authUserRes.json();
      console.log("👤 Auth user found:", authUser);
      
      if (authUser && authUser.id) {
        // Check his_users for telegram_chat_id
        const hisUserRes = await fetch(
          `${supabaseUrl}/rest/v1/his_users?id=eq.${authUser.id}&select=telegram_chat_id`,
          { headers }
        );
        
        if (hisUserRes.ok) {
          const hisUsers = await hisUserRes.json();
          if (hisUsers.length > 0 && hisUsers[0].telegram_chat_id) {
            console.log("✅ Found user via his_users");
            return hisUsers[0].telegram_chat_id.toString();
          }
        }
      }
    }

    console.log("❌ No chat ID found for user:", email);
    return null;
  } catch (error) {
    console.error("❌ Error finding user chat ID:", error);
    return null;
  }
}

/**
 * Find admin's Telegram chat ID - DIRECT APPROACH
 * Since we know Ali has telegram_chat_id: 766018660, let's find him directly
 */
async function findAdminChatId(
  supabaseUrl: string,
  headers: Record<string, string>
): Promise<{ chat_id: string; email: string } | null> {
  try {
    console.log("🔍 DEBUG: Starting admin lookup - direct approach");
    
    // STEP 1: Get admins with telegram_chat_id (no joins needed)
    const adminQuery = `${supabaseUrl}/rest/v1/his_users?select=id,full_name,telegram_chat_id&role=eq.admin&telegram_chat_id=not.is.null`;
    console.log("📡 Admin query (no joins):", adminQuery);
    
    const adminsRes = await fetch(adminQuery, { headers });
    console.log("📊 Admin query response status:", adminsRes.status);

    if (!adminsRes.ok) {
      const errorText = await adminsRes.text();
      console.error("❌ Failed to fetch admins:", errorText);
      return null;
    }

    const admins = await adminsRes.json();
    console.log("👥 Found admins with telegram_chat_id:", admins);
    console.log("👥 Number of admins found:", admins.length);

    if (admins.length === 0) {
      console.error("❌ No admins found with telegram_chat_id");
      return null;
    }

    // STEP 2: For each admin, try to get their email
    for (const admin of admins) {
      console.log("🔍 Processing admin:", {
        id: admin.id,
        full_name: admin.full_name,
        telegram_chat_id: admin.telegram_chat_id
      });

      // Try to get email from auth.users directly (without join)
      try {
        const authQuery = `${supabaseUrl}/auth/v1/admin/users/${admin.id}`;
        console.log("📡 Auth query for admin:", authQuery);
        
        const authRes = await fetch(authQuery, {
          headers: {
            ...headers,
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          }
        });

        if (authRes.ok) {
          const authUser = await authRes.json();
          console.log("📧 Auth user found:", { id: authUser.id, email: authUser.email });
          
          if (authUser.email) {
            console.log("✅ FOUND ADMIN with email:", {
              full_name: admin.full_name,
              email: authUser.email,
              chat_id: admin.telegram_chat_id.toString()
            });
            
            return {
              chat_id: admin.telegram_chat_id.toString(),
              email: authUser.email,
            };
          }
        } else {
          console.warn("⚠️ Failed to get auth user for admin:", admin.id);
        }
      } catch (authError) {
        console.warn("⚠️ Auth query failed for admin:", admin.id, authError);
      }

      // FALLBACK: Use telegram_chat_id even without email
      console.log("🔄 Using admin without email verification:", {
        full_name: admin.full_name,
        chat_id: admin.telegram_chat_id.toString()
      });
      
      return {
        chat_id: admin.telegram_chat_id.toString(),
        email: `${admin.full_name?.toLowerCase().replace(/\s+/g, '.')}@admin.local`, // Placeholder email
      };
    }

    console.error("❌ Could not find usable admin");
    return null;

  } catch (error) {
    console.error("❌ Error finding admin chat ID:", error);
    return null;
  }
}