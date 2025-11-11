import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';

export type AuthenticatedUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
};

export type AuthErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN';

export type AuthErrorResponse = {
  error: {
    code: AuthErrorCode;
    message: string;
    retryable: boolean;
  };
};

/**
 * Reads a required environment variable.
 *
 * All Firebase Admin credentials are sourced exclusively from process.env.
 * In production, these values MUST be injected by the hosting platform (e.g.
 * Firebase App Hosting / Cloud Run) from Google Cloud Secret Manager or an
 * equivalent secure secret store. Do NOT commit secrets or .env files containing
 * these values to source control.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[auth-server] Missing required environment variable ${name}. Authentication is not configured correctly.`
    );
  }
  return value;
}

/**
 * Firebase Admin credential mapping (authoritative):
 * - FIREBASE_PROJECT_ID   -> Firebase / GCP project ID
 * - FIREBASE_CLIENT_EMAIL -> Service account client email
 * - FIREBASE_PRIVATE_KEY  -> Service account private key (may be provided with '\n'
 *                            literals and will be normalized here).
 *
 * These env vars must be populated by the deployment environment (e.g. via
 * apphosting.yaml -> Secret Manager) and never hardcoded in source.
 */
function getFirebaseCredentials() {
  const projectId = getRequiredEnv('FIREBASE_PROJECT_ID');
  const clientEmail = getRequiredEnv('FIREBASE_CLIENT_EMAIL');
  const rawPrivateKey = getRequiredEnv('FIREBASE_PRIVATE_KEY');
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const { projectId, clientEmail, privateKey } = getFirebaseCredentials();

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  } catch {
    throw new Error(
      '[auth-server] Failed to initialize Firebase Admin SDK. Verify FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set correctly.'
    );
  }
}

function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export async function verifySessionCookie(cookieValue: string | undefined | null): Promise<DecodedIdToken | null> {
  if (!cookieValue) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookieValue, true);
    return decoded;
  } catch (err) {
    // Root-cause note:
    // In production, silent failures here (e.g. due to mismatched FIREBASE_PROJECT_ID,
    // incorrect service account, wrong issuer/audience, or expired/revoked cookies)
    // manifested as generic UNAUTHENTICATED from /api/ai-summary even when the UI
    // believed the user was logged in. We keep the external behavior the same
    // (do not leak details), but emit a structured log to aid diagnosis.
    try {
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          event: 'auth_session_cookie_verification_failed',
          message: 'Session cookie verification failed; treating request as unauthenticated.',
        }),
      );
    } catch {
      // Never throw from logging.
    }
    return null;
  }
}

export async function verifyIdTokenHeader(authHeader?: string | null): Promise<DecodedIdToken | null> {
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    return decoded;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  // Prefer `spa_session`, but allow `__session` for flexibility/compat.
  const sessionCookie =
    req.cookies.get('spa_session')?.value ?? req.cookies.get('__session')?.value ?? undefined;

  let decoded: DecodedIdToken | null = null;

  if (sessionCookie) {
    decoded = await verifySessionCookie(sessionCookie);
  }

  if (!decoded) {
    decoded = await verifyIdTokenHeader(req.headers.get('authorization'));
  }

  if (!decoded) {
    return null;
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    displayName: decoded.name ?? null,
  };
}

export class AuthRequiredError extends Error {
  status = 401 as const;
  code: AuthErrorCode = 'UNAUTHENTICATED';
  retryable = false as const;

  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export function jsonAuthError(
  status: number,
  code: AuthErrorCode,
  message: string,
  retryable: boolean
): NextResponse<AuthErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        retryable,
      },
    },
    { status }
  );
}

export async function requireAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}