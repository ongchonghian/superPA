import { doc, collection, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Report, ReportType } from './types';

/**
 * Collection name for persisted reports.
 */
const REPORTS_COLLECTION = 'reports';

/**
 * Creates a new Report document in Firestore.
 *
 * Notes:
 * - Expects an initialized Firestore db from ./firebase.
 * - Writes to the `reports` collection.
 * - Ensures `createdAt` is an ISO string in the stored document.
 * - Returns the stored Report with the generated `id`.
 */
export async function createReport(report: Omit<Report, 'id'>): Promise<Report> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const { createdAt, ...rest } = report;

  // Normalize createdAt: trust caller if it is already ISO-like; otherwise, set now.
  const createdAtIso =
    typeof createdAt === 'string' && createdAt
      ? createdAt
      : new Date().toISOString();

  const collectionRef = collection(db, REPORTS_COLLECTION);
  const docRef = await addDoc(collectionRef, {
    ...rest,
    createdAt: createdAtIso,
    // Optionally keep a server timestamp field for debugging/audit without
    // affecting the primary `createdAt` ISO contract.
    createdAtServer: serverTimestamp(),
  });

  return {
    id: docRef.id,
    projectId: report.projectId,
    type: report.type,
    title: report.title,
    createdAt: createdAtIso,
    createdBy: report.createdBy,
    contentMarkdown: report.contentMarkdown,
    metadata: report.metadata,
  };
}

/**
 * Fetches a Report by its document id.
 *
 * Notes:
 * - Reads from `reports/{id}`.
 * - Maps Firestore data to the shared Report model.
 * - Returns null if document does not exist or is missing required fields.
 */
export async function getReportById(id: string): Promise<Report | null> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const docRef = doc(db, REPORTS_COLLECTION, id);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();

  if (
    !data ||
    typeof data.projectId !== 'string' ||
    typeof data.type !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.createdAt !== 'string' ||
    typeof data.createdBy !== 'string' ||
    typeof data.contentMarkdown !== 'string' ||
    typeof data.metadata !== 'object' ||
    data.metadata === null
  ) {
    return null;
  }

  const type = data.type as ReportType;

  const report: Report = {
    id: snap.id,
    projectId: data.projectId,
    type,
    title: data.title,
    createdAt: data.createdAt,
    createdBy: data.createdBy,
    contentMarkdown: data.contentMarkdown,
    metadata: data.metadata,
  };

  return report;
}