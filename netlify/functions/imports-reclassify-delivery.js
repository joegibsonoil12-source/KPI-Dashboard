/**
 * Netlify Serverless Function: Reclassify Service Imports as Delivery
 * 
 * POST /.netlify/functions/imports-reclassify-delivery
 * URL format: /api/imports/reclassify-delivery
 * 
 * Admin-only endpoint to reclassify existing ticket_imports where 
 * meta.importType='service' but detection indicates 'delivery' with 
 * confidence >= 0.7
 * 
 * Environment Variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Request Body: (none required)
 * 
 * Response:
 * {
 *   success: boolean,
 *   reclassified: number,
 *   summary: {
 *     total: number,
 *     reclassified: number,
 *     skipped: number,
 *     details: Array
 *   }
 * }
 */

const { createClient } = require('@supabase/supabase-js');
const ocrParser = require('../../server/lib/ocrParser');

/**
 * Create Supabase client with service role key
 * @returns {Object} - Supabase client instance
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Check if user is admin
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - True if admin
 */
async function isAdmin(supabase, userId) {
  if (!userId) {
    return false;
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return data.role?.toLowerCase() === 'admin';
}

/**
 * Get user ID from authorization header
 * @param {string} authHeader - Authorization header value
 * @param {Object} supabase - Supabase client
 * @returns {Promise<string|null>} - User ID or null
 */
async function getUserIdFromAuth(authHeader, supabase) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return data.user.id;
  } catch (err) {
    console.error('[imports-reclassify] Error getting user:', err);
    return null;
  }
}

/**
 * Netlify Serverless Handler
 * @param {Object} event - Netlify event object
 * @param {Object} context - Netlify context object
 */
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed',
        message: 'Only POST requests are supported',
      }),
    };
  }

  try {
    console.debug('[imports-reclassify] Starting reclassification');
    
    // Initialize Supabase client
    const supabase = createSupabaseClient();
    
    // Check admin authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const userId = await getUserIdFromAuth(authHeader, supabase);
    
    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
        }),
      };
    }
    
    const adminCheck = await isAdmin(supabase, userId);
    
    if (!adminCheck) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Forbidden',
          message: 'Admin access required',
        }),
      };
    }
    
    console.debug('[imports-reclassify] Admin authorization confirmed');
    
    // Fetch all imports with meta.importType='service' and parsed data
    const { data: imports, error: fetchError } = await supabase
      .from('ticket_imports')
      .select('*')
      .not('parsed', 'is', null);
    
    if (fetchError) {
      console.error('[imports-reclassify] Error fetching imports:', fetchError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database query failed',
          message: 'Failed to fetch imports',
        }),
      };
    }
    
    console.debug('[imports-reclassify] Found imports:', imports?.length || 0);
    
    // Filter to service-type imports
    const serviceImports = (imports || []).filter(imp => {
      const importType = imp.meta?.importType;
      return !importType || importType === 'service';
    });
    
    console.debug('[imports-reclassify] Service imports to check:', serviceImports.length);
    
    const summary = {
      total: serviceImports.length,
      reclassified: 0,
      skipped: 0,
      details: [],
    };
    
    // Process each service import
    for (const imp of serviceImports) {
      try {
        // Run inference
        const detection = ocrParser.inferImportType(
          imp.parsed?.columnMap || {},
          imp.parsed?.rows || []
        );
        
        console.debug(`[imports-reclassify] Import ${imp.id}: type=${detection.type}, confidence=${detection.confidence}`);
        
        // Reclassify if delivery with confidence >= 0.7
        if (detection.type === 'delivery' && detection.confidence >= 0.7) {
          const updatedMeta = imp.meta || {};
          updatedMeta.importType = 'delivery';
          updatedMeta.reclassified_at = new Date().toISOString();
          updatedMeta.reclassified_by = 'system';
          updatedMeta.detection = {
            type: detection.type,
            confidence: detection.confidence,
            hits: detection.hits,
            tokenCount: detection.tokenCount,
          };
          
          const { error: updateError } = await supabase
            .from('ticket_imports')
            .update({ meta: updatedMeta })
            .eq('id', imp.id);
          
          if (updateError) {
            console.error(`[imports-reclassify] Error updating import ${imp.id}:`, updateError);
            summary.skipped++;
            summary.details.push({
              id: imp.id,
              status: 'error',
              message: updateError.message,
            });
          } else {
            summary.reclassified++;
            summary.details.push({
              id: imp.id,
              status: 'reclassified',
              confidence: detection.confidence,
              hits: detection.hits,
            });
            console.debug(`[imports-reclassify] Reclassified import ${imp.id} to delivery`);
          }
        } else {
          summary.skipped++;
          summary.details.push({
            id: imp.id,
            status: 'skipped',
            reason: detection.type !== 'delivery' 
              ? 'not_delivery' 
              : 'confidence_too_low',
            confidence: detection.confidence,
          });
        }
      } catch (err) {
        console.error(`[imports-reclassify] Error processing import ${imp.id}:`, err);
        summary.skipped++;
        summary.details.push({
          id: imp.id,
          status: 'error',
          message: err.message,
        });
      }
    }
    
    console.debug('[imports-reclassify] Reclassification complete:', summary);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        reclassified: summary.reclassified,
        summary: summary,
        message: `Reclassified ${summary.reclassified} of ${summary.total} service imports to delivery`,
      }),
    };
  } catch (error) {
    console.error('[imports-reclassify] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};
