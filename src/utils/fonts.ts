import * as vscode from "vscode";
import { Font, open as openFont } from "fontkit";
import { getFilesOfDir } from "./fs";

const loadedFonts = new Set<string>();

export async function getFonts(
  os: (typeof process)["platform"] = process.platform
) {
  const installedFontPaths = getInstalledFontsPaths(os);
  const detectedFontsFiles = await Promise.all(
    installedFontPaths.map(findFonts)
  ).then((f) => f.flat());
  const fonts = await Promise.all(detectedFontsFiles.map(loadFont)).then((f) =>
    f.flat()
  );
  return fonts
    .filter((font) => isMonoFont(font))
    .map((f) =>
      loadedFonts.has(f.familyName)
        ? undefined
        : loadedFonts.add(f.familyName) && f.familyName
    )
    .filter(Boolean);
}

function isFontFile(filePath: string) {
  return (
    filePath.endsWith(".otf") ||
    filePath.endsWith(".ttf") ||
    filePath.endsWith(".ttc")
  );
}

function isMonoFont(font: Font) {
  try {
    const iGlyph = font.glyphsForString("i")[0];
    const mGlyph = font.glyphsForString("m")[0];

    if (
      iGlyph &&
      mGlyph &&
      iGlyph.advanceWidth === mGlyph.advanceWidth &&
      font.characterSet.includes(65) // 65 is captial A
    ) {
      return true;
    }
  } catch (e) {
    console.log("Error determining mono font", e, font);
  }

  return false;
}

/**
 * @param path
 * @returns Fonts in a font file
 */
async function loadFont(path: vscode.Uri): Promise<Font[]> {
  let font: Font | undefined = undefined;

  try {
    font = await openFont(path.fsPath);
  } catch (e) {
    console.error("Error loading font: " + path, e);
  }

  if (!font) {
    return [];
  }

  // @ts-ignore Typing for font kit aren't working correctly
  if (font.type === "TTC") {
    // @ts-ignore
    const fonts = font.fonts;
    return fonts;
  }

  return [font];
}

async function findFonts(rootUri: vscode.Uri): Promise<vscode.Uri[]> {
  let fileStat: vscode.FileStat | null = null;

  try {
    fileStat = await vscode.workspace.fs.stat(rootUri);
  } catch (e) {
    if (e instanceof vscode.FileSystemError) {
      console.error("Did not find font file: " + rootUri.path);
    } else {
      console.error("error: " + rootUri.path, e);
    }
  }

  if (!fileStat) {
    return [];
  }

  if (fileStat.type === vscode.FileType.Directory) {
    const directories = await getFilesOfDir(rootUri);
    const results = await Promise.all(directories.map(findFonts));
    return results.flat();
  } else if (fileStat.type === vscode.FileType.File) {
    if (isFontFile(rootUri.path)) {
      return [rootUri];
    }
  }

  return [];
}

export function getInstalledFontsPaths(os: (typeof process)["platform"]) {
  const uris: vscode.Uri[] = [];
  const userDir = vscode.Uri.file(
    process.env.HOME || process.env.USERPROFILE || "/root"
  );

  if (os === "win32") {
    const windowsUris = [
      vscode.Uri.file("c:\\Windows\\Fonts"),
      vscode.Uri.joinPath(userDir, `AppData\\Local\\Microsoft\\Windows\\Fonts`),
    ];
    uris.push(...windowsUris);
  } else if (os === "linux") {
    const linuxUris = [
      vscode.Uri.parse("/usr/share/fonts/"),
      vscode.Uri.parse("/usr/local/share/fonts/"),
      vscode.Uri.joinPath(userDir, `.fonts`),
      vscode.Uri.joinPath(userDir, `.local/share/fonts`),
    ];
    uris.push(...linuxUris);
  } else if (os === "darwin") {
    const darwinUris = [
      vscode.Uri.joinPath(userDir, "Library/Fonts"),
      vscode.Uri.parse("/Library/Fonts/"),
      vscode.Uri.parse("/System/Library/Fonts/"),
    ];
    uris.push(...darwinUris);
  }

  return uris;
}
