// src/pages/api/uploads/signed.js
// Server-side endpoint for signed uploads to Supabase storage
// Accepts multipart/form-data or JSON with base64 encoded file
// Uses service role credentials to bypass RLS and upload to ticket-scans bucket

import { createClient } from "@supabase/supabase-js";
import busboy from "busboy";

/**
 * Create server-side Supabase admin client with service role key
 */
function createAdminClient() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Helper function to generate timestamp for file paths
 */
function generateTimestamp() {
  return new Date().toISOString().replace(/[:T.]/g, "-").slice(0, 19);
}

/**
 * Helper function to sanitize file names
 */
function sanitizeFileName(fileName) {
  return fileName
    .replace(/\.\./g, "")
    .replace(/[\/\\]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Parse multipart/form-data using busboy
 */
function parseMultipartFormData(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    const files = [];
    
    bb.on("file", (fieldname, file, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];
      
      file.on("data", (data) => {
        chunks.push(data);
      });
      
      file.on("end", () => {
        files.push({
          filename,
          mimeType,
          buffer: Buffer.concat(chunks),
        });
      });
    });
    
    bb.on("finish", () => {
      resolve(files);
    });
    
    bb.on("error", (err) => {
      reject(err);
    });
    
    req.pipe(bb);
  });
}

/**
 * POST /api/uploads/signed
 * 
 * Uploads files to Supabase storage using service role credentials
 * Supports both multipart/form-data and JSON with base64 encoded files
 * 
 * Request body (JSON):
 *  - filename: string (required)
 *  - contentType: string (required)
 *  - base64: string (required) - base64 encoded file content
 * 
 * Request body (multipart/form-data):
 *  - file: File (one or more files)
 * 
 * Response: { storagePath: string, signedViewUrl: string }
 * or array of responses for multiple files
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const timestamp = generateTimestamp();
    const contentType = req.headers["content-type"] || "";

    let uploads = [];

    // Handle multipart/form-data
    if (contentType.includes("multipart/form-data")) {
      console.log("[signed-upload] Processing multipart/form-data");
      
      try {
        const files = await parseMultipartFormData(req);
        
        if (!files || files.length === 0) {
          return res.status(400).json({ 
            error: "No files provided in multipart request" 
          });
        }

        for (const file of files) {
          const sanitizedName = sanitizeFileName(file.filename);
          const dest = `upload_${timestamp}/${sanitizedName}`;
          
          console.log(`[signed-upload] Uploading: ${file.filename} -> ${dest}`);
          
          // Upload to ticket-scans bucket
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from("ticket-scans")
            .upload(dest, file.buffer, {
              contentType: file.mimeType,
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.error("[signed-upload] Upload error:", uploadError);
            return res.status(500).json({
              error: `Failed to upload ${file.filename}`,
              details: uploadError.message,
            });
          }

          // Create signed URL for viewing
          const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
            .from("ticket-scans")
            .createSignedUrl(dest, 3600);

          if (signedUrlError) {
            console.error("[signed-upload] Signed URL error:", signedUrlError);
            return res.status(500).json({
              error: "Failed to create signed URL",
              details: signedUrlError.message,
            });
          }

          uploads.push({
            storagePath: dest,
            signedViewUrl: signedUrlData.signedUrl,
            filename: file.filename,
            contentType: file.mimeType,
          });
        }
      } catch (parseError) {
        console.error("[signed-upload] Multipart parse error:", parseError);
        return res.status(400).json({
          error: "Failed to parse multipart data",
          details: parseError.message,
        });
      }
    }
    // Handle JSON with base64
    else if (contentType.includes("application/json")) {
      console.log("[signed-upload] Processing JSON with base64");
      
      const { filename, contentType: fileContentType, base64 } = req.body;

      if (!filename || !fileContentType || !base64) {
        return res.status(400).json({
          error: "Missing required fields: filename, contentType, base64",
        });
      }

      const sanitizedName = sanitizeFileName(filename);
      const dest = `upload_${timestamp}/${sanitizedName}`;
      
      console.log(`[signed-upload] Uploading: ${filename} -> ${dest}`);

      // Convert base64 to buffer
      const buffer = Buffer.from(base64, "base64");

      // Upload to ticket-scans bucket
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("ticket-scans")
        .upload(dest, buffer, {
          contentType: fileContentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("[signed-upload] Upload error:", uploadError);
        return res.status(500).json({
          error: `Failed to upload ${filename}`,
          details: uploadError.message,
        });
      }

      // Create signed URL for viewing
      const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
        .from("ticket-scans")
        .createSignedUrl(dest, 3600);

      if (signedUrlError) {
        console.error("[signed-upload] Signed URL error:", signedUrlError);
        return res.status(500).json({
          error: "Failed to create signed URL",
          details: signedUrlError.message,
        });
      }

      uploads.push({
        storagePath: dest,
        signedViewUrl: signedUrlData.signedUrl,
        filename: filename,
        contentType: fileContentType,
      });
    }
    else {
      return res.status(400).json({
        error: "Unsupported content type. Use multipart/form-data or application/json",
      });
    }

    console.log(`[signed-upload] Successfully uploaded ${uploads.length} file(s)`);

    // Return single object if only one file, otherwise array
    return res.status(200).json(uploads.length === 1 ? uploads[0] : uploads);
  } catch (error) {
    console.error("[signed-upload] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
