// Builds a nested tree from flat folder/paper lists (as returned by the API).
// Each node: { id, name, children: [...folders], papers: [...papers directly in it] }.
// Returns { rootFolders, rootPapers } for the top level (parentFolderId / folderId null).
export function buildFolderTree(folders, papers) {
  const nodeById = new Map();
  folders.forEach((f) => {
    nodeById.set(f.id, { id: f.id, name: f.name, children: [], papers: [] });
  });

  const rootFolders = [];
  folders.forEach((f) => {
    const node = nodeById.get(f.id);
    if (f.parentFolderId && nodeById.has(f.parentFolderId)) {
      nodeById.get(f.parentFolderId).children.push(node);
    } else {
      rootFolders.push(node);
    }
  });

  const rootPapers = [];
  papers.forEach((p) => {
    if (p.folderId && nodeById.has(p.folderId)) {
      nodeById.get(p.folderId).papers.push(p);
    } else {
      rootPapers.push(p);
    }
  });

  return { rootFolders, rootPapers };
}

// Depth-first search through a built tree (see buildFolderTree) for the node
// matching this folder id.
export function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (String(node.id) === String(id)) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

// Ancestor chain from the subject root down to (and including) this folder,
// e.g. [Chapter, "2023 Papers"] — for rendering a breadcrumb.
export function getFolderPath(folders, folderId) {
  const byId = new Map(folders.map((f) => [String(f.id), f]));
  const path = [];
  let current = byId.get(String(folderId));
  while (current) {
    path.unshift(current);
    current = current.parentFolderId ? byId.get(String(current.parentFolderId)) : null;
  }
  return path;
}

// Flat list of {id, name, depth} for building an indented <select> of folders,
// e.g. "— Model Papers" at depth 1, "— — 2023" at depth 2.
export function flattenFoldersForSelect(folders) {
  const byParent = new Map();
  folders.forEach((f) => {
    const key = f.parentFolderId || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(f);
  });

  const result = [];
  function walk(parentKey, depth) {
    const children = byParent.get(parentKey) || [];
    children.forEach((f) => {
      result.push({ id: f.id, name: f.name, depth });
      walk(f.id, depth + 1);
    });
  }
  walk('root', 0);
  return result;
}
