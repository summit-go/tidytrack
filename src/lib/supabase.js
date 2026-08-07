import { createClient } from '@supabase/supabase-js';
import { ASSIGNMENT_MAX_SIZE_MB, STALE_FORCE_MIN } from './constants.js';
import { compressImage } from './photos.js';

// =================================================================
// 🔧 PASTE YOUR SUPABASE KEYS HERE
// =================================================================
export const SUPABASE_URL = "https://bbaynvqnbkjyqhzhhypr.supabase.co/";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiYXludnFuYmtqeXFoemhoeXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzQ2MTMsImV4cCI6MjA5MzA1MDYxM30.ZXUoHFj_IwMe6rX8RxK8Dj4kAB9AS7X9xZAhQ84wDEk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// SECURE SIGN-IN — calls the server-side `secure-signin` Edge
// Function, which verifies the PIN/code against its bcrypt hash
// without ever exposing the table to the browser.
//
// SAFETY: if the function is unreachable or errors, we fall back
// to the old direct query so nobody is ever locked out during
// the migration. Once the function is proven and the table
// policies are locked down, the fallback simply stops working
// for attackers (the table won't be readable) but keeps this
// code path harmless.
// ============================================================
export async function secureEmployeeSignIn(pin) {
  try {
    const { data, error } = await supabase.functions.invoke('secure-signin', {
      body: { mode: 'employee', pin },
    });
    if (!error && data && data.employee) return data.employee;
    if (!error && data && data.error) return null; // valid response, wrong PIN
  } catch (e) {
    console.warn('[secureEmployeeSignIn] function unavailable, falling back', e);
  }
  // Fallback (pre-lockdown only): direct query.
  const { data } = await supabase.from('employees').select('*').eq('pin', pin).eq('active', true).maybeSingle();
  return data || null;
}

export async function securePortalSignIn(code) {
  const clean = (code || '').trim().toLowerCase();
  try {
    const { data, error } = await supabase.functions.invoke('secure-signin', {
      body: { mode: 'portal', code: clean },
    });
    if (!error && data && data.portalUser) return data.portalUser;
    if (!error && data && data.error) return null;
  } catch (e) {
    console.warn('[securePortalSignIn] function unavailable, falling back', e);
  }
  const { data } = await supabase.from('portal_users').select('*').eq('code', clean).eq('active', true).maybeSingle();
  return data || null;
}

// After a PIN/code is written (insert/update), call this so the
// server hashes it into pin_hash / code_hash. Without it, a newly
// set credential wouldn't verify once the tables are locked down.
// target: 'employee' | 'portal'. Returns { ok } or { error }.
export async function secureSetCredential(target, id, value) {
  try {
    const { data, error } = await supabase.functions.invoke('secure-signin', {
      body: { mode: 'set', target, id, value },
    });
    if (error) return { error: error.message || 'set failed' };
    return data || { error: 'no response' };
  } catch (e) {
    return { error: String(e) };
  }
}

export const PHOTO_BUCKET = 'task-photos';
export const ASSIGNMENT_BUCKET = 'assignments';
export const PM_UPLOAD_BUCKET = 'pm-uploads';
export const MESSAGE_BUCKET = 'messages';

// Commits an AssignPicker selection. Only writes the difference, so a
// cleaner who ASKED for a job (status 'requested') and is left selected
// keeps that status instead of being silently promoted to 'assigned'.
// Returns an error object, or null on success.
export async function saveAssignees(assignmentId, currentIds, nextIds, actorId) {
  const cur = new Set(currentIds || []);
  const next = new Set(nextIds || []);
  const toAdd = Array.from(next).filter(id => !cur.has(id));
  const toRemove = Array.from(cur).filter(id => !next.has(id));
  if (toRemove.length) {
    const { error } = await supabase.from('assignment_assignees')
      .delete().eq('assignment_id', assignmentId).in('employee_id', toRemove);
    if (error) return error;
  }
  if (toAdd.length) {
    const { error } = await supabase.from('assignment_assignees')
      .upsert(toAdd.map(id => ({ assignment_id: assignmentId, employee_id: id, status: 'assigned', created_by: actorId })),
        { onConflict: 'assignment_id,employee_id' });
    if (error) return error;
  }
  return null;
}

// =================================================================
// LIVE PRESENCE — who is physically in a bedroom RIGHT NOW, keyed
// "unitId:partyId". Work blocks carry unit_id/party_id, not
// assignment_id, so that pair is the only thing that lines a live
// block up with a job card.
//
// Shared on purpose: the "X is here" chip was previously reinvented at
// each call site, which is why it showed on some cards and not others.
// Stale blocks are dropped using the same 2h rule the rest of the app
// uses — someone who forgot to clock out three days ago is not "here".
// =================================================================
export async function fetchLivePresence() {
  let rows = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('work_blocks')
      .select('id, unit_id, party_id, start_time, shift:shifts!inner(is_preview, employee:employees(id, name))')
      .is('end_time', null)
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    if (from > 100000) break;
  }
  const cutoff = Date.now() - STALE_FORCE_MIN * 60 * 1000;
  const m = {};
  rows.forEach(b => {
    if (b.shift?.is_preview) return;
    if (!b.unit_id) return;
    if (new Date(b.start_time).getTime() <= cutoff) return;
    const k = `${b.unit_id}:${b.party_id || ''}`;
    (m[k] = m[k] || []).push({
      id: b.shift?.employee?.id,
      name: b.shift?.employee?.name || '?',
      since: b.start_time,
    });
  });
  return m;
}

// Upload an assignment file. Compresses images, leaves PDFs as-is.
export async function uploadAssignmentFile(file, customerId) {
  if (file.size > ASSIGNMENT_MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File too large. Max ${ASSIGNMENT_MAX_SIZE_MB}MB.`);
  }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error('Only PDFs and images are supported.');
  }
  let uploadBody = file;
  let contentType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');
  let ext = isPdf ? 'pdf' : 'jpg';
  if (isImage) {
    uploadBody = await compressImage(file);
    contentType = 'image/jpeg';
    ext = 'jpg';
  }
  const path = `${customerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(ASSIGNMENT_BUCKET)
    .upload(path, uploadBody, { contentType });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from(ASSIGNMENT_BUCKET).getPublicUrl(path);
  return { path, publicUrl, kind: isPdf ? 'pdf' : 'image' };
}

// Upload to the PM bucket — used for both PM photo uploads and PM assignment uploads
export async function uploadPmFile(file, customerId) {
  if (file.size > ASSIGNMENT_MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File too large. Max ${ASSIGNMENT_MAX_SIZE_MB}MB.`);
  }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error('Only PDFs and images are supported.');
  }
  let uploadBody = file;
  let contentType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');
  let ext = isPdf ? 'pdf' : 'jpg';
  if (isImage) {
    uploadBody = await compressImage(file);
    contentType = 'image/jpeg';
    ext = 'jpg';
  }
  const path = `${customerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(PM_UPLOAD_BUCKET)
    .upload(path, uploadBody, { contentType });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from(PM_UPLOAD_BUCKET).getPublicUrl(path);
  return { path, publicUrl, kind: isPdf ? 'pdf' : 'image' };
}

// Delete a file from PM uploads bucket (used when PM edits to swap the file, or rejects)
export async function deletePmFile(path) {
  if (!path) return;
  await supabase.storage.from(PM_UPLOAD_BUCKET).remove([path]);
}

// Upload a photo attachment for a message. Returns { path, publicUrl }.
export async function uploadMessagePhoto(file, conversationId) {
  if (file.size > ASSIGNMENT_MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Photo too large. Max ${ASSIGNMENT_MAX_SIZE_MB}MB.`);
  }
  if (!file.type.startsWith('image/')) throw new Error('Only images can be attached.');
  const compressed = await compressImage(file);
  const path = `${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: upErr } = await supabase.storage.from(MESSAGE_BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg' });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from(MESSAGE_BUCKET).getPublicUrl(path);
  return { path, publicUrl };
}

export async function deleteMessagePhoto(path) {
  if (!path) return;
  try { await supabase.storage.from(MESSAGE_BUCKET).remove([path]); } catch {}
}

// Write a notification row. Fire-and-forget — never blocks the action that
// triggered it. `to` is either { employeeId } for a specific person or
// { scope: 'owner' } to broadcast to the owner/manager team.
export async function createNotification({ to, kind, title, body = null, linkKind = null, linkId = null, createdBy = null }) {
  try {
    await supabase.from('notifications').insert({
      recipient_employee_id: to?.employeeId || null,
      recipient_scope: to?.scope || null,
      kind: kind || 'other',
      title, body,
      link_kind: linkKind, link_id: linkId,
      created_by: createdBy,
    });
  } catch (e) { console.warn('[notify] insert failed', e); }
}

// Remove any "priority job available" broadcast for an assignment — called
// when someone claims it (requests/gets assigned/starts) or it's no longer
// priority, so the notification stops showing for every cleaner at once.
export async function clearAssignmentBroadcast(assignmentId) {
  if (!assignmentId) return;
  try {
    await supabase.from('notifications').delete()
      .eq('recipient_scope', 'all_cleaners')
      .eq('link_kind', 'assignment')
      .eq('link_id', assignmentId);
  } catch (e) { console.warn('[notify] clear broadcast failed', e); }
}

// Remove the owner "new assignment to approve" bell notification(s) for an
// assignment once it's been approved or rejected — so a resolved item doesn't
// keep sitting in the bell (and the backfill won't recreate it because the
// assignment is no longer pm_status='pending').
export async function clearPmAssignmentNotification(assignmentId) {
  if (!assignmentId) return;
  try {
    await supabase.from('notifications').delete()
      .eq('kind', 'pm_assignment')
      .eq('link_id', assignmentId);
  } catch (e) { console.warn('[notify] clear pm notification failed', e); }
}

export function updateAssignmentScheduledDate(id, date) {
  if (!id) return Promise.resolve({ data: null, error: null });
  return supabase
    .from('assignments')
    .update({ scheduled_date: date || null })
    .eq('id', id);
}

/** Paginate a Supabase query builder until all rows are fetched. */
export async function fetchAllPages(buildQuery, pageSize = 1000) {
  let data = [];
  let error = null;
  for (let from = 0; ; from += pageSize) {
    const { data: page, error: pageError } = await buildQuery(from, from + pageSize - 1);
    if (pageError) {
      error = pageError;
      break;
    }
    data = data.concat(page || []);
    if (!page || page.length < pageSize) break;
    if (from > 200000) break;
  }
  return { data, error };
}
