import * as vscode from "vscode";
import fontkit from "fontkit";

async function findFonts(paths: vscode.Uri[]): Promise<string[]> {
  return (
    await Promise.all(
      paths.map(async (path) => {
        try {
          const file = await vscode.workspace.fs.stat(path);

          if (file.type === vscode.FileType.Directory) {
            return findFonts(
              (await vscode.workspace.fs.readDirectory(path)).map((f) =>
                vscode.Uri.joinPath(path, f[0])
              )
            );
          } else if (file.type === vscode.FileType.File) {
            if (path.path.endsWith(".ttf") || path.path.endsWith(".otf")) {
              const font = await fontkit.open(path.path);
              return font.familyName || "-";
              if (
                font.widthOfGlyph(font.glyphsForString("i")[0].id) ===
                font.widthOfGlyph(font.glyphsForString("m")[0].id)
              ) {
                // check if monospaced
                return font.familyName;
              } else {
                return font.familyName + " (Non-monospaced)";
              }
            }
          }
        } catch (e) {
          console.error(e);
          return;
        }
      })
    )
  )
    .filter(Boolean)
    .flat() as string[];
}

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "font-changer.selectFont",
    async () => {
      // vscode.window.showInformationMessage('Hello World from Font Changer!');
      const user = "talhabalaj";
      // load font List
      const uris = [
        vscode.Uri.parse("/usr/share/fonts/"),
        vscode.Uri.parse("/usr/local/share/fonts/"),
        vscode.Uri.parse(`/home/talhabalaj/.fonts`),
        vscode.Uri.parse(`/home/talhabalaj/.local/share/fonts`),
      ];

      const fonts = await findFonts(uris);
      const config = vscode.workspace.getConfiguration("editor");
      let oldFont = config.get("fontFamily");

      const selectedFont = await vscode.window.showQuickPick(fonts, {
        onDidSelectItem(item) {
          config.update("fontFamily", item, true);
        },
      });

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
