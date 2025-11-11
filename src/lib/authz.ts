import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export class AuthzError extends Error {
  status = 403 as const;
  code = 'PERMISSION_DENIED' as const;
  retryable = false as const;

  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'AuthzError';
  }
}

type ProjectAccessDoc = {
  id: string;
  name?: string;
  ownerId?: string;
  collaboratorIds?: string[];
};

/**
 * Load minimal project/checklist document for authorization decisions.
 *
 * This mirrors the access pattern used in /api/ai-summary:
 * - Projects are represented by documents in the `checklists` collection.
 * - We query by the stable `id` field.
 */
async function loadProjectForAccessCheck(projectId: string): Promise<ProjectAccessDoc | null> {
  if (!db) {
    // When Firestore is not configured, treat as not found to avoid leaking config issues.
    return null;
  }

  const checklistsRef = collection(db, 'checklists');
  const q = query(checklistsRef, where('id', '==', projectId), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) {
    return null;
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data() as any;

  if (!data || typeof data.id !== 'string') {
    return null;
  }

  return {
    id: data.id,
    name: typeof data.name === 'string' ? data.name : undefined,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    collaboratorIds: Array.isArray(data.collaboratorIds)
      ? data.collaboratorIds.filter((v: unknown) => typeof v === 'string')
      : undefined,
  };
}

/**
 * Low-level access check: can this user access this project at all?
 *
 * Rules (current behavior):
 * - Allow if user is the project owner.
 * - Allow if user is listed in collaboratorIds.
 * - Otherwise deny with AuthzError.
 *
 * If the project does not exist, callers may choose to:
 * - Map to 404 PROJECT_NOT_FOUND; or
 * - Treat as permission denied to avoid leaking.
 */
export async function assertCanAccessProject(
  userId: string,
  projectId: string,
): Promise<void> {
  if (!userId) {
    throw new AuthzError('You must be signed in to access this project.');
  }

  const project = await loadProjectForAccessCheck(projectId);

  if (!project) {
    // Let caller decide 404 vs 403; expose a neutral message.
    throw new AuthzError('Project not found or unavailable.');
  }

  const { ownerId, collaboratorIds } = project;

  if (ownerId && ownerId === userId) {
    return;
  }

  if (
    Array.isArray(collaboratorIds) &&
    collaboratorIds.includes(userId)
  ) {
    return;
  }

  throw new AuthzError('You do not have permission to access this project.');
}

/**
 * Higher-level check for generating project AI summaries or reports.
 *
 * Currently this is equivalent to basic project access, but is split out so
 * we can evolve report-specific rules without touching call sites.
 */
export async function assertCanGenerateProjectReport(
  userId: string,
  projectId: string,
): Promise<void> {
  await assertCanAccessProject(userId, projectId);
}