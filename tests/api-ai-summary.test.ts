/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * Lightweight Jest test for /api/ai-summary.
 *
 * Note:
 * - Written in plain JS style so it runs under Jest without TS transform.
 * - TypeScript complaints in-editor are expected unless @types/jest is installed;
 *   runtime Jest will handle globals (describe/it/expect/jest).
 */
import { NextRequest } from 'next/server';
// Use relative import so Vitest/Jest running in Node can resolve without Next.js alias config.
import { POST } from '../src/app/api/ai-summary/route';
import {
  generateAiProjectSummary,
  AiSummaryProjectNotFoundError,
  AiSummaryPermissionDeniedError,
  AiSummaryGenerationError,
} from '@/ai/flows/ai-project-summary';
import { createReport } from '@/lib/reports';
import {
  logAiSummaryAuditEvent,
  trackAiSummaryStarted,
  trackAiSummaryCompleted,
  trackAiSummaryAiError,
} from '@/lib/ai-summary-logs.server';

jest.mock('@/ai/flows/ai-project-summary');
jest.mock('@/lib/reports');

// Mock the firebase module to avoid real environment dependencies.
// Ensure it exposes a db compatible with route usage.
jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
}));

jest.mock('@/lib/ai-summary-logs.server', () => ({
  logAiSummaryAuditEvent: jest.fn(),
  trackAiSummaryStarted: jest.fn(),
  trackAiSummaryCompleted: jest.fn(),
  trackAiSummaryAiError: jest.fn(),
}));

// Mock new auth + authz helpers so the route under test does not require real Firebase Admin.
// These mocks simulate a valid authenticated session for the happy-path tests.
jest.mock('@/lib/auth-server', () => {
  const actual = jest.requireActual('../src/lib/auth-server');
  return {
    ...actual,
    getAuthenticatedUser: jest.fn(async () => ({ uid: 'test-user' })),
    requireAuthenticatedUser: jest.fn(async () => ({ uid: 'test-user' })),
    // Explicitly export AuthRequiredError for unauthenticated path tests when needed.
    AuthRequiredError: actual.AuthRequiredError,
  };
});

jest.mock('@/lib/authz', () => {
  const actual = jest.requireActual('../src/lib/authz');
  return {
    ...actual,
    assertCanGenerateProjectReport: jest.fn(async () => {}),
  };
});

// Helper to build a minimal NextRequest-like object for POST handler.
function buildRequest(body) {
  const url = 'http://localhost/api/ai-summary';
  const requestInit = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  };
  // @ts-expect-error NextRequest constructor signature differs in node env
  return new NextRequest(url, requestInit);
}

describe('/api/ai-summary route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 on invalid request body', async () => {
    // @ts-expect-error force invalid json parse
    const req = new NextRequest('http://localhost/api/ai-summary', {
      method: 'POST',
      // no body
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 when projectId is missing', async () => {
    const req = buildRequest({
      filterSignature: '{}',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 when filterSignature is missing', async () => {
    const req = buildRequest({
      projectId: 'p1',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_REQUEST');
  });

  it('maps AiSummaryProjectNotFoundError to 404', async () => {
    (generateAiProjectSummary as any).mockRejectedValueOnce(
      new AiSummaryProjectNotFoundError(),
    );

    const req = buildRequest({
      projectId: 'missing',
      filterSignature: '{}',
      filter: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('maps AiSummaryPermissionDeniedError to 403', async () => {
    (generateAiProjectSummary as any).mockRejectedValueOnce(
      new AiSummaryPermissionDeniedError(),
    );

    const req = buildRequest({
      projectId: 'p1',
      filterSignature: '{}',
      filter: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('PERMISSION_DENIED');
  });

  it('maps AiSummaryGenerationError AI_TIMEOUT to 504 and logs telemetry', async () => {
    (generateAiProjectSummary as any).mockRejectedValueOnce(
      new AiSummaryGenerationError('AI_TIMEOUT', 'timeout'),
    );

    const req = buildRequest({
      projectId: 'p1',
      filterSignature: '{}',
      filter: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(504);
    const data = await res.json();
    expect(data.error.code).toBe('AI_TIMEOUT');
    expect(trackAiSummaryAiError).toHaveBeenCalled();
  });

  it('maps AiSummaryGenerationError AI_FAILURE to 502 and logs telemetry', async () => {
    (generateAiProjectSummary as any).mockRejectedValueOnce(
      new AiSummaryGenerationError('AI_FAILURE', 'failure'),
    );

    const req = buildRequest({
      projectId: 'p1',
      filterSignature: '{}',
      filter: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error.code).toBe('AI_FAILURE');
    expect(trackAiSummaryAiError).toHaveBeenCalled();
  });

  it('returns 401 UNAUTHENTICATED when getAuthenticatedUser returns null', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth-server');
    (getAuthenticatedUser as any).mockResolvedValueOnce(null);

    const req = buildRequest({
      projectId: 'p1',
      filterSignature: '{}',
      filter: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('UNAUTHENTICATED');
  });

  it('on successful generation calls generateAiProjectSummary, persists report, and returns expected payload for an authenticated user', async () => {
    const mockAiResult = {
      contentMarkdown: '# Summary',
      overallStatus: 'ON_TRACK',
      wordCount: 10,
      sectionsPresent: {
        overview: true,
        timeline: true,
        milestones: true,
        risks: true,
        blockers: true,
        nextSteps: true,
      },
      sourceStats: {
        taskCount: 1,
        openTaskCount: 0,
        completedTaskCount: 1,
        milestoneCount: 0,
        remarkCount: 0,
        timeWindowDays: 1,
      },
      sourceSnapshotRange: {
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-02T00:00:00.000Z',
      },
      generationConfig: {
        model: 'test-model',
      },
    };

    (generateAiProjectSummary as any).mockResolvedValueOnce(mockAiResult);
    (createReport as any).mockImplementationOnce((reportWithoutId) => ({
      id: 'r1',
      ...reportWithoutId,
    }));

    const req = buildRequest({
      projectId: 'p1',
      filterSignature: '{"a":1}',
      filter: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(generateAiProjectSummary).toHaveBeenCalled();
    expect(createReport).toHaveBeenCalled();
    expect(data.report).toBeDefined();
    expect(data.report.type).toBe('AI_SUMMARY');
    expect(data.reusedExisting).toBe(false);
    expect(trackAiSummaryCompleted).toHaveBeenCalled();
  });
});