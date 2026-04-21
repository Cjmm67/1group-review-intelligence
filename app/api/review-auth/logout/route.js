// app/api/review-auth/logout/route.js

import { buildClearCookie } from '@/lib/reviewAuth';

export async function POST() {
  return Response.json(
    { ok: true },
    { status: 200, headers: { 'Set-Cookie': buildClearCookie() } }
  );
}
