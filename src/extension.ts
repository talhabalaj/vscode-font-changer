import * as vscode from "vscode";
import "@total-typescript/ts-reset";
import { getFonts } from "./utils/fonts";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "font-changer.selectFont",
    async () => {
      const fonts = vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          cancellable: false,
          title: "Loading fonts...",
        },
        async (progress) => {
          progress.report({ increment: 0 });

          const fonts = await getFonts();

          progress.report({ increment: 100 });

          return fonts;
        }
      );

      const config = vscode.workspace.getConfiguration("editor");
      const oldFont = config.get("fontFamily");

      let currentPreviewFont: string | undefined = undefined;
      let timeout: NodeJS.Timeout | undefined = undefined;

      const previewFont = async () => {
        await config.update("fontFamily", currentPreviewFont, true);
      };

      const selectedFont = await vscode.window.showQuickPick(fonts, {
        onDidSelectItem(item) {
          if (timeout) {
            clearTimeout(timeout);
          }

          if (typeof item === "string") {
            currentPreviewFont = item;
          }

          timeout = setTimeout(previewFont, 100);
        },
        placeHolder: "Select a font",
        title: "Change editor font",
      });

      clearTimeout(timeout);

      if (selectedFont) {
        await config.update("fontFamily", selectedFont, true);
      } else {
        await config.update("fontFamily", oldFont, true);
      }
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
