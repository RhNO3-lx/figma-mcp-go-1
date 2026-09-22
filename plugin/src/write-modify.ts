import { getBounds } from "./serializers";
import { makeSolidPaint, getParentNode, applyAutoLayout } from "./write-helpers";
import { commitMutation } from "./undo-history";

export const handleWriteModifyRequest = async (request: any) => {
  switch (request.type) {
    case "set_text": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (node.type !== "TEXT") throw new Error(`Node ${nodeId} is not a TEXT node`);
      const fontName = typeof node.fontName === "symbol"
        ? { family: "Inter", style: "Regular" }
        : node.fontName;
      await figma.loadFontAsync(fontName);
      node.characters = p.text;
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name, characters: node.characters },
      };
    }

    case "set_fills": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (!("fills" in node)) throw new Error(`Node ${nodeId} does not support fills`);
      const newFill = makeSolidPaint(p.color, p.opacity != null ? p.opacity : undefined);
      (node as any).fills = p.mode === "append"
        ? [...((node as any).fills as Paint[]), newFill]
        : [newFill];
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name },
      };
    }

    case "set_strokes": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (!("strokes" in node)) throw new Error(`Node ${nodeId} does not support strokes`);
      const newStroke = makeSolidPaint(p.color);
      (node as any).strokes = p.mode === "append"
        ? [...((node as any).strokes as Paint[]), newStroke]
        : [newStroke];
      if (p.strokeWeight != null) (node as any).strokeWeight = p.strokeWeight;
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name },
      };
    }

    case "move_nodes": {
      const p = request.params || {};
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid) as any;
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        if (!("x" in n)) { results.push({ nodeId: nid, error: "Node does not support position" }); continue; }
        if (p.x != null) n.x = p.x;
        if (p.y != null) n.y = p.y;
        results.push({ nodeId: nid, x: n.x, y: n.y });
      }
      commitMutation();
      return { type: request.type, requestId: request.requestId, data: { results } };
    }

    case "resize_nodes": {
      const p = request.params || {};
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid) as any;
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        if (!("resize" in n)) { results.push({ nodeId: nid, error: "Node does not support resize" }); continue; }
        const w = p.width != null ? p.width : n.width;
        const h = p.height != null ? p.height : n.height;
        n.resize(w, h);
        results.push({ nodeId: nid, width: n.width, height: n.height });
      }
      commitMutation();
      return { type: request.type, requestId: request.requestId, data: { results } };
    }

    case "rename_node": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      node.name = p.name;
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name },
      };
    }

    case "clone_node": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      const node = await figma.getNodeByIdAsync(nodeId) as any;
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      const clone = node.clone();
      if (p.x != null) clone.x = p.x;
      if (p.y != null) clone.y = p.y;
      if (p.parentId) {
        const parent = await getParentNode(p.parentId);
        (parent as any).appendChild(clone);
      }
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: clone.id, name: clone.name, type: clone.type, bounds: getBounds(clone) },
      };
    }

    case "set_opacity": {
      const p = request.params || {};
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid) as any;
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        if (!("opacity" in n)) { results.push({ nodeId: nid, error: "Node does not support opacity" }); continue; }
        n.opacity = p.opacity;
        results.push({ nodeId: nid, opacity: n.opacity });
      }
      commitMutation();
      return { type: request.type, requestId: request.requestId, data: { results } };
    }

    case "set_corner_radius": {
      const p = request.params || {};
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid) as any;
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        if (!("cornerRadius" in n)) { results.push({ nodeId: nid, error: "Node does not support corner radius" }); continue; }
        if (p.cornerRadius != null) n.cornerRadius = p.cornerRadius;
        if (p.topLeftRadius != null) n.topLeftRadius = p.topLeftRadius;
        if (p.topRightRadius != null) n.topRightRadius = p.topRightRadius;
        if (p.bottomLeftRadius != null) n.bottomLeftRadius = p.bottomLeftRadius;
        if (p.bottomRightRadius != null) n.bottomRightRadius = p.bottomRightRadius;
        results.push({ nodeId: nid, cornerRadius: n.cornerRadius });
      }
      commitMutation();
      return { type: request.type, requestId: request.requestId, data: { results } };
    }

    case "set_auto_layout": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (node.type !== "FRAME") throw new Error(`Node ${nodeId} is not a FRAME`);
      applyAutoLayout(node, p);
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name },
      };
    }

    default:
      return null;
  }
};
