// lib/reviewAuth.js
//
// Tool-scoped auth for the Review Intelligence tool.
// Isolated from the Competitor Tool: different cookie, different secret,
// different scope claim. A session cookie for one is useless for the other.
//
// Uses Web Crypto API (crypto.subtle) so the same helpers work in both
// App Router route handlers (Node) and Edge middleware.

export const COOKIE_NAME = 'review_session';
export const SCOPE = 'review-intelligence';
export const EMAIL_DOMAIN = '@1-group.sg';
export const MASTER_ADMIN = 'cjmm67@gmail.com';
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

// ─── Base64URL helpers ────────────────────────────────────────────────────────

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeBytes(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── HMAC key import ──────────────────────────────────────────────────────────

async function getKey(secret) {
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('REVIEW_AUTH_SECRET must be a string of at least 16 chars');
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// ─── Session sign / verify ────────────────────────────────────────────────────

export async function signSession({ email, role }, secret) {
  const now = Date.now();
  const payload = {
    email: String(email).toLowerCase(),
    role: role || 'user', // 'admin' | 'user'
    scope: SCOPE,
    iat: now,
    exp: now + SESSION_DURATION_MS,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const key = await getKey(secret);
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
  );
  const sigB64 = base64UrlEncode(sigBytes);
  return `${payloadB64}.${sigB64}`;
}

export async function verifySession(token, secret) {
  if (!token || typeof token !== 'string' || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await getKey(secret);
    const sigBytes = base64UrlDecodeBytes(sigB64);
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecodeBytes(payloadB64)));
    if (payload.scope !== SCOPE) return null;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (typeof payload.email !== 'string') return null;
    // Accept either the master admin OR a valid @1-group.sg staff email
    const lower = payload.email.toLowerCase();
    const isMaster = lower === MASTER_ADMIN;
    const isStaff = lower.endsWith(EMAIL_DOMAIN);
    if (!isMaster && !isStaff) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Cookie string builders ───────────────────────────────────────────────────

export function buildSessionCookie(token) {
  const maxAgeSeconds = Math.floor(SESSION_DURATION_MS / 1000);
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie() {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export function isValidCompanyEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const shape = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed);
  return shape && trimmed.endsWith(EMAIL_DOMAIN);
}

export function isMasterAdminEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase() === MASTER_ADMIN;
}

// Constant-time string comparison (avoids leaking password length/contents
// through response timing). Works in both Node and Edge.
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) {
    let diff = 1;
    for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ (bBytes[i % Math.max(bBytes.length, 1)] || 0);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}
