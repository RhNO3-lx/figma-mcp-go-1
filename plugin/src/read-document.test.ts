import { describe, it, expect } from "bun:test";
import { handleReadDocumentRequest } from "./read-document";

describe("get_selected_component_sources", () => {
  it("reads only selected instance keys without walking component trees", async () => {
    (globalThis as any).figma = {
      currentPage: { selection: [
        { id: "1:1", name: "App bar", type: "INSTANCE", getMainComponentAsync: async () => ({ key: "component-key-1", name: "App bar / Center", remote: true }) },
        { id: "1:2", name: "Frame", type: "FRAME" },
      ] },
    };
    const result = await handleReadDocumentRequest({ type: "get_selected_component_sources", requestId: "r1" });
    expect(result.data).toEqual([
      { id: "1:1", name: "App bar", type: "INSTANCE", componentKey: "component-key-1", componentName: "App bar / Center", remote: true },
      { id: "1:2", name: "Frame", type: "FRAME", componentKey: null, componentName: null, remote: null },
    ]);
  });
});
