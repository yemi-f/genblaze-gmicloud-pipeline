import type { FileEntry } from "@genblaze-gmicloud-pipeline/shared";

export interface TreeFolder {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}

export interface TreeFile {
  type: "file";
  name: string;
  data: FileEntry;
}

export type TreeNode = TreeFolder | TreeFile;

/**
 * Build a folder/file hierarchy from a flat list of S3 keys.
 * e.g. ["runs/abc/image.jpg", "runs/abc/manifest.json"] becomes
 * a nested tree rooted at "runs/".
 */
export function buildFileTree(files: FileEntry[]): TreeNode[] {
  const root: TreeFolder = { type: "folder", name: "", path: "", children: [] };

  for (const file of files) {
    const parts = file.key.split("/");
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/") + "/";
      let folder = current.children.find(
        (c): c is TreeFolder => c.type === "folder" && c.name === folderName,
      );
      if (!folder) {
        folder = { type: "folder", name: folderName, path: folderPath, children: [] };
        current.children.push(folder);
      }
      current = folder;
    }

    current.children.push({ type: "file", name: file.filename, data: file });
  }

  sortTree(root.children);
  return root.children;
}

// Folders alphabetically first, then files sorted newest-first.
function sortTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    if (a.type === "folder" && b.type === "folder") {
      return a.name.localeCompare(b.name);
    }
    if (a.type === "file" && b.type === "file") {
      return (
        new Date(b.data.uploaded_at).getTime() -
        new Date(a.data.uploaded_at).getTime()
      );
    }
    return 0;
  });
  for (const node of nodes) {
    if (node.type === "folder") sortTree(node.children);
  }
}
