import type { Remark } from './types';

export type FlattenedRemark = {
  remark: Remark;
  level: number;
};

/**
 * Build a flattened list of remarks with hierarchy levels.
 *
 * This is a direct extraction of the behavior currently implemented
 * in TaskTable: remarks are grouped by parentId, sorted by timestamp
 * within each group, and then traversed depth-first starting from
 * "root" (remarks without parentId).
 *
 * No new semantics are introduced; ordering and parent/child
 * relationships are preserved exactly.
 */
export function buildFlattenedRemarks(remarks: Remark[]): FlattenedRemark[] {
  const flattened: FlattenedRemark[] = [];
  const remarksMap = new Map<string, Remark[]>();

  // Group remarks by parentId (or "root" when absent), mirroring existing logic.
  remarks.forEach((remark) => {
    const parentId = remark.parentId || 'root';
    if (!remarksMap.has(parentId)) {
      remarksMap.set(parentId, []);
    }
    remarksMap.get(parentId)!.push(remark);
  });

  // Sort each group by timestamp ascending, as done in TaskTable today.
  remarksMap.forEach((children) => {
    children.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  });

  const addChildren = (parentId: string, level: number) => {
    const children = remarksMap.get(parentId) || [];
    children.forEach((child) => {
      flattened.push({ remark: child, level });
      addChildren(child.id, level + 1);
    });
  };

  // Seed with root-level remarks using the same sentinel key.
  const rootRemarks = remarksMap.get('root') || [];
  rootRemarks.forEach((remark) => {
    flattened.push({ remark, level: 0 });
    addChildren(remark.id, 1);
  });

  return flattened;
}