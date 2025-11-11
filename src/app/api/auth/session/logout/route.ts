import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp, jsonAuthError } from '@/lib/auth-server';
import { getAuth } from 'firebase-admin/auth';

const SESSION_COOKIE_NAME = 'spa_session';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  try {
    if (sessionCookie) {
      // Best-effort: revoke refresh tokens for this user to invalidate existing sessions.
      try {
        const app = getFirebaseAdminApp();
        const auth = getAuth(app);
        const decoded = await auth.verifySessionCookie(sessionCookie, true).catch(() => null);

        if (decoded?.sub) {
          await auth.revokeRefreshTokens(decoded.sub);
        }
      } catch {
        // Swallow revocation errors; logout should still clear cookie.
      }
    }

    const isProd = process.env.NODE_ENV === 'production';

    const res = NextResponse.json(
      { success: true },
      { status: 200 },
    );

    // Clear the session cookie by setting maxAge 0.
    res.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return res;
  } catch {
    // For unexpected failures, expose a generic, non-sensitive error.
    return jsonAuthError(
      500,
      'UNAUTHENTICATED',
      'Failed to clear authentication session.',
      false,
    );
  }
}