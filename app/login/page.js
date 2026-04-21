'use client';

// app/login/page.js
// Review Intelligence tool login gate. Accepts:
//   - Any @1-group.sg staff email + REVIEW_TOOL_PASSWORD
//   - chris.millar@1-group.sg + REVIEW_ADMIN_PASSCODE (admin role, sees Home button)

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const C = {
  navy: '#1a1a2e',
  navyDark: '#16213e',
  gold: '#c9a84c',
  goldL: '#d4b86a',
  goldD: '#a88b3d',
  white: '#fff',
  bg: '#f8f9fa',
  bdr: '#e9ecef',
  mut: '#6c757d',
  text: '#212529',
  error: '#991b1b',
};

// Page-level export wraps the form in Suspense so Next.js can prerender
// the static shell without bailing on useSearchParams().
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <div style={{ fontFamily: 'Georgia, serif', background: C.bg, minHeight: '100vh' }} />
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const nextParam = searchParams?.get('next') || '/';
  const safeNext = nextParam.startsWith('/') && nextParam !== '/login' ? nextParam : '/';

  useEffect(() => {
    if (searchParams?.get('reason') === 'expired') {
      setError('Your session has expired. Please sign in again.');
    }
  }, [searchParams]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const normalised = email.trim().toLowerCase();
    if (!normalised.endsWith('@1-group.sg')) {
      setError('Access is limited to @1-group.sg email addresses.');
      return;
    }
    if (!password) {
      setError('Please enter the password shared by your admin.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/review-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalised, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || 'Sign-in failed. Please try again.');
        setLoading(false);
        return;
      }
      router.replace(safeNext);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: 'Georgia, serif',
      background: C.bg,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle navy-gold ornament behind the card */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        inset: 0,
        background:
          `radial-gradient(ellipse 600px 400px at 20% 20%, ${C.gold}1a, transparent 60%),
           radial-gradient(ellipse 500px 350px at 80% 80%, ${C.navy}14, transparent 60%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        {/* Brand mark */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 6,
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`,
            color: C.navy, fontWeight: 700, fontSize: 18,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif',
          }}>1</div>
          <div style={{ fontSize: 18, color: C.navy, letterSpacing: '0.02em' }}>1-Group</div>
        </div>

        {/* Card */}
        <section style={{
          width: '100%',
          background: C.white,
          border: `1px solid ${C.bdr}`,
          borderRadius: 16,
          padding: '40px 32px 32px',
          boxShadow: '0 1px 2px rgba(26,26,46,0.04), 0 12px 32px rgba(26,26,46,0.08)',
        }}>
          <p style={{
            margin: '0 0 10px',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: C.goldD,
            fontWeight: 700,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>Review Intelligence</p>
          <h1 style={{ margin: '0 0 8px', fontSize: 30, lineHeight: 1.15, color: C.navy, fontWeight: 700 }}>
            Restricted Access
          </h1>
          <p style={{ margin: '0 0 28px', color: C.mut, fontSize: 14, lineHeight: 1.6, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Sign in with your 1-Group email and the password shared by your admin.
          </p>

          <form onSubmit={submit} noValidate>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@1-group.sg"
                autoComplete="email"
                inputMode="email"
                required
                disabled={loading}
                style={inputStyle(loading)}
              />
              <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: C.mut, fontFamily: 'Inter, system-ui, sans-serif' }}>
                Must end in @1-group.sg
              </span>
            </div>

            {/* Password with eye toggle */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Shared by your admin"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  style={{ ...inputStyle(loading), paddingRight: 46 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    right: 8, top: '50%', transform: 'translateY(-50%)',
                    width: 34, height: 34,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', borderRadius: 6,
                    color: C.mut, cursor: 'pointer', padding: 0,
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" style={{
                margin: '4px 0 16px',
                padding: '10px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderLeft: `3px solid ${C.error}`,
                borderRadius: 6,
                color: C.error,
                fontSize: 13,
                lineHeight: 1.5,
                wordBreak: 'break-word',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%',
              marginTop: 8,
              padding: '14px 20px',
              background: C.navy,
              color: C.white,
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '0.02em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              minHeight: 48,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{
            marginTop: 20, paddingTop: 20,
            borderTop: `1px solid ${C.bdr}`,
            fontSize: 12, color: C.mut,
            textAlign: 'center', lineHeight: 1.5,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            This session unlocks only the Review Intelligence tool. Expires after 24 hours.
          </div>
        </section>

        <p style={{ margin: 0, fontSize: 12, color: C.mut, textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
          Need access? Speak to your 1-Group admin.
        </p>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: C.navy,
  marginBottom: 6,
  fontFamily: 'Inter, system-ui, sans-serif',
};

function inputStyle(disabled) {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    border: `1px solid ${C.bdr}`,
    borderRadius: 8,
    background: C.bg,
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter, system-ui, sans-serif',
    outline: 'none',
    minHeight: 44,
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
  };
}
