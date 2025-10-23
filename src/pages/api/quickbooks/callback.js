// src/pages/api/quickbooks/callback.js
// QuickBooks OAuth callback endpoint
// Exchanges authorization code for tokens

import { exchangeCodeForTokens } from "../../../lib/quickbooksService.js";

/**
 * GET /api/quickbooks/callback
 * 
 * Handles OAuth callback from QuickBooks
 * Query params: code, state, realmId
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, state, realmId } = req.query;

  if (!code || !realmId) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>QuickBooks Connection Failed</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>Connection Failed</h1>
          <p>Missing authorization code or company ID.</p>
          <p><a href="/">Return to Dashboard</a></p>
        </body>
      </html>
    `);
  }

  try {
    // TODO: Verify state parameter to prevent CSRF

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, realmId);

    // TODO: Store tokens in secure database or secrets manager
    // Example (pseudo-code):
    // await supabase.from('quickbooks_tokens').upsert({
    //   user_id: req.user.id, // From session
    //   realm_id: tokens.realm_id,
    //   access_token: tokens.access_token,
    //   refresh_token: tokens.refresh_token,
    //   expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    //   updated_at: new Date()
    // });

    // For now, just show success page
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QuickBooks Connected</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
              text-align: center;
            }
            .success {
              background: #DCFCE7;
              border: 2px solid #BBF7D0;
              color: #166534;
              padding: 20px;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background: #111827;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              margin-top: 20px;
            }
            .token-info {
              background: #F3F4F6;
              padding: 12px;
              border-radius: 8px;
              margin-top: 20px;
              font-size: 12px;
              text-align: left;
              overflow: auto;
            }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ QuickBooks Connected!</h1>
            <p>Your QuickBooks account has been successfully connected.</p>
          </div>
          <p>Company ID: <strong>${realmId}</strong></p>
          <p>Tokens have been obtained and should be stored securely.</p>
          <div class="token-info">
            <strong>TODO for implementation:</strong><br/>
            - Store tokens in secure database (e.g., Supabase quickbooks_tokens table)<br/>
            - Associate tokens with current user session<br/>
            - Set up token refresh mechanism before expiry<br/>
            - Redirect to Budget page after storing tokens
          </div>
          <a href="/KPI-Dashboard/" class="button">Return to Dashboard</a>
          <a href="/KPI-Dashboard/#budget" class="button" style="background: #059669;">Go to Budget</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("QuickBooks callback error:", error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>QuickBooks Connection Error</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>Connection Error</h1>
          <p>Failed to connect QuickBooks: ${error.message}</p>
          <p><a href="/">Return to Dashboard</a></p>
        </body>
      </html>
    `);
  }
}
