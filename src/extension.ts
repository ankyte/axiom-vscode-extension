import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
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
