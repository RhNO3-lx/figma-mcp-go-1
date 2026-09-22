import { beginUndoGroup, commitUndoGroup, triggerUndoGroup, undoGroupStatus } from "./undo-history";

export const handleWriteHistoryRequest = async (request: any) => {
  const id = String(request.params?.groupId ?? "");
  switch (request.type) {
    case "begin_undo_group":
      return { type: request.type, requestId: request.requestId, data: beginUndoGroup(id) };
    case "commit_undo_group":
      return { type: request.type, requestId: request.requestId, data: commitUndoGroup(id) };
    case "trigger_undo_group":
      return { type: request.type, requestId: request.requestId, data: triggerUndoGroup(id) };
    case "get_undo_group":
      return { type: request.type, requestId: request.requestId, data: { active: undoGroupStatus() ?? null } };
    default:
      return null;
  }
};
