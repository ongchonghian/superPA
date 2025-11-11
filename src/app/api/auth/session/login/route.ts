import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp, jsonAuthError } from '@/lib/auth-server';
import { getAuth } from 'firebase-admin/auth';

type LoginRequestBody = {
  idToken?: string;
};

const SESSION_COOKIE_NAME = 'spa_session';
const SESSION_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: NextRequest): Promise<NextResponse> {
  let idToken: string | undefined;

  try {
    const body = (await req.json().catch(() => null)) as LoginRequestBody | null;

    if (!body || typeof body !== 'object' || typeof body.idToken !== 'string') {
      return jsonAuthError(
        400,
        'UNAUTHENTICATED',
        'Missing or invalid idToken in request body.',
        false,
      );
    }

    idToken = body.idToken;
  } catch {
    return jsonAuthError(
      400,
      'UNAUTHENTICATED',
      'Request body must be valid JSON.',
      false,
    );
  }

  try {
    const app = getFirebaseAdminApp();
    const auth = getAuth(app);

    // Verify ID token first to ensure it is valid and get user info.
    const decoded = await auth.verifyIdToken(idToken, true).catch(() => null);
    if (!decoded) {
      return jsonAuthError(
        401,
        'UNAUTHENTICATED',
        'Invalid or expired ID token.',
        false,
      );
    }

    const expiresIn = SESSION_EXPIRES_IN_MS;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    const isProd = process.env.NODE_ENV === 'production';

    const res = NextResponse.json(
      { success: true },
      { status: 200 },
    );

    // IMPORTANT: Session cookie is scoped for same-origin APIs only.
    // - httpOnly: true so JS cannot exfiltrate it.
    // - secure: true in production so it is only sent over HTTPS.
    // - sameSite: 'lax' so it is included on top-level navigations and same-site XHR/fetch,
    //   but NOT in third-party contexts. This matches our single-origin deployment assumption.
    // - path: '/' so it is sent to /api/ai-summary and related routes.
    // - We intentionally do NOT set 'domain' so it defaults to the current host; this avoids
    //   mis-scoped cookies in multi-domain setups.
    res.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(expiresIn / 1000),
    });

    return res;
  } catch (err: any) {
    const message =
      process.env.NODE_ENV === 'development'
        ? 'Authentication is not configured correctly. Check Firebase Admin credentials.'
        : 'Authentication is not configured correctly.';

    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHENTICATED',
          message,
          retryable: false,
        },
      },
      { status: 500 },
    );
  }
}