// src/pages/api/quickbooks/accounts.js
// Fetch QuickBooks Chart of Accounts

import { fetchAccounts } from "../../../lib/quickbooksService.js";

/**
 * GET /api/quickbooks/accounts
 * 
 * Fetches Chart of Accounts from QuickBooks
 * Requires valid access token stored in database
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // TODO: Retrieve stored access token and realmId from database
    // Example (pseudo-code):
    // const { data: tokenData } = await supabase
    //   .from('quickbooks_tokens')
    //   .select('access_token, realm_id, expires_at')
    //   .eq('user_id', req.user.id)
    //   .single();
    //
    // if (!tokenData) {
    //   return res.status(401).json({ error: 'Not connected to QuickBooks' });
    // }
    //
    // // Check if token is expired and refresh if needed
    // if (new Date(tokenData.expires_at) < new Date()) {
    //   // Refresh token logic here
    // }

    // For now, return placeholder indicating token storage needed
    return res.status(401).json({
      error: "Not connected to QuickBooks",
      message: "Please connect your QuickBooks account first",
      action: "Visit /api/quickbooks/connect to authorize",
      todo: [
        "Implement token storage in database (e.g., quickbooks_tokens table)",
        "Retrieve access_token and realm_id from database",
        "Check token expiry and refresh if needed",
        "Call fetchAccounts(accessToken, realmId)",
      ],
    });

    // When implemented, this would be:
    // const accounts = await fetchAccounts(tokenData.access_token, tokenData.realm_id);
    // return res.status(200).json({ accounts });
  } catch (error) {
    console.error("QuickBooks accounts error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
