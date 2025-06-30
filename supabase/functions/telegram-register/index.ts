import { createClient } from "https://deno.land/x/supabase_js@2.39.6/mod.ts";

// Define reusable CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  // ✅ Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, title, status, type } = await req.json();

    const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    global: {
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      },
    },
  }
);


    // Look up Telegram chat_id by email
    const { data, error } = await supabase
      .from("telegram_users")
      .select("chat_id")
      .eq("email", email)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "User not found or not registered." }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const chatId = data.chat_id;
    const message =
      type === "submit"
        ? `📬 New Ticket Submitted:\n🎫 Title: ${title}\n📌 Status: ${status}`
        : `🔄 Ticket Updated:\n🎫 Title: ${title}\n📌 New Status: ${status}`;

    const telegramUrl = `https://api.telegram.org/bot${Deno.env.get("TELEGRAM_TOKEN")}/sendMessage`;

    const telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    if (!telegramResponse.ok) {
      const errorText = await telegramResponse.text();
      return new Response(
        JSON.stringify({
          error: "Failed to send Telegram message",
          details: errorText,
        }),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
