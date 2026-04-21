// app/api/review-auth/me/route.js
//
// GET → returns the current session info for the UI.
// Response: { ok: true, email, role: 'admin' | 'user' } | { ok: false }

import { cookies } from 'next/headers';
import { COOKIE_NAME, verifySession } from '@/lib/reviewAuth';

export async function GET() {
  const cookieStore = cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  const secret = process.env.REVIEW_AUTH_SECRET;

  if (!cookie?.value || !secret) {
    return Response.json({ ok: false }, { status: 200 });
  }

  const payload = await verifySession(cookie.value, secret.trim());
  if (!payload) {
    return Response.json({ ok: false }, { status: 200 });
  }

  return Response.json(
    { ok: true, email: payload.email, role: payload.role || 'user' },
    { status: 200 }
  );
}
