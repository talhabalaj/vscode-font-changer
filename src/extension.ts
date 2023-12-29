import * as vscode from "vscode";
import fontkit from "fontkit";
import "@total-typescript/ts-reset";

async function findFonts(paths: vscode.Uri[]) {
  const fontSet = new Set<string>();

  const fontPromises = paths.map(
    async (uri): Promise<string | string[] | undefined> => {
      let fileStat: vscode.FileStat | null = null;

      try {
        fileStat = await vscode.workspace.fs.stat(uri);
      } catch (e) {
        if (e instanceof vscode.FileSystemError) {
          console.error("Did not find font file: " + uri.path);
        } else {
          console.error("error: " + uri.path, e);
        }
      }

      if (!fileStat) {
        return;
      }

      if (fileStat.type === vscode.FileType.Directory) {
        const uris = await getFilesOfDir(uri);
        const fonts = await findFonts(uris);
        return fonts.flat();
      } else if (isFileOrLink(fileStat)) {
        if (uri.path.endsWith(".otf") || uri.path.endsWith(".ttf")) {
          try {
            const font = await fontkit.open(uri.path);

            if (fontSet.has(font.familyName)) {
              return;
            }

            const iGlyph = font.glyphsForString("i")[0];
            const mGlyph = font.glyphsForString("m")[0];

            if (
              iGlyph &&
              mGlyph &&
              iGlyph.advanceWidth === mGlyph.advanceWidth &&
              font.characterSet.includes(65) // 65 is captial A
            ) {
              fontSet.add(font.familyName);
              return font.familyName;
            }
          } catch (e) {
            console.error(`skipping font ${uri.path}, error: `, e);
          }
        }
      }
    }
  );

  const fonts = await Promise.allSettled(fontPromises);

  if (fonts) {
    return fonts
      .map((f) => f.status === "fulfilled" && f.value)
      .filter(Boolean)
      .flat();
  }

  return [];
}

async function getFilesOfDir(path: vscode.Uri) {
  const files = await vscode.workspace.fs.readDirectory(path);
  return files.map((f) => vscode.Uri.joinPath(path, f[0]));
}

function isFileOrLink(file: vscode.FileStat) {
  return file.type === vscode.FileType.File;
}

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "font-changer.selectFont",
    async () => {
      const userDir = vscode.Uri.parse(process.env.HOME || "/root");
      const os = process.platform;
      const uris: vscode.Uri[] = [];

      if (os === "win32") {
        const windowsUris = [
          vscode.Uri.parse("C:\\Windows\\Fonts"),
          vscode.Uri.joinPath(userDir, `AppData/Local/Microsoft/Windows/Fonts`),
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
        const darwinUris = [vscode.Uri.joinPath(userDir, "Library/Fonts")];
        uris.push(...darwinUris);
      }

      const fonts = await findFonts(uris);
      const config = vscode.workspace.getConfiguration("editor");
      const oldFont = config.get("fontFamily");

      let timeout: NodeJS.Timeout | undefined;

      const selectedFont = await vscode.window.showQuickPick(fonts, {
        onDidSelectItem(item) {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(async () => {
            await config.update("fontFamily", item, true);
          }, 100);
        },
        placeHolder: "Select a font",
        title: "Change editor font",
      });

      clearTimeout(timeout);

      if (selectedFont) {
        config.update("fontFamily", selectedFont, true);
      } else {
        config.update("fontFamily", oldFont, true);
      }
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
