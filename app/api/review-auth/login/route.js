// app/api/review-auth/login/route.js
//
// POST { email, password }
// → 200 { ok: true, email, role }  + Set-Cookie: review_session=...
// → 400/401/429/500 { ok: false, error }
//
// Two login paths:
//   1. @1-group.sg staff        + REVIEW_TOOL_PASSWORD     -> role: 'user'
//   2. chris.millar@1-group.sg  + REVIEW_ADMIN_PASSCODE    -> role: 'admin'
//      (master admin can also use REVIEW_TOOL_PASSWORD to get role 'user')

import {
  signSession,
  buildSessionCookie,
  isValidCompanyEmail,
  isMasterAdminEmail,
  constantTimeEqual,
  EMAIL_DOMAIN,
  MASTER_ADMIN,
} from '@/lib/reviewAuth';

// ─── In-memory rate limiter (per warm lambda) ─────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const RATE_LIMIT_MAX = 5;
const attempts = new Map();

function getIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart) };
  }
  return { allowed: true };
}

function clearRateLimit(ip) {
  attempts.delete(ip);
}

export async function POST(request) {
  const ip = getIp(request);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    const secs = Math.ceil(limit.retryAfterMs / 1000);
    return Response.json(
      { ok: false, error: `Too many attempts. Try again in ${Math.ceil(secs / 60)} minute(s).` },
      { status: 429, headers: { 'Retry-After': String(secs) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const { email, password } = body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return Response.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
  }

  const normalisedEmail = email.trim().toLowerCase();
  const looksAdmin = isMasterAdminEmail(normalisedEmail);
  const looksStaff = isValidCompanyEmail(normalisedEmail);

  if (!looksAdmin && !looksStaff) {
    return Response.json(
      { ok: false, error: `Access is limited to ${EMAIL_DOMAIN} email addresses.` },
      { status: 400 }
    );
  }

  // Load env vars with whitespace trim (common paste issue)
  const staffPwRaw = process.env.REVIEW_TOOL_PASSWORD;
  const adminPcRaw = process.env.REVIEW_ADMIN_PASSCODE;
  const secretRaw = process.env.REVIEW_AUTH_SECRET;

  if (!secretRaw) {
    console.error('[review-auth] Missing REVIEW_AUTH_SECRET');
    return Response.json({ ok: false, error: 'Server is not configured. Contact the admin.' }, { status: 500 });
  }

  const secret = secretRaw.trim();
  if (secret.length < 16) {
    console.error('[review-auth] REVIEW_AUTH_SECRET is too short (< 16 chars after trim)');
    return Response.json({ ok: false, error: 'Server misconfigured. Contact the admin.' }, { status: 500 });
  }

  let role = null;
  if (looksAdmin) {
    // Master admin can authenticate with EITHER the admin passcode (→ admin role)
    // OR the regular staff password (→ user role). This way you don't get locked
    // out if you forget which password to use.
    if (adminPcRaw && constantTimeEqual(password, adminPcRaw.trim())) {
      role = 'admin';
    } else if (staffPwRaw && constantTimeEqual(password, staffPwRaw.trim())) {
      role = 'user';
    }
    // If neither env var is present, that's a config problem:
    if (!role && !adminPcRaw && !staffPwRaw) {
      console.error('[review-auth] Missing BOTH REVIEW_ADMIN_PASSCODE and REVIEW_TOOL_PASSWORD');
      return Response.json({ ok: false, error: 'Server is not configured. Contact the admin.' }, { status: 500 });
    }
  } else if (looksStaff) {
    if (!staffPwRaw) {
      console.error('[review-auth] Missing REVIEW_TOOL_PASSWORD');
      return Response.json({ ok: false, error: 'Server is not configured. Contact the admin.' }, { status: 500 });
    }
    if (constantTimeEqual(password, staffPwRaw.trim())) {
      role = 'user';
    }
  }

  if (!role) {
    return Response.json({ ok: false, error: 'Incorrect email or password.' }, { status: 401 });
  }

  clearRateLimit(ip);

  try {
    const token = await signSession({ email: normalisedEmail, role }, secret);
    console.log(`[review-auth] Login: ${normalisedEmail} (${role}) @ ${new Date().toISOString()}`);
    return Response.json(
      { ok: true, email: normalisedEmail, role },
      { status: 200, headers: { 'Set-Cookie': buildSessionCookie(token) } }
    );
  } catch (err) {
    const errMsg = err && (err.message || String(err));
    console.error('[review-auth] Sign error:', errMsg, err);
    return Response.json({ ok: false, error: 'Could not create session. Try again.' }, { status: 500 });
  }
}
