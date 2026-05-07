import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const sidebarProvider = new ExceptionWrapperSidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ExceptionWrapperSidebarProvider.viewType, sidebarProvider),
	);

	const command = vscode.commands.registerCommand('wrapSelection.tryExcept', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found.');
			return;
		}

		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showErrorMessage('Select code to wrap first.');
			return;
		}

		const document = editor.document;
		if (document.languageId !== 'python') {
			vscode.window.showErrorMessage('This command only supports Python files.');
			return;
		}

		const selectedText = document.getText(selection);
		if (selectedText.trim().length === 0) {
			vscode.window.showErrorMessage('Selected text is empty.');
			return;
		}

		const startLineText = document.lineAt(selection.start.line).text;
		const baseIndent = (startLineText.match(/^(\s*)/) ?? [''])[0];
		const lines = selectedText.split(/\r?\n/);

		let minIndent = Number.MAX_SAFE_INTEGER;
		for (const line of lines) {
			if (line.trim().length === 0) {
				continue;
			}
			const indent = (line.match(/^(\s*)/) ?? [''])[0].length;
			minIndent = Math.min(minIndent, indent);
		}
		if (minIndent === Number.MAX_SAFE_INTEGER) {
			minIndent = 0;
		}

		const normalizedLines = lines.map((line) => {
			if (line.trim().length === 0) {
				return `${baseIndent}    `;
			}
			return `${baseIndent}    ${line.slice(minIndent)}`;
		});

		const wrappedText = [
			`${baseIndent}try:`,
			...normalizedLines,
			`${baseIndent}except Exception as e:`,
			`${baseIndent}    print(f"Error: {e}")`,
		].join('\n');

		await editor.edit((editBuilder) => {
			editBuilder.replace(selection, wrappedText);
		});
	});

	context.subscriptions.push(command);
}

export function deactivate() {}

class ExceptionWrapperSidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'exceptionWrapper.sidebar';

	constructor(private readonly extensionUri: vscode.Uri) {}

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};
		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message?.command === 'wrapSelection') {
				await vscode.commands.executeCommand('wrapSelection.tryExcept');
			}
		});
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Axiom</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 14px;
    }
    p {
      margin: 0 0 12px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
    }
    button {
      width: 100%;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 4px;
      padding: 8px 10px;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <h2>Axiom</h2>
  <p>Axiom eXtracts Intent from organization memory.</p>
  <p>Select Python code in the editor, then click below to wrap it in <code>try/except</code>.</p>
  <button id="wrap-btn">Wrap Selection</button>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const button = document.getElementById('wrap-btn');
    button.addEventListener('click', () => {
      vscode.postMessage({ command: 'wrapSelection' });
    });
  </script>
</body>
</html>`;
	}
}

function getNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < 32; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}
