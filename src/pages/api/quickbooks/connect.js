// src/pages/api/quickbooks/connect.js
// QuickBooks OAuth initiation endpoint
// Redirects user to QuickBooks authorization page

/**
 * GET /api/quickbooks/connect
 * 
 * Initiates QuickBooks OAuth flow by redirecting to QuickBooks authorization page
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
    const environment = process.env.QUICKBOOKS_ENV || "sandbox";

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        error: "QuickBooks not configured",
        message: "Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_REDIRECT_URI environment variables",
      });
    }

    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(2);

    // TODO: Store state in session or database for verification in callback
    // For now, we'll just pass it through

    // QuickBooks OAuth scopes
    const scopes = [
      "com.intuit.quickbooks.accounting",
    ].join(" ");

    // Build authorization URL
    const authUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    // Redirect to QuickBooks
    return res.redirect(302, authUrl.toString());
  } catch (error) {
    console.error("QuickBooks connect error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
