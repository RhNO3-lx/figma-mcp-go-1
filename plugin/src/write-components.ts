export const handleWriteComponentRequest = async (request: any) => {
  switch (request.type) {
    case "insert_component_instance": {
      const p = request.params || {};
      if (!p.parentId) throw new Error("parentId is required");
      if (!!p.componentId === !!p.componentKey) throw new Error("Provide exactly one of componentId or componentKey");
      const parent = await figma.getNodeByIdAsync(p.parentId);
      if (!parent || !("appendChild" in parent)) throw new Error(`Parent ${p.parentId} cannot contain an instance`);
      const component = p.componentId
        ? await figma.getNodeByIdAsync(p.componentId)
        : await figma.importComponentByKeyAsync(p.componentKey);
      if (!component || component.type !== "COMPONENT") throw new Error("Component not found or not published");
      const instance = component.createInstance();
      try {
        (parent as ChildrenMixin & BaseNode).appendChild(instance);
        instance.x = Number(p.x ?? 0);
        instance.y = Number(p.y ?? 0);
        if (p.name) instance.name = String(p.name);
        if (p.properties && Object.keys(p.properties).length) instance.setProperties(p.properties);
      } catch (error) {
        instance.remove();
        throw error;
      }
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: instance.id, name: instance.name, type: instance.type, componentId: component.id },
      };
    }
    case "swap_component": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      if (!p.componentId) throw new Error("componentId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (node.type !== "INSTANCE") throw new Error(`Node ${nodeId} is not a component INSTANCE`);
      const component = await figma.getNodeByIdAsync(p.componentId);
      if (!component) throw new Error(`Component not found: ${p.componentId}`);
      if (component.type !== "COMPONENT") throw new Error(`Node ${p.componentId} is not a COMPONENT`);
      node.mainComponent = component;
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name, componentId: component.id, componentName: component.name },
      };
    }

    case "detach_instance": {
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid);
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        if (n.type !== "INSTANCE") { results.push({ nodeId: nid, error: "Node is not an INSTANCE" }); continue; }
        const frame = n.detachInstance();
        results.push({ nodeId: nid, newId: frame.id, name: frame.name });
      }
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { results },
      };
    }

    case "delete_nodes": {
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid);
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        n.remove();
        results.push({ nodeId: nid, deleted: true });
      }
      commitMutation();
      return { type: request.type, requestId: request.requestId, data: { results } };
    }

    case "navigate_to_page": {
      const p = request.params || {};
      let page: PageNode | undefined;
      if (p.pageId) {
        const found = await figma.getNodeByIdAsync(p.pageId);
        if (!found) throw new Error(`Page not found: ${p.pageId}`);
        if (found.type !== "PAGE") throw new Error(`Node ${p.pageId} is not a PAGE`);
        page = found as PageNode;
      } else if (p.pageName) {
        page = figma.root.children.find(pg => pg.name === p.pageName) as PageNode | undefined;
        if (!page) throw new Error(`Page not found with name: ${p.pageName}`);
      } else {
        throw new Error("pageId or pageName is required");
      }
      figma.currentPage = page;
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: page.id, name: page.name },
      };
    }

    case "group_nodes": {
      const p = request.params || {};
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const nodes = await Promise.all(nodeIds.map((id: string) => figma.getNodeByIdAsync(id)));
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && n.type !== "DOCUMENT" && n.type !== "PAGE");
      if (validNodes.length === 0) throw new Error("No valid scene nodes found");
      const parent = validNodes[0].parent;
      if (!parent) throw new Error("Nodes must have a parent");
      const group = figma.group(validNodes, parent as any);
      if (p.name) group.name = p.name;
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: group.id, name: group.name, type: group.type },
      };
    }

    case "wrap_nodes_in_section": {
      const ids: string[] = request.nodeIds || [];
      if (ids.length < 2 || new Set(ids).size !== ids.length) throw new Error("At least two distinct frame IDs are required");
      const nodes = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)));
      if (nodes.some((node) => !node || node.type !== "FRAME")) throw new Error("Every selected node must be an existing FRAME");
      const frames = nodes as FrameNode[];
      const page = frames[0].parent;
      if (!page || page.type !== "PAGE" || frames.some((frame) => frame.parent?.id !== page.id)) {
        throw new Error("Selected screens must be top-level frames on the same page");
      }
      const padding = Math.max(0, Math.min(200, Number(request.params?.padding ?? 32)));
      if (!Number.isFinite(padding)) throw new Error("padding must be a finite number");
      const before = frames.map((frame) => ({ id: frame.id, x: frame.x, y: frame.y }));
      const left = Math.min(...frames.map((frame) => frame.x));
      const top = Math.min(...frames.map((frame) => frame.y));
      const right = Math.max(...frames.map((frame) => frame.x + frame.width));
      const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
      const section = figma.createSection();
      page.appendChild(section);
      section.name = request.params?.name || "Screens";
      section.x = left - padding;
      section.y = top - padding;
      section.resize(right - left + 2 * padding, bottom - top + 2 * padding);
      for (let index = 0; index < frames.length; index++) {
        const frame = frames[index]!;
        const position = before[index]!;
        section.appendChild(frame);
        frame.x = position.x - section.x;
        frame.y = position.y - section.y;
      }
      if (frames.some((frame) => frame.parent?.id !== section.id)) throw new Error("A screen was not moved into the section");
      commitMutation();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: section.id, name: section.name, type: section.type, pageId: page.id, childIds: frames.map((frame) => frame.id) },
      };
    }

    case "ungroup_nodes": {
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid);
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        if (n.type !== "GROUP") { results.push({ nodeId: nid, error: "Node is not a GROUP" }); continue; }
        const group = n as GroupNode;
        const parent = group.parent as any;
        const index = parent.children.indexOf(group);
        const childIds: string[] = [];
        for (const child of [...group.children]) {
          parent.insertChild(index, child as SceneNode);
          childIds.push(child.id);
        }
        group.remove();
        results.push({ nodeId: nid, childIds });
      }
      commitMutation();
      return { type: request.type, requestId: request.requestId, data: { results } };
    }

    default:
      return null;
  }
};
import { commitMutation } from "./undo-history";
