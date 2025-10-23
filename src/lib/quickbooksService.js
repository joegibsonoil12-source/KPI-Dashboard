// src/lib/quickbooksService.js
// Server-side QuickBooks OAuth and API helpers
// NOTE: This must run server-side (Vercel/Netlify functions) to protect client secrets

/**
 * Get QuickBooks OAuth configuration from environment variables
 */
function getQuickBooksConfig() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  const environment = process.env.QUICKBOOKS_ENV || "sandbox"; // sandbox or production

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing QuickBooks configuration. Set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, and QUICKBOOKS_REDIRECT_URI"
    );
  }

  const baseUrl =
    environment === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";

  const authUrl =
    environment === "production"
      ? "https://appcenter.intuit.com/connect/oauth2"
      : "https://appcenter.intuit.com/connect/oauth2";

  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
    baseUrl,
    authUrl,
  };
}

/**
 * Exchange authorization code for access and refresh tokens
 * 
 * @param {string} code - Authorization code from OAuth callback
 * @param {string} realmId - QuickBooks company ID
 * @returns {Promise<{access_token, refresh_token, expires_in, x_refresh_token_expires_in}>}
 */
export async function exchangeCodeForTokens(code, realmId) {
  const config = getQuickBooksConfig();

  const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: config.redirectUri,
  });

  const authHeader = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();

    // TODO: Store tokens securely in database or secrets manager
    // Example structure:
    // await supabase.from('quickbooks_tokens').upsert({
    //   realm_id: realmId,
    //   access_token: tokens.access_token,
    //   refresh_token: tokens.refresh_token,
    //   expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    //   refresh_expires_at: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
    //   updated_at: new Date()
    // }, { onConflict: 'realm_id' });

    return {
      ...tokens,
      realm_id: realmId,
    };
  } catch (error) {
    console.error("QuickBooks token exchange error:", error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 * 
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{access_token, refresh_token, expires_in, x_refresh_token_expires_in}>}
 */
export async function refreshAccessToken(refreshToken) {
  const config = getQuickBooksConfig();

  const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const authHeader = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();

    // TODO: Update stored tokens in database

    return tokens;
  } catch (error) {
    console.error("QuickBooks token refresh error:", error);
    throw error;
  }
}

/**
 * Fetch QuickBooks accounts (Chart of Accounts)
 * 
 * @param {string} accessToken - Valid access token
 * @param {string} realmId - QuickBooks company ID
 * @returns {Promise<Array>} - List of accounts
 */
export async function fetchAccounts(accessToken, realmId) {
  const config = getQuickBooksConfig();

  const accountsUrl = `${config.baseUrl}/v3/company/${realmId}/query?query=select * from Account&minorversion=65`;

  try {
    const response = await fetch(accountsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fetch accounts failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // QuickBooks returns data in QueryResponse.Account
    return data.QueryResponse?.Account || [];
  } catch (error) {
    console.error("QuickBooks fetch accounts error:", error);
    throw error;
  }
}

/**
 * Revoke QuickBooks tokens
 * 
 * @param {string} refreshToken - Refresh token to revoke
 * @returns {Promise<void>}
 */
export async function revokeTokens(refreshToken) {
  const config = getQuickBooksConfig();

  const revokeUrl = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

  const body = new URLSearchParams({
    token: refreshToken,
  });

  const authHeader = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  try {
    const response = await fetch(revokeUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token revocation failed: ${response.status} ${errorText}`);
    }

    // TODO: Remove tokens from database

    return;
  } catch (error) {
    console.error("QuickBooks token revocation error:", error);
    throw error;
  }
}
