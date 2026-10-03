import { getBounds, serializeStyles, serializeText } from './serializers';

const indexes = new Map<string, { revision: number; created: number; data: any }>();
const watchedPages = new Set<string>();
let revision = 0;
export const invalidateNodeIndexes = (): void => { revision++; indexes.clear(); };

const bounded = (value: any, fallback: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;
const loadRoot = async (id: string) => {
  const root = await figma.getNodeByIdAsync(id);
  if (!root || root.type === 'DOCUMENT') throw new Error(`Node not found: ${id}`);
  let page: any = root;
  while (page && page.type !== 'PAGE') page = page.parent;
  if (page?.loadAsync) await page.loadAsync();
  if (page?.on && !watchedPages.has(page.id)) {
    // Subscribe only to pages actually read; dynamic-page mode needs no file-wide load.
    page.on('nodechange', invalidateNodeIndexes);
    watchedPages.add(page.id);
  }
  return root;
};
const entry = async (node: any, path: string[], withText: boolean) => {
  const base: any = {id: node.id, name: node.name, type: node.type, parentId: node.parent?.id ?? null,
    path: path.join(' / '), bounds: getBounds(node),
    ...(node.visible === false ? { visible: false } : {}),
    ...('children' in node ? { childCount: node.children.length } : {}),
    styles: await serializeStyles(node)};
  if (node.type === 'TEXT') {
    const text = await serializeText(node, base);
    if (!withText) delete text.characters;
    return text;
  }
  return base;
};

/** Read only the requested depth, with inline text; never serialize deeper descendants first. */
export const readNodeOutline = async (id: string, depthValue?: number, withText = false, limitValue?: number) => {
  const root: any = await loadRoot(id);
  const depth = bounded(depthValue, 2, 12), limit = Math.max(1, bounded(limitValue, 120, 500));
  let visited = 0, truncated = false;
  const walk = async (node: any, level: number, path: string[]): Promise<any> => {
    visited++;
    const currentPath = [...path, node.name];
    const row: any = await entry(node, currentPath, withText);
    if ('children' in node && node.children.length) {
      if (level >= depth) { truncated = true; return row; }
      row.children = [];
      for (const child of node.children) {
        if (visited >= limit) { truncated = true; break; }
        row.children.push(await walk(child, level + 1, currentPath));
      }
    }
    return row;
  };
  const tree = await walk(root, 0, []);
  return { rootId: id, revision, depth, visited, truncated, tree };
};

/** Compact, bounded index scoped to one screen/container, reusable until a page change or write. */
export const readNodeIndex = async (id: string) => {
  const root: any = await loadRoot(id);
  if (root.type === 'PAGE') throw new Error('Node index requires a Frame or smaller container, not a Page');
  const cached = indexes.get(id);
  if (cached && cached.revision === revision && Date.now() - cached.created < 30_000) {
    return { ...cached.data, cacheHit: true };
  }
  const startRevision = revision, nodes: any[] = [], max = 3000;
  let truncated = false;
  const walk = async (node: any, path: string[], level: number): Promise<string[]> => {
    if (nodes.length >= max || level > 64) { truncated = true; return []; }
    const currentPath = [...path, node.name];
    const row: any = await entry(node, currentPath, true);
    nodes.push(row);
    const texts = node.type === 'TEXT' ? [node.characters] : [];
    if ('children' in node) {
      for (const child of node.children) {
        if (nodes.length >= max) { truncated = true; break; }
        const childTexts = await walk(child, currentPath, level + 1);
        if (texts.length < 6) texts.push(...childTexts.slice(0, 6 - texts.length));
      }
    }
    if (node.type !== 'TEXT' && texts.length) row.textSamples = texts.map(t => t.slice(0, 160));
    return texts;
  };
  await walk(root, [], 0);
  const data = { rootId: id, revision: startRevision, count: nodes.length, truncated, nodes };
  if (startRevision === revision) {
    if (indexes.size >= 8) indexes.delete(indexes.keys().next().value!);
    indexes.set(id, { revision, created: Date.now(), data });
  }
  return { ...data, cacheHit: false };
};

export const searchIndex = (nodes: any[], query: string, types: string[], limit: number) => {
  const q = query.toLowerCase();
  return nodes.map((node, order) => {
    if (types.length && !types.includes(node.type)) return { node, order, score: 0 };
    const name = node.name.toLowerCase(), text = (node.characters ?? '').toLowerCase();
    const samples = (node.textSamples ?? []).join(' ').toLowerCase(), path = node.path.toLowerCase();
    const score = name === q ? 100 : text === q ? 95 : name.includes(q) ? 80 : text.includes(q) ? 75 : samples.includes(q) ? 60 : path.includes(q) ? 20 : 0;
    return { node, order, score };
  }).filter(r => r.score > 0).sort((a,b) => b.score - a.score || a.order - b.order)
    .slice(0, limit).map(r => ({ ...r.node, matchScore: r.score }));
};
