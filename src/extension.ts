import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { CopilotAdapter } from './adapters/copilotAdapter';
import { WindsurfAdapter } from './adapters/windsurfAdapter';
import { MarkdownAdapter } from './adapters/markdownAdapter';
import { EngineeringAuditor } from './auditor';
import { CavemanEngine } from './compression';
import { RepositoryIngestion } from './ingestion';
import { OpenAIClient } from './openaiClient';
import { RetrievalEngine } from './retrieval';
import { AxiomSidebarProvider } from './sidebar';
import { AIContextIntegrationService } from './services/aiContextIntegrationService';
import { IntentExtractionService } from './services/intentExtractionService';
import { MemoryStore } from './storage';
import { AxiomMemory, GraphEdge, GraphNode } from './types';
import { hashId } from './utils';
import { AxiomKernel } from './core/AxiomKernel';
import { AxiomBackendApi } from './vscode/AxiomBackendApi';

export function activate(context: vscode.ExtensionContext): void {
  const ai = new OpenAIClient();
  const ingestion = new RepositoryIngestion(ai);
  const compressor = new CavemanEngine();
  const store = new MemoryStore(context);
  const retrieval = new RetrievalEngine();
  const auditor = new EngineeringAuditor();
  const intentExtraction = new IntentExtractionService();
  const aiIntegration = new AIContextIntegrationService(compressor);
  const axiomKernel = new AxiomKernel({
    storageRoot: context.globalStorageUri.fsPath,
    workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });
  const axiomApi = new AxiomBackendApi(axiomKernel);

  // Privacy: adapters run local-only scans; no telemetry or external upload.
  const adapters = [new CopilotAdapter(), new WindsurfAdapter(), new MarkdownAdapter()];

  let memoryCache: AxiomMemory | null = null;

  const getWorkspaceFolder = (): vscode.WorkspaceFolder | null => {
    const folder = vscode.workspace.workspaceFolders?.[0] ?? null;
    if (!folder) {
      vscode.window.showWarningMessage('AXIOM needs an open workspace folder.');
    }
    return folder;
  };

  const ensureMemory = async (): Promise<AxiomMemory | null> => {
    const folder = getWorkspaceFolder();
    if (!folder) return null;

    if (memoryCache && memoryCache.repoRoot === folder.uri.fsPath) {
      return memoryCache;
    }

    const loaded = await store.load(folder.uri.fsPath);
    if (!loaded) {
      vscode.window.showInformationMessage('AXIOM memory not initialized. Run AXIOM: Initialize Repository.');
      return null;
    }

    memoryCache = normalizeMemory(loaded);
    sidebar.setMemory(memoryCache);
    return memoryCache;
  };

  const saveAndRefresh = async (memory: AxiomMemory): Promise<void> => {
    memory.auditorFindings = auditor.run(memory);
    await store.save(memory);
    memoryCache = memory;
    sidebar.setMemory(memory);
  };

  const initialize = async (): Promise<void> => {
    const folder = getWorkspaceFolder();
    if (!folder) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AXIOM is extracting operational memory',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 20, message: 'Ingesting repository' });
        const ingested = await ingestion.ingest(folder);

        progress.report({ increment: 30, message: 'Compressing context' });
        const summaries = compressor.compress({
          files: ingested.files,
          commits: ingested.commits,
          prs: ingested.prs,
          architectureSummary: ingested.architecture.architectureSummary,
        });

        progress.report({ increment: 25, message: 'Building memory graph' });
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        for (const file of ingested.files.slice(0, 80)) {
          const id = `file:${file.path}`;
          nodes.push({ id, type: 'file', label: file.path });
        }

        for (const commit of ingested.commits.slice(0, 30)) {
          const id = `commit:${commit.hash}`;
          nodes.push({ id, type: 'commit', label: commit.message });
        }

        const serviceNodes = ingested.architecture.services.map((s) => ({ id: `service:${s}`, type: 'service' as const, label: s }));
        nodes.push(...serviceNodes);

        for (const summary of summaries.slice(0, 160)) {
          const sid = `summary:${summary.id}`;
          nodes.push({ id: sid, type: 'summary', label: summary.text });
          edges.push({
            from: sid,
            to: `${summary.sourceType}:${summary.sourceId}`,
            relation: summary.sourceType === 'commit' ? 'introduced_by' : 'affects',
          });
        }

        for (const service of serviceNodes) {
          const linked = ingested.files.filter((f) => f.path.includes(path.basename(service.label))).slice(0, 3);
          for (const file of linked) {
            edges.push({ from: service.id, to: `file:${file.path}`, relation: 'related_to' });
          }
        }

        const keyDecisions = ingested.prs.map((p) => p.decision);
        const risks = [
          ...ingested.prs.map((p) => p.risk),
          ...ingested.files.flatMap((f) => f.riskSignals.map((signal) => `${f.path}: ${signal}`)),
        ];

        const memory: AxiomMemory = {
          repoRoot: folder.uri.fsPath,
          lastIndexedAt: new Date().toISOString(),
          architecture: ingested.architecture,
          files: ingested.files,
          commits: ingested.commits,
          prs: ingested.prs,
          summaries,
          graph: { nodes, edges },
          keyDecisions,
          risks,
          auditorFindings: [],
          importedAIContext: [],
          historicalAIDecisions: [],
          aiDerivedRisks: [],
          aiReasoningSummaries: [],
        };

        progress.report({ increment: 25, message: 'Persisting memory' });
        await saveAndRefresh(memory);
      },
    );

    await axiomKernel.connectRepository(path.basename(folder.uri.fsPath));
    await axiomKernel.connectRepository('pricing-service');
    sidebar.refresh();
    vscode.window.showInformationMessage('AXIOM operational memory initialized.');
  };

  const importAIContext = async (): Promise<void> => {
    const memory = await ensureMemory();
    if (!memory) return;
    const folder = getWorkspaceFolder();
    if (!folder) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AXIOM importing local AI context',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 30, message: 'Scanning local chat sessions' });
        const chunks = await adapters[0].extractChunks(300, folder.uri.fsPath);
        if (chunks.length === 0) {
          vscode.window.showInformationMessage('No relevant local Copilot conversation context found for this workspace.');
          return;
        }

        progress.report({ increment: 30, message: 'Extracting engineering intent' });
        const intents = intentExtraction.extract(chunks);
        if (intents.length === 0) {
          vscode.window.showInformationMessage('AI conversations were found, but no high-signal engineering intent matched this workspace.');
          return;
        }

        progress.report({ increment: 40, message: 'Merging into operational memory' });
        const merged = aiIntegration.merge(normalizeMemory(memory), intents);
        await saveAndRefresh(merged);

        vscode.window.showInformationMessage(`AXIOM imported ${intents.length} high-signal AI reasoning chunks from Copilot.`);
      },
    );
  };

  const refreshImportedContext = async (): Promise<void> => {
    await importAIContext();
  };

  const compressAIConversations = async (): Promise<void> => {
    const memory = await ensureMemory();
    if (!memory) return;

    if (normalizeMemory(memory).importedAIContext.length === 0) {
      vscode.window.showInformationMessage('No imported AI context found. Run AXIOM: Import AI Context first.');
      return;
    }

    const intents = normalizeMemory(memory).importedAIContext.map((item) => ({
      id: item.id,
      source: item.source,
      sessionId: item.sessionId,
      timestamp: item.timestamp,
      what: item.what,
      why: item.why,
      impact: item.impact,
      referencedFiles: item.referencedFiles,
      relatedServices: item.relatedServices,
      rawExcerpt: item.rawExcerpt,
    }));

    const merged = aiIntegration.merge(memory, intents);
    await saveAndRefresh(merged);
    vscode.window.showInformationMessage('AXIOM compressed imported AI conversations into memory summaries.');
  };

  const runTextCommand = async (command: 'context' | 'caveman' | 'summary' | 'risks' | 'why'): Promise<void> => {
    const memory = await ensureMemory();
    if (!memory) return;

    if (command === 'context') {
      const pack = retrieval.contextPack(memory);
      await vscode.env.clipboard.writeText(pack);
      await vscode.workspace.openTextDocument({ content: pack, language: 'markdown' }).then(vscode.window.showTextDocument);
      return;
    }

    if (command === 'caveman') {
      const result = retrieval.query(memory, 'caveman operational behavior resiliency queue retry', 'caveman');
      const text = result.map((r) => `- ${r.text}`).join('\n');
      await vscode.workspace.openTextDocument({ content: `# AXIOM Caveman Summary\n\n${text}`, language: 'markdown' }).then(vscode.window.showTextDocument);
      return;
    }

    if (command === 'summary') {
      const result = retrieval.query(memory, 'architecture modules system behavior', 'system');
      const text = result.map((r) => `- ${r.text}`).join('\n');
      await vscode.workspace.openTextDocument({ content: `# AXIOM System Summary\n\n${text}`, language: 'markdown' }).then(vscode.window.showTextDocument);
      return;
    }

    if (command === 'risks') {
      const riskLines = [
        ...memory.risks.slice(0, 12).map((r) => `- ${r}`),
        ...memory.aiDerivedRisks.slice(0, 6).map((r) => `- [ai] ${r}`),
        ...memory.auditorFindings.map((f) => `- [${f.severity}] ${f.statement} (${f.evidence})`),
      ].join('\n');
      await vscode.workspace.openTextDocument({ content: `# AXIOM Operational Risks\n\n${riskLines}`, language: 'markdown' }).then(vscode.window.showTextDocument);
      return;
    }

    const prompt = await vscode.window.showInputBox({
      prompt: 'Ask AXIOM why a behavior exists',
      value: 'Why does retry logic exist?',
    });
    if (!prompt) return;

    const result = retrieval.query(memory, prompt);
    const text = result
      .map((r) => `- ${r.text}\n  intent: ${r.intent}\n  behavior: ${r.behavior}`)
      .join('\n');
    await vscode.workspace.openTextDocument({ content: `# AXIOM Why\n\nQuestion: ${prompt}\n\n${text}`, language: 'markdown' }).then(vscode.window.showTextDocument);
  };

  const copyContext = async (): Promise<void> => {
    const memory = await ensureMemory();
    if (!memory) return;
    const pack = retrieval.contextPack(memory);
    await vscode.env.clipboard.writeText(pack);
    vscode.window.showInformationMessage('AXIOM context copied to clipboard.');
  };

  const copyCombinedContext = async (): Promise<void> => {
    const memory = await ensureMemory();
    if (!memory) return;
    const pack = retrieval.combinedOperationalContext(memory);
    await vscode.env.clipboard.writeText(pack);
    vscode.window.showInformationMessage('Combined operational context copied.');
  };

  const exportContext = async (): Promise<void> => {
    const memory = await ensureMemory();
    if (!memory) return;

    const folder = getWorkspaceFolder();
    if (!folder) return;

    const exported = retrieval.combinedOperationalContext(memory);
    const exportDir = path.join(folder.uri.fsPath, '.axiom');
    const exportPath = path.join(exportDir, `axiom-context-${hashId(new Date().toISOString())}.md`);
    await fs.mkdir(exportDir, { recursive: true });
    await fs.writeFile(exportPath, exported, 'utf8');
    vscode.window.showInformationMessage(`AXIOM context exported: ${path.relative(folder.uri.fsPath, exportPath)}`);
  };

  const connectRepository = async (): Promise<void> => {
    const repoName = await vscode.window.showInputBox({
      prompt: 'Connect repository to AXIOM organizational memory',
      value: 'pricing-service',
    });
    if (!repoName) return;
    await axiomKernel.connectRepository(repoName.trim());
    sidebar.refresh();
    vscode.window.showInformationMessage(`AXIOM connected ${repoName.trim()} and indexed repository memory.`);
  };

  const simulateActivity = async (): Promise<void> => {
    await axiomKernel.ingestLocalCommit('Local retry guard updated after TODO review', hashId(new Date().toISOString()), 'local/hackathon');
    await axiomKernel.simulateRemotePoll();
    sidebar.refresh();
    vscode.window.showInformationMessage('AXIOM simulated local commit sync and Azure DevOps polling.');
  };

  const sidebar = new AxiomSidebarProvider(context.extensionUri, async (command) => {
    switch (command) {
      case 'axiom.initialize':
        await initialize();
        break;
      case 'axiom.context':
        await runTextCommand('context');
        break;
      case 'axiom.caveman':
        await runTextCommand('caveman');
        break;
      case 'axiom.summary':
        await runTextCommand('summary');
        break;
      case 'axiom.risks':
        await runTextCommand('risks');
        break;
      case 'axiom.why':
        await runTextCommand('why');
        break;
      case 'axiom.copyContext':
        await copyContext();
        break;
      case 'axiom.copyCombinedContext':
        await copyCombinedContext();
        break;
      case 'axiom.exportContext':
        await exportContext();
        break;
      case 'axiom.importAIContext':
        await importAIContext();
        break;
      case 'axiom.refreshImportedContext':
        await refreshImportedContext();
        break;
      case 'axiom.compressAIConversations':
        await compressAIConversations();
        break;
      case 'axiom.connectRepository':
        await connectRepository();
        break;
      case 'axiom.simulateActivity':
        await simulateActivity();
        break;
      default:
        break;
    }
  }, (tab, activeFile) => axiomApi.getTabData(tab, activeFile));

  void axiomKernel.bootstrap().then(() => {
    axiomKernel.startPolling();
    sidebar.refresh();
  });

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(AxiomSidebarProvider.viewType, sidebar));
  context.subscriptions.push({ dispose: () => axiomKernel.dispose() });

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const rel = folder ? path.relative(folder, editor.document.fileName) : path.basename(editor.document.fileName);
        sidebar.updateActiveFile(rel);
        void axiomKernel.recordActiveFile(rel).then(() => sidebar.refresh());
      } else {
        sidebar.updateActiveFile('No file selected');
      }
    })
  );

  // Send initial file if available
  setTimeout(() => {
    if (vscode.window.activeTextEditor) {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const rel = folder ? path.relative(folder, vscode.window.activeTextEditor.document.fileName) : path.basename(vscode.window.activeTextEditor.document.fileName);
      sidebar.updateActiveFile(rel);
      void axiomKernel.recordActiveFile(rel).then(() => sidebar.refresh());
    }
  }, 1000);

  context.subscriptions.push(
    vscode.commands.registerCommand('axiom.initialize', initialize),
    vscode.commands.registerCommand('axiom.context', () => runTextCommand('context')),
    vscode.commands.registerCommand('axiom.caveman', () => runTextCommand('caveman')),
    vscode.commands.registerCommand('axiom.summary', () => runTextCommand('summary')),
    vscode.commands.registerCommand('axiom.risks', () => runTextCommand('risks')),
    vscode.commands.registerCommand('axiom.why', () => runTextCommand('why')),
    vscode.commands.registerCommand('axiom.copyContext', copyContext),
    vscode.commands.registerCommand('axiom.copyCombinedContext', copyCombinedContext),
    vscode.commands.registerCommand('axiom.exportContext', exportContext),
    vscode.commands.registerCommand('axiom.importAIContext', importAIContext),
    vscode.commands.registerCommand('axiom.refreshImportedContext', refreshImportedContext),
    vscode.commands.registerCommand('axiom.compressAIConversations', compressAIConversations),
    vscode.commands.registerCommand('axiom.connectRepository', connectRepository),
    vscode.commands.registerCommand('axiom.simulateActivity', simulateActivity),
    vscode.commands.registerCommand('/axiom-context', () => runTextCommand('context')),
    vscode.commands.registerCommand('/axiom-caveman', () => runTextCommand('caveman')),
    vscode.commands.registerCommand('/axiom-summary', () => runTextCommand('summary')),
    vscode.commands.registerCommand('/axiom-risks', () => runTextCommand('risks')),
    vscode.commands.registerCommand('/axiom-why', () => runTextCommand('why')),
  );
}

export function deactivate(): void {}

function normalizeMemory(memory: AxiomMemory): AxiomMemory {
  return {
    ...memory,
    importedAIContext: memory.importedAIContext ?? [],
    historicalAIDecisions: memory.historicalAIDecisions ?? [],
    aiDerivedRisks: memory.aiDerivedRisks ?? [],
    aiReasoningSummaries: memory.aiReasoningSummaries ?? [],
  };
}
