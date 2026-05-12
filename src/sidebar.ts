import * as vscode from 'vscode';
import { AxiomMemory } from './types';
import { SidebarTab, SidebarTabData } from './vscode/AxiomBackendApi';

export class AxiomSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'axiom.sidebar';

  private view?: vscode.WebviewView;
  private memory: AxiomMemory | null = null;
  private activeFile = 'No file selected';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly invoke: (command: string) => Promise<void>,
    private readonly getTabData?: (tab: SidebarTab, activeFile: string) => Promise<SidebarTabData>,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const cmd = message?.command;
      if (message?.type === 'getTabData' && this.getTabData) {
        const tab = this.toTab(message.tab);
        const data = await this.getTabData(tab, this.activeFile);
        await webviewView.webview.postMessage({ type: 'tabData', tab, data });
        return;
      }
      if (typeof cmd === 'string') {
        await this.invoke(cmd);
      }
    });

    this.render();
  }

  public setMemory(memory: AxiomMemory | null): void {
    this.memory = memory;
    this.refresh();
  }

  public updateActiveFile(filename: string): void {
    this.activeFile = filename;
    if (this.view) {
      this.view.webview.postMessage({ type: 'activeFileChanged', filename });
    }
  }

  public refresh(): void {
    if (this.view) {
      this.view.webview.postMessage({ type: 'refresh' });
    }
  }

  private render(): void {
    if (!this.view) return;
    const webview = this.view.webview;
    const nonce = getNonce();

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.js'));

    this.view.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AXIOM</title>
<link href="${styleUri}" rel="stylesheet">
</head>
<body>
  
  <div class="header">
    <div class="header-title">
      AXIOM <span style="text-transform: lowercase; opacity: 0.6; font-weight: 500;">organizational memory active</span>
    </div>
    <div class="pulse" title="Activity pulse"></div>
  </div>

  <div class="tabs">
    <div class="tab active" data-target="memory">Memory</div>
    <div class="tab" data-target="risks">Risks</div>
    <div class="tab" data-target="graph">Graph</div>
    <div class="tab" data-target="ai">AI</div>
  </div>

  <div id="content-memory" class="content active"></div>
  <div id="content-risks" class="content"></div>
  <div id="content-graph" class="content"></div>
  <div id="content-ai" class="content"></div>

<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private toTab(value: unknown): SidebarTab {
    return value === 'memory' || value === 'risks' || value === 'graph' || value === 'ai' ? value : 'memory';
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
