// Plugin core — entry point, UI bootstrap, and request dispatch.

import { handleReadRequest } from "./read-handlers";
import { handleWriteRequest } from "./write-handlers";

let lastStatus = "";
const sendStatus = (force = false) => {
  const payload = {
    fileName: figma.root.name,
    pageId: figma.currentPage.id,
    pageName: figma.currentPage.name,
    selectionCount: figma.currentPage.selection.length,
  };
  const snapshot = JSON.stringify(payload);
  if (!force && snapshot === lastStatus) return;
  lastStatus = snapshot;
  figma.ui.postMessage({ type: "plugin-status", payload });
};

const handleRequest = async (request: any) => {
  try {
    const result =
      (await handleReadRequest(request)) ??
      (await handleWriteRequest(request));
    if (result === null)
      throw new Error(`Unknown request type: ${request.type}`);
    return result;
  } catch (error) {
    return {
      type: request.type,
      requestId: request.requestId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

figma.showUI(__html__, { width: 320, height: 210 });
sendStatus();
// Page/file renames do not emit currentpagechange. Read only these cheap fields;
// documentchange would require loading every page in dynamic-page mode.
const statusTimer = setInterval(sendStatus, 1000);
figma.on("close", () => clearInterval(statusTimer));

figma.on("selectionchange", () => {
  sendStatus();
});

figma.on("currentpagechange", () => {
  sendStatus();
});

figma.ui.onmessage = async (message) => {
  if (message.type === "ui-ready") {
    sendStatus(true);
    return;
  }
  if (message.type === "server-request") {
    const response = await handleRequest(message.payload);
    try {
      figma.ui.postMessage(response);
    } catch (err) {
      figma.ui.postMessage({
        type: response.type,
        requestId: response.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
