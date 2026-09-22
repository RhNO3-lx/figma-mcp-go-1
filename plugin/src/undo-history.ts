interface UndoGroup {
  id: string;
  mutationCount: number;
  startedAt: string;
}

let active: UndoGroup | undefined;

/** Commit one ordinary write, or count it inside the active grouped transaction. */
export const commitMutation = (): void => {
  if (active) {
    active.mutationCount += 1;
    return;
  }
  figma.commitUndo();
};

export const beginUndoGroup = (id: string): UndoGroup => {
  if (!id) throw new Error("undo group id is required");
  if (active) throw new Error(`undo group already active: ${active.id}`);
  // Close any earlier plugin work and establish the exact state this group returns to.
  figma.commitUndo();
  active = { id, mutationCount: 0, startedAt: new Date().toISOString() };
  return { ...active };
};

export const commitUndoGroup = (id: string): UndoGroup => {
  if (!active || active.id !== id) throw new Error(`undo group is not active: ${id}`);
  const result = { ...active };
  figma.commitUndo();
  active = undefined;
  return result;
};

export const triggerUndoGroup = (id: string): UndoGroup => {
  if (!active || active.id !== id) throw new Error(`undo group is not active: ${id}`);
  const result = { ...active };
  figma.triggerUndo();
  active = undefined;
  return result;
};

export const undoGroupStatus = (): UndoGroup | undefined => active ? { ...active } : undefined;
