import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Allow CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  try {
    // Optional: If you need to validate a service role key
    const authHeader = req.headers.get("Authorization");
    const expectedToken = Deno.env.get("SUPABASE_FUNCTION_SECRET"); // Optional secret check

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or malformed authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.split(" ")[1];
    if (expectedToken && token !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Read body
    const { email, title, status, type: _type, ticket_number, description } = await req.json();

    // Load chat_id from telegram_users table
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const res = await fetch(`${supabaseUrl}/rest/v1/telegram_users?email=eq.${email}`, {
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const users = await res.json();
    const user = users?.[0];

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const chat_id = user.chat_id;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramMessage = `
📩 *New Ticket Submitted*

🆔 *Ticket Number:* ${ticket_number}
👤 *User:* ${email}
📝 *Title:* ${title}
🧾 *Description:* ${description}
📌 *Status:* ${status}
🕒 *Date:* ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Beirut" })}
`;

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          text: telegramMessage,
          parse_mode: "Markdown",
        }),
      }
    );

    const telegramResult = await telegramRes.json();

    return new Response(JSON.stringify({ success: true, telegramResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal Server Error", detail: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
