"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AxiomSidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
class AxiomSidebarProvider {
    constructor(extensionUri, invoke, getTabData) {
        this.extensionUri = extensionUri;
        this.invoke = invoke;
        this.getTabData = getTabData;
        this.memory = null;
        this.activeFile = 'No file selected';
    }
    resolveWebviewView(webviewView) {
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
    setMemory(memory) {
        this.memory = memory;
        this.refresh();
    }
    updateActiveFile(filename) {
        this.activeFile = filename;
        if (this.view) {
            this.view.webview.postMessage({ type: 'activeFileChanged', filename });
        }
    }
    refresh() {
        if (this.view) {
            this.view.webview.postMessage({ type: 'refresh' });
        }
    }
    render() {
        if (!this.view)
            return;
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
    toTab(value) {
        return value === 'memory' || value === 'risks' || value === 'graph' || value === 'ai' ? value : 'memory';
    }
}
exports.AxiomSidebarProvider = AxiomSidebarProvider;
AxiomSidebarProvider.viewType = 'axiom.sidebar';
function getNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++)
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}
//# sourceMappingURL=sidebar.js.map