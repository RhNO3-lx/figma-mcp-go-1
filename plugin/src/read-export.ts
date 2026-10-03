export const handleReadExportRequest = async (request: any) => {
  switch (request.type) {
    case "get_image_assets": {
      const root = await figma.getNodeByIdAsync(request.params?.rootId);
      if (!root || root.type === "DOCUMENT") throw new Error("A Page or layer rootId is required");
      if (root.type === "PAGE") await root.loadAsync();
      const hashes = new Map<string, any>();
      const walk = (node: any, ancestors: string[]) => {
        if (node.visible === false) return;
        const context = [...ancestors, node.name].slice(-5);
        for (const paint of Array.isArray(node.fills) ? node.fills : []) {
          if (paint.type !== "IMAGE" || !paint.imageHash || paint.visible === false) continue;
          const item = hashes.get(paint.imageHash) || { hash: paint.imageHash, sources: [] };
          item.sources.push({ nodeId: node.id, name: node.name, context: context.join(" / ") });
          hashes.set(paint.imageHash, item);
        }
        if ("children" in node) for (const child of node.children) walk(child, context);
      };
      walk(root, []);
      const offset = Math.max(0, Math.floor(request.params?.offset || 0));
      const limit = Math.min(20, Math.max(1, Math.floor(request.params?.limit || 10)));
      const assets = [];
      for (const item of [...hashes.values()].slice(offset, offset + limit)) {
        const image = figma.getImageByHash(item.hash);
        if (!image) continue;
        const bytes = await image.getBytesAsync();
        const size = await image.getSizeAsync();
        assets.push({ ...item, ...size, base64: figma.base64Encode(bytes) });
      }
      return { type: request.type, requestId: request.requestId, data: { total: hashes.size, offset, assets } };
    }
    case "get_screenshot": {
      const format =
        request.params && request.params.format
          ? request.params.format
          : "PNG";
      const scale =
        request.params && request.params.scale != null
          ? request.params.scale
          : 2;
      let targetNodes: any[];
      if (request.nodeIds && request.nodeIds.length > 0) {
        const nodes = await Promise.all(
          request.nodeIds.map((id: string) => figma.getNodeByIdAsync(id)),
        );
        targetNodes = nodes.filter(
          (n) => n !== null && n.type !== "DOCUMENT" && n.type !== "PAGE",
        );
      } else {
        targetNodes = figma.currentPage.selection.slice();
      }
      if (targetNodes.length === 0)
        throw new Error(
          "No nodes to export. Select nodes or provide nodeIds.",
        );
      const exports = await Promise.all(
        targetNodes.map(async (node: any) => {
          const settings: any =
            format === "SVG"
              ? { format: "SVG" }
              : format === "PDF"
                ? { format: "PDF" }
                : format === "JPG"
                  ? {
                      format: "JPG",
                      constraint: { type: "SCALE", value: scale },
                    }
                  : {
                      format: "PNG",
                      constraint: { type: "SCALE", value: scale },
                    };
          const bytes = await node.exportAsync(settings);
          const base64 = figma.base64Encode(bytes);
          return {
            nodeId: node.id,
            nodeName: node.name,
            format,
            base64,
            width: node.width,
            height: node.height,
          };
        }),
      );
      return {
        type: request.type,
        requestId: request.requestId,
        data: { exports },
      };
    }

    case "export_frames_to_pdf": {
      const nodeIds: string[] = request.nodeIds ?? [];
      if (nodeIds.length === 0) {
        throw new Error("nodeIds is required and must not be empty");
      }
      const frames: any[] = [];
      for (const id of nodeIds) {
        const node = await figma.getNodeByIdAsync(id);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
          throw new Error(`Node ${id} not found or is not exportable`);
        }
        const bytes = await (node as any).exportAsync({ format: "PDF" });
        const base64 = figma.base64Encode(bytes);
        frames.push({
          nodeId: node.id,
          nodeName: node.name,
          base64,
        });
      }
      return {
        type: request.type,
        requestId: request.requestId,
        data: { frames },
      };
    }

    default:
      return null;
  }
};
