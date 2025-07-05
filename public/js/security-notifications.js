// === SECURITY & NOTIFICATIONS MODULE ===
(function() {
  "use strict";

  // Security validation
  function isValidSession() {
    try {
      const session = sessionStorage.getItem("ticketing_session");
      const signature = sessionStorage.getItem("session_signature");
      
      if (!session || !signature) return false;
      
      const sessionData = JSON.parse(session);
      if (!sessionData.expiration || sessionData.expiration <= Date.now()) return false;
      if (!sessionData.verified || !sessionData.token) return false;
      
      const signatureData = JSON.parse(atob(signature));
      if (!signatureData.token || !signatureData.timestamp || !signatureData.email) return false;
      if (signatureData.token !== sessionData.token) return false;
      if (Date.now() - signatureData.timestamp > 60 * 60 * 1000) return false;
      
      return true;
    } catch (error) {
      return false;
    }
  }

  function redirectToAuth() {
    sessionStorage.removeItem("ticketing_session");
    sessionStorage.removeItem("session_signature");
    
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; 
                  font-family: Inter, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  margin: 0; padding: 20px;">
        <div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-radius: 16px; 
                    padding: 40px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); max-width: 400px;">
          <h2 style="color: #333; margin-bottom: 20px;">Access Denied</h2>
          <p style="color: #666; margin-bottom: 20px;">Please verify your email address to access the ticketing system.</p>
          <div style="color: #667eea;">Redirecting...</div>
        </div>
      </div>
    `;
    
    setTimeout(() => window.location.href = "../index.html", 2000);
  }

  if (!isValidSession()) {
    redirectToAuth();
    return;
  }

  setInterval(() => {
    if (!isValidSession()) redirectToAuth();
  }, 60000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !isValidSession()) redirectToAuth();
  });
})();

// Telegram notification function
async function sendTelegramNotifications(formData, ticket) {
  const TELEGRAM_ENDPOINT = "https://rkdblbnmtzyrapfemswq.functions.supabase.co/telegram-notify";
  const SUPABASE_ANON_KEY = (window.SUPABASE_CONFIG || {}).anonKey;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };

  const results = { submitter: { success: false, error: null }, admin: { success: false, error: null } };

  const payloads = {
    submitter: { ...formData, ticket_number: ticket.ticket_number, status: "Open", type: "submit" },
    admin: { ...formData, ticket_number: ticket.ticket_number, status: "Open", type: "admin_notify", submitter_email: formData.email }
  };

  console.log("🔍 Starting notifications for ticket:", ticket.ticket_number);

  const [submitterResult, adminResult] = await Promise.allSettled([
    fetch(TELEGRAM_ENDPOINT, { method: "POST", headers, body: JSON.stringify(payloads.submitter) }),
    fetch(TELEGRAM_ENDPOINT, { method: "POST", headers, body: JSON.stringify(payloads.admin) })
  ]);

  // Process results
  for (const [type, result] of [['submitter', submitterResult], ['admin', adminResult]]) {
    if (result.status === 'fulfilled') {
      if (result.value.ok) {
        try {
          const data = await result.value.json();
          console.log(`✅ ${type} notification SUCCESS:`, data);
          results[type].success = true;
        } catch (e) {
          console.error(`❌ ${type} response parsing error:`, e);
          results[type].error = "Response parsing error";
        }
      } else {
        const errorText = await result.value.text().catch(() => "Could not read error");
        console.error(`❌ ${type} notification FAILED:`, errorText);
        results[type].error = `HTTP ${result.value.status}: ${errorText}`;
      }
    } else {
      console.error(`❌ ${type} request REJECTED:`, result.reason);
      results[type].error = result.reason?.message || "Network error";
    }
  }

  console.log("📊 Final notification results:", results);
  return results;
}

// Make function globally available
window.sendTelegramNotifications = sendTelegramNotifications;