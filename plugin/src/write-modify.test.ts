import { describe, it, expect, beforeEach } from "bun:test";
import { handleWriteModifyRequest } from "./write-modify";

// ── Figma global mock ─────────────────────────────────────────────────────────

let mockNodes: Record<string, any>;
let commitUndoCalled: boolean;

const makeRequest = (type: string, nodeIds?: string[], params?: any) => ({
  type,
  requestId: "req-test-1",
  nodeIds: nodeIds ?? [],
  params: params ?? {},
});

beforeEach(() => {
  commitUndoCalled = false;
  mockNodes = {};
  (globalThis as any).figma = {
    getNodeByIdAsync: async (id: string) => mockNodes[id] ?? null,
    loadFontAsync: async () => undefined,
    commitUndo: () => { commitUndoCalled = true; },
  };
});

describe("set_text_style", () => {
  it("loads and applies a new font family, style, and size", async () => {
    mockNodes["1:1"] = { id: "1:1", name: "Label", type: "TEXT", characters: "Hello", fontName: { family: "Inter", style: "Regular" }, fontSize: 14 };
    const res = await handleWriteModifyRequest(makeRequest("set_text_style", ["1:1"], { fontFamily: "Noto Sans SC", fontStyle: "Bold", fontSize: 18 }));
    expect(mockNodes["1:1"].fontName).toEqual({ family: "Noto Sans SC", style: "Bold" });
    expect(mockNodes["1:1"].fontSize).toBe(18);
    expect(res?.data.fontSize).toBe(18);
    expect(commitUndoCalled).toBe(true);
  });

  it("rejects non-text nodes", async () => {
    mockNodes["1:1"] = { id: "1:1", name: "Frame", type: "FRAME" };
    await expect(handleWriteModifyRequest(makeRequest("set_text_style", ["1:1"], { fontStyle: "Bold" }))).rejects.toThrow("not a TEXT");
  });
});

// ── set_opacity ───────────────────────────────────────────────────────────────

describe("set_opacity", () => {
  it("sets opacity on a node", async () => {
    mockNodes["1:1"] = { id: "1:1", name: "Frame", opacity: 1 };
    const res = await handleWriteModifyRequest(makeRequest("set_opacity", ["1:1"], { opacity: 0.5 }));
    expect(res?.data.results[0].opacity).toBe(0.5);
    expect(mockNodes["1:1"].opacity).toBe(0.5);
    expect(commitUndoCalled).toBe(true);
  });

  it("sets opacity to 0", async () => {
    mockNodes["1:1"] = { id: "1:1", opacity: 1 };
    const res = await handleWriteModifyRequest(makeRequest("set_opacity", ["1:1"], { opacity: 0 }));
    expect(res?.data.results[0].opacity).toBe(0);
  });

  it("reports error for missing node", async () => {
    const res = await handleWriteModifyRequest(makeRequest("set_opacity", ["9:9"], { opacity: 0.5 }));
    expect(res?.data.results[0].error).toBe("Node not found");
  });

  it("reports error for node without opacity support", async () => {
    mockNodes["1:1"] = { id: "1:1", name: "Page" }; // no opacity property
    const res = await handleWriteModifyRequest(makeRequest("set_opacity", ["1:1"], { opacity: 0.5 }));
    expect(res?.data.results[0].error).toContain("does not support opacity");
  });

  it("handles multiple nodeIds", async () => {
    mockNodes["1:1"] = { id: "1:1", opacity: 1 };
    mockNodes["2:2"] = { id: "2:2", opacity: 1 };
    const res = await handleWriteModifyRequest(makeRequest("set_opacity", ["1:1", "2:2"], { opacity: 0.25 }));
    expect(res?.data.results).toHaveLength(2);
    expect(mockNodes["1:1"].opacity).toBe(0.25);
    expect(mockNodes["2:2"].opacity).toBe(0.25);
  });

  it("throws for empty nodeIds", async () => {
    await expect(handleWriteModifyRequest(makeRequest("set_opacity", [], { opacity: 0.5 }))).rejects.toThrow();
  });
});

// ── set_corner_radius ─────────────────────────────────────────────────────────

describe("set_corner_radius", () => {
  it("sets uniform cornerRadius", async () => {
    mockNodes["1:1"] = { id: "1:1", cornerRadius: 0 };
    const res = await handleWriteModifyRequest(makeRequest("set_corner_radius", ["1:1"], { cornerRadius: 8 }));
    expect(mockNodes["1:1"].cornerRadius).toBe(8);
    expect(res?.data.results[0].cornerRadius).toBe(8);
    expect(commitUndoCalled).toBe(true);
  });

  it("sets per-corner radii independently", async () => {
    mockNodes["1:1"] = {
      id: "1:1", cornerRadius: 0,
      topLeftRadius: 0, topRightRadius: 0, bottomLeftRadius: 0, bottomRightRadius: 0,
    };
    await handleWriteModifyRequest(makeRequest("set_corner_radius", ["1:1"], {
      topLeftRadius: 8, topRightRadius: 0, bottomLeftRadius: 8, bottomRightRadius: 0,
    }));
    expect(mockNodes["1:1"].topLeftRadius).toBe(8);
    expect(mockNodes["1:1"].topRightRadius).toBe(0);
    expect(mockNodes["1:1"].bottomLeftRadius).toBe(8);
    expect(mockNodes["1:1"].bottomRightRadius).toBe(0);
  });

  it("reports error for missing node", async () => {
    const res = await handleWriteModifyRequest(makeRequest("set_corner_radius", ["9:9"], { cornerRadius: 4 }));
    expect(res?.data.results[0].error).toBe("Node not found");
  });

  it("reports error for node without cornerRadius support", async () => {
    mockNodes["1:1"] = { id: "1:1", name: "Text" }; // no cornerRadius property
    const res = await handleWriteModifyRequest(makeRequest("set_corner_radius", ["1:1"], { cornerRadius: 4 }));
    expect(res?.data.results[0].error).toContain("does not support corner radius");
  });

  it("handles multiple nodeIds", async () => {
    mockNodes["1:1"] = { id: "1:1", cornerRadius: 0 };
    mockNodes["2:2"] = { id: "2:2", cornerRadius: 0 };
    const res = await handleWriteModifyRequest(makeRequest("set_corner_radius", ["1:1", "2:2"], { cornerRadius: 12 }));
    expect(res?.data.results).toHaveLength(2);
    expect(mockNodes["1:1"].cornerRadius).toBe(12);
    expect(mockNodes["2:2"].cornerRadius).toBe(12);
  });

  it("returns null for unrecognised type", async () => {
    const res = await handleWriteModifyRequest(makeRequest("unknown_op"));
    expect(res).toBeNull();
  });
});
