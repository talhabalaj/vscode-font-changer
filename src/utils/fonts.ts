import * as vscode from "vscode";
import { Font, open as openFont } from "fontkit";
import { getFilesOfDir } from "./fs";

type DateString = string;
export interface CachedFontsMap {
  [key: `${string}-${DateString}`]: string[];
}

export async function getFonts(
  os: (typeof process)["platform"] = process.platform,
  cachedFonts: CachedFontsMap
) {
  const installedFontPaths = getInstalledFontsPaths(os);
  const detectedFontsFiles = await Promise.all(installedFontPaths.map(findFonts)).then((f) =>
    f.flat()
  );
  const monoFontsFamilies = await Promise.all(
    detectedFontsFiles.map(async (file) => {
      const cacheKey = `${file.uri.fsPath}-${file.stat.mtime}` as const;
      if (!(cacheKey in cachedFonts)) {
        const font = await loadFont(file.uri);
        cachedFonts[cacheKey] = font.filter(isMonoFont).map((f) => f.familyName);
      } else {
        console.log("Cache Hit");
      }

      return cachedFonts[cacheKey];
    })
  ).then((f) => f.flat());

  const loadedFontFamilies = new Set<string>();
  const uniqueFonts = monoFontsFamilies.filter((name) => {
    if (!loadedFontFamilies.has(name)) {
      loadedFontFamilies.add(name);
      return true;
    }
    return false;
  });

  return uniqueFonts;
}

function isFontFile(filePath: string) {
  return filePath.endsWith(".otf") || filePath.endsWith(".ttf") || filePath.endsWith(".ttc");
}

function isMonoFont(font: Font) {
  try {
    const iGlyph = font.glyphsForString("i")[0];
    const mGlyph = font.glyphsForString("m")[0];

    return (
      iGlyph &&
      mGlyph &&
      iGlyph.advanceWidth === mGlyph.advanceWidth &&
      font.characterSet.includes(65) // 65 is captial A
    );
  } catch (e) {
    console.error("Error determining mono font", e, font);
  }

  return false;
}

/**
 * @param path
 * @returns Fonts in a font file
 */
async function loadFont(path: vscode.Uri): Promise<Font[]> {
  try {
    const font = await openFont(path.fsPath);
    // @ts-ignore Typing for font kit isn't working correctly
    if (font.type === "TTC") {
      // @ts-ignore Typing for font kit isn't working correctly
      return font.fonts;
    } else {
      return [font];
    }
  } catch (e) {
    console.error("Error loading font:", path.fsPath, e);
    return [];
  }
}

async function findFonts(rootUri: vscode.Uri): Promise<
  {
    uri: vscode.Uri;
    stat: vscode.FileStat;
  }[]
> {
  try {
    const fileStat = await vscode.workspace.fs.stat(rootUri);
    if (fileStat.type === vscode.FileType.Directory) {
      const directories = await getFilesOfDir(rootUri);
      const results = await Promise.all(directories.map(findFonts));
      return results.flat();
    } else if (fileStat.type === vscode.FileType.File && isFontFile(rootUri.path)) {
      return [
        {
          uri: rootUri,
          stat: fileStat,
        },
      ];
    }
  } catch (e) {
    console.error("Error finding fonts:", rootUri.path, e);
  }
  return [];
}

export function getInstalledFontsPaths(os: (typeof process)["platform"]) {
  const userDir = vscode.Uri.file(process.env.HOME || process.env.USERPROFILE || "/root");

  if (os === "win32") {
    return [
      vscode.Uri.file("c:\\Windows\\Fonts"),
      vscode.Uri.joinPath(userDir, `AppData\\Local\\Microsoft\\Windows\\Fonts`),
    ];
  } else if (os === "linux") {
    return [
      vscode.Uri.parse("/usr/share/fonts/"),
      vscode.Uri.parse("/usr/local/share/fonts/"),
      vscode.Uri.joinPath(userDir, `.fonts`),
      vscode.Uri.joinPath(userDir, `.local/share/fonts`),
    ];
  } else if (os === "darwin") {
    return [
      vscode.Uri.joinPath(userDir, "Library/Fonts"),
      vscode.Uri.parse("/Library/Fonts/"),
      vscode.Uri.parse("/System/Library/Fonts/"),
    ];
  }

  return [];
}
