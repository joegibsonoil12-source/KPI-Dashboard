// Lightweight Supabase helpers that build on the existing src/lib/supabaseClient.js
// - keeps your current client untouched
// - implements private storage uploads (signed URLs) and ticket CRUD + attachment metadata
import supabase from "./supabaseClient";

/**
 * Configuration
 */
const BUCKET = "private-attachments"; // create this bucket in Supabase storage

/**
 * Tickets CRUD
 */
export async function fetchTickets() {
  const { data, error } = await supabase
    .from("delivery_tickets")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function insertTicket(ticket) {
  const { data, error } = await supabase
    .from("delivery_tickets")
    .insert(ticket)
    .select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function updateTicket(id, changes) {
  const { data, error } = await supabase
    .from("delivery_tickets")
    .update(changes)
    .eq("id", id)
    .select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function deleteTicket(id) {
  const { error } = await supabase
    .from("delivery_tickets")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

/**
 * Storage helpers for private bucket
 * - uploadAttachmentFile: uploads a File/Blob to BUCKET at a path and returns upload data
 * - createSignedUrl: returns a signed URL for temporary download
 * - listFiles: list files under a prefix
 */
export async function uploadAttachmentFile(file, path) {
  // path example: `tickets/<ticketId>/<timestamp>-filename.ext`
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return data;
}

export async function createSignedUrl(path, expiresInSeconds = 60 * 10) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return { signedUrl: data?.signedUrl, expiresAt: data?.expires_at };
}

export async function listFiles(prefix = "") {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100, offset: 0 });
  if (error) throw error;
  return data || [];
}

/**
 * Attachment metadata (ticket_attachments table)
 */
export async function insertAttachmentMetadata({ ticket_id, storage_key, filename, content_type, size, uploaded_by }) {
  const { data, error } = await supabase
    .from("ticket_attachments")
    .insert([{ ticket_id, storage_key, filename, content_type, size, uploaded_by }])
    .select();
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function listAttachmentsForTicket(ticketId) {
  const { data, error } = await supabase
    .from("ticket_attachments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export default {
  fetchTickets,
  insertTicket,
  updateTicket,
  deleteTicket,
  uploadAttachmentFile,
  createSignedUrl,
  listFiles,
  insertAttachmentMetadata,
  listAttachmentsForTicket,
};
