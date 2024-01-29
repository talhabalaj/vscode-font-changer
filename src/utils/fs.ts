import * as vscode from "vscode";

export async function getFilesOfDir(path: vscode.Uri) {
  try {
    const files = await vscode.workspace.fs.readDirectory(path);
    return files.map((f) => vscode.Uri.joinPath(path, f[0]));
  } catch (e) {
    console.error("Error reading directory: " + path, e);
    return [];
  }
}
