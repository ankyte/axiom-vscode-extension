import * as vscode from 'vscode';
import { AxiomMemory } from './types';

export class AxiomSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'axiom.sidebar';

  private view?: vscode.WebviewView;
  private memory: AxiomMemory | null = null;

  constructor(private readonly extensionUri: vscode.Uri, private readonly invoke: (command: string) => Promise<void>) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const cmd = message?.command;
      if (typeof cmd === 'string') {
        await this.invoke(cmd);
      }
    });

    this.render();
  }

  public setMemory(memory: AxiomMemory | null): void {
    this.memory = memory;
    this.render();
  }

  private render(): void {
    if (!this.view) return;
    const webview = this.view.webview;
    const nonce = getNonce();

    const m = this.memory;
    const overview = m
      ? m.architecture.architectureSummary
      : 'Run AXIOM: Initialize Repository to build operational memory for this repository.';

    const caveman = m
      ? m.summaries
          .filter((s) => s.level === 'caveman' && s.sourceType !== 'file')
          .slice(0, 4)
          .map((s) => `<li>${escapeHtml(s.text)}</li>`)
          .join('')
      : '<li>Not indexed</li>';

    const decisions = m ? m.keyDecisions.slice(0, 4).map((d) => `<li>${escapeHtml(d)}</li>`).join('') : '<li>Not indexed</li>';
    const risks = m ? m.risks.slice(0, 4).map((r) => `<li>${escapeHtml(r)}</li>`).join('') : '<li>Not indexed</li>';
    const changes = m
      ? m.commits.slice(0, 5).map((c) => `<li><span>${escapeHtml(c.hash)}</span> ${escapeHtml(c.message)}</li>`).join('')
      : '<li>Not indexed</li>';

    const graphInfo = m
      ? `${m.graph.nodes.length} nodes / ${m.graph.edges.length} edges`
      : 'No graph generated';
    const importedAI = m
      ? m.importedAIContext.slice(0, 4).map((c) => `<li>[${escapeHtml(c.source)}] ${escapeHtml(c.what)}</li>`).join('')
      : '<li>Not indexed</li>';
    const aiDecisions = m
      ? m.historicalAIDecisions.slice(0, 4).map((d) => `<li>${escapeHtml(d)}</li>`).join('')
      : '<li>Not indexed</li>';
    const aiRisks = m
      ? m.aiDerivedRisks.slice(0, 4).map((r) => `<li>${escapeHtml(r)}</li>`).join('')
      : '<li>Not indexed</li>';
    const aiReasoning = m
      ? m.aiReasoningSummaries.slice(0, 4).map((r) => `<li>${escapeHtml(r)}</li>`).join('')
      : '<li>Not indexed</li>';

    this.view.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AXIOM</title>
<style>
:root {
  --bg: var(--vscode-sideBar-background);
  --bg2: var(--vscode-editorWidget-background);
  --line: var(--vscode-widget-border);
  --fg: var(--vscode-foreground);
  --muted: var(--vscode-descriptionForeground);
  --btn: var(--vscode-button-background);
  --btnfg: var(--vscode-button-foreground);
  --btnhover: var(--vscode-button-hoverBackground);
  --link: var(--vscode-textLink-foreground);
  --input: var(--vscode-input-background);
  --inputBorder: var(--vscode-input-border);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 12px;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  font-weight: var(--vscode-font-weight);
  line-height: 1.4;
}
.section {
  border: 1px solid var(--line);
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg2) 88%, transparent), var(--bg));
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
}
h3 {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--muted);
}
p {
  margin: 0;
  font-size: 12px;
}
ul {
  margin: 0;
  padding-left: 16px;
}
li {
  margin: 0 0 5px;
  font-size: 12px;
}
.toolbar {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
button {
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 6px;
  font-size: 12px;
  padding: 8px;
  background: var(--btn);
  color: var(--btnfg);
  cursor: pointer;
  transition: transform .12s ease, opacity .12s ease;
}
button:hover {
  background: var(--btnhover);
  opacity: .98;
  transform: translateY(-1px);
}
button:focus-visible {
  outline: 1px solid var(--link);
  outline-offset: 1px;
}
.meta {
  color: var(--muted);
  font-size: 11px;
}
</style>
</head>
<body>
  <div class="section">
    <h3>Project Overview</h3>
    <p>${escapeHtml(overview)}</p>
  </div>

  <div class="section">
    <h3>Caveman Summary</h3>
    <ul>${caveman}</ul>
  </div>

  <div class="section">
    <h3>Key Decisions</h3>
    <ul>${decisions}</ul>
  </div>

  <div class="section">
    <h3>Operational Risks</h3>
    <ul>${risks}</ul>
  </div>

  <div class="section">
    <h3>Recent Changes</h3>
    <ul>${changes}</ul>
  </div>

  <div class="section">
    <h3>Context Graph</h3>
    <p class="meta">${escapeHtml(graphInfo)}</p>
  </div>

  <div class="section">
    <h3>Imported AI Context</h3>
    <ul>${importedAI}</ul>
  </div>

  <div class="section">
    <h3>Historical AI Decisions</h3>
    <ul>${aiDecisions}</ul>
  </div>

  <div class="section">
    <h3>AI-Derived Operational Risks</h3>
    <ul>${aiRisks}</ul>
  </div>

  <div class="section">
    <h3>AI Reasoning Summaries</h3>
    <ul>${aiReasoning}</ul>
  </div>

  <div class="section">
    <h3>AI Context Actions</h3>
    <div class="toolbar">
      <button data-command="axiom.importAIContext">Import AI Context</button>
      <button data-command="axiom.refreshImportedContext">Refresh Imported Context</button>
      <button data-command="axiom.compressAIConversations">Compress AI Conversations</button>
      <button data-command="axiom.copyCombinedContext">Copy Combined Operational Context</button>
    </div>
  </div>

  <div class="section">
    <h3>Export Context</h3>
    <div class="toolbar">
      <button data-command="axiom.initialize">Initialize</button>
      <button data-command="axiom.context">/axiom-context</button>
      <button data-command="axiom.caveman">/axiom-caveman</button>
      <button data-command="axiom.summary">/axiom-summary</button>
      <button data-command="axiom.risks">/axiom-risks</button>
      <button data-command="axiom.why">/axiom-why</button>
      <button data-command="axiom.copyContext">Copy AXIOM Context</button>
      <button data-command="axiom.exportContext">Export Context</button>
    </div>
  </div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.querySelectorAll('button[data-command]').forEach((button) => {
  button.addEventListener('click', () => {
    vscode.postMessage({ command: button.dataset.command });
  });
});
</script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
