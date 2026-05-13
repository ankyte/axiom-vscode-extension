const vscode = acquireVsCodeApi();

let currentFile = "No file selected";
let currentTab = "memory";
const tabData = {
  memory: null,
  risks: null,
  graph: null,
  ai: null
};

const tabs = document.querySelectorAll(".tab");
const contentAreas = {
  memory: document.getElementById("content-memory"),
  risks: document.getElementById("content-risks"),
  graph: document.getElementById("content-graph"),
  ai: document.getElementById("content-ai")
};

function init() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchTab(tab.dataset.target);
    });
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "activeFileChanged") {
      currentFile = message.filename || "No file selected";
      requestTabData(currentTab);
      renderAll();
    }
    if (message.type === "refresh") {
      requestAllData();
    }
    if (message.type === "tabData") {
      tabData[message.tab] = message.data;
      renderAll();
    }
  });

  requestAllData();
  renderAll();
}

function switchTab(targetId) {
  currentTab = targetId || "memory";
  tabs.forEach((tab) => tab.classList.remove("active"));
  document.querySelector(`.tab[data-target="${currentTab}"]`)?.classList.add("active");
  Object.values(contentAreas).forEach((content) => content.classList.remove("active"));
  contentAreas[currentTab].classList.add("active");
  requestTabData(currentTab);
}

function requestAllData() {
  ["memory", "risks", "graph", "ai"].forEach(requestTabData);
}

function requestTabData(tab) {
  vscode.postMessage({ type: "getTabData", tab, activeFile: currentFile });
}

function escapeHtml(unsafe) {
  return (unsafe || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderAll() {
  renderMemory();
  renderRisks();
  renderGraph();
  renderAI();
}

function loading(tab) {
  return `
    <div class="file-indicator">${escapeHtml(currentFile)}</div>
    <div class="card">Building AXIOM memory pipeline...</div>
  `;
}

function list(items) {
  const safeItems = (items || []).length ? items : ["No matching organizational memory found yet."];
  return `<ul class="list">${safeItems.map((item) => `<li class="list-item">${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function pills(items) {
  const safeItems = (items || []).length ? items : ["unconnected"];
  return `<div class="pill-container">${safeItems.map((item) => `<div class="pill">${escapeHtml(item)}</div>`).join("")}</div>`;
}

function graphTree(nodes, edges) {
  const safeNodes = nodes || [];
  if (!safeNodes.length) {
    return `<div class="graph-empty">No graph nodes available yet.</div>`;
  }

  const byId = new Map(safeNodes.map((node) => [node.id, node]));
  const root = safeNodes.find((node) => node.kind === "repo") || safeNodes[0];
  const adjacency = new Map();
  (edges || []).forEach((edge) => {
    if (!byId.has(edge.from) || !byId.has(edge.to)) return;
    const list = adjacency.get(edge.from) || [];
    list.push(edge);
    adjacency.set(edge.from, list);
  });

  const seen = new Set();
  const rows = [];

  function relationText(relation) {
    const labels = {
      owns_memory: "has memory",
      touches_file: "touches file",
      linked_incident: "linked incident",
      linked_pr: "linked PR",
      linked_commit: "linked commit",
      to_repo: "connects to repo",
      from_repo: "from repo",
      depends_on: "depends on",
      consumes_from: "consumes from",
      publishes_to: "publishes to",
      shared_incident: "shared incident",
      shared_pattern: "shared pattern",
      shared_retry_pattern: "shared retry pattern",
      shared_async_race_pattern: "shared async race pattern"
    };
    return labels[relation] || (relation || "related to").replace(/_/g, " ");
  }

  function kindLabel(kind) {
    const labels = {
      repo: "Repo",
      file: "File",
      incident: "Incident",
      memory: "Memory",
      dependency: "Dependency"
    };
    return labels[kind] || kind;
  }

  function compactLabel(label, kind) {
    const max = kind === "memory" ? 92 : 46;
    if (!label) return "unknown";
    return label.length > max ? `${label.slice(0, max - 1)}…` : label;
  }

  function row(node, depth, relation) {
    const branch = depth === 0 ? "" : "└─";
    const edge = relation ? `<span class="graph-edge-label">${escapeHtml(relationText(relation))}</span><span class="graph-arrow">→</span>` : "";
    return `
      <div class="graph-tree-row graph-depth-${Math.min(depth, 3)}">
        <span class="graph-branch">${branch}</span>
        ${edge}
        <span class="graph-kind-tag graph-kind-${escapeHtml(node.kind)}">${escapeHtml(kindLabel(node.kind))}</span>
        <span class="graph-label" title="${escapeHtml(node.label)}">${escapeHtml(compactLabel(node.label, node.kind))}</span>
      </div>
    `;
  }

  function walk(nodeId, depth, relation) {
    if (seen.has(nodeId) || depth > 3 || rows.length > 22) return;
    seen.add(nodeId);
    const node = byId.get(nodeId);
    if (!node) return;
    rows.push(row(node, depth, relation));
    const children = (adjacency.get(nodeId) || [])
      .map((edge) => ({ edge, node: byId.get(edge.to) }))
      .filter((item) => item.node && !seen.has(item.node.id))
      .slice(0, 5);
    children.forEach((item) => {
      walk(item.node.id, depth + 1, item.edge.relation);
    });
  }

  walk(root.id, 0);
  safeNodes
    .filter((node) => !seen.has(node.id) && node.kind === "repo")
    .slice(0, 5)
    .forEach((node) => walk(node.id, 0));

  return `
    <div class="graph-viz">
      <div class="graph-guide">Read as: relationship → target node</div>
      ${rows.join("")}
    </div>
  `;
}

function renderMemory() {
  const container = contentAreas.memory;
  const d = tabData.memory;
  if (!d) {
    container.innerHTML = loading("memory");
    return;
  }

  container.innerHTML = `
    <div class="file-indicator">${escapeHtml(d.activeFile)}</div>
    <div class="section">
      <div class="section-title">Live Ingestion</div>
      ${pills(d.status)}
    </div>
    <div class="section">
      <div class="section-title">Historical Context</div>
      <div class="card">${list(d.historical)}</div>
    </div>
    <div class="section">
      <div class="section-title">Architectural Intent</div>
      <div class="card">${list(d.intent)}</div>
    </div>
    <div class="section">
      <div class="section-title">Forensic Timeline</div>
      <div class="timeline">
        ${(d.timeline || []).map((item) => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-date">${escapeHtml(item.date)}</div>
            <div class="timeline-content">${escapeHtml(item.event)} - <span style="color: var(--axiom-muted)">${escapeHtml(item.desc)}</span></div>
          </div>
        `).join("") || `<div class="card">No timeline events yet.</div>`}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Related Systems</div>
      ${pills(d.related)}
    </div>
    <div class="section">
      <div class="section-title">Why Retrieved</div>
      <div class="mono-block muted">${escapeHtml((d.retrievalReasons || []).join("\n"))}</div>
    </div>
  `;
}

function renderRisks() {
  const container = contentAreas.risks;
  const d = tabData.risks;
  if (!d) {
    container.innerHTML = loading("risks");
    return;
  }

  container.innerHTML = `
    <div class="file-indicator">${escapeHtml(d.activeFile)}</div>
    <div class="section" style="display: flex; justify-content: space-between; align-items: center;">
      <div class="section-title" style="margin: 0;">Risk Score</div>
      <div class="badge badge-${escapeHtml(d.score.toLowerCase())}">${escapeHtml(d.score)}</div>
    </div>
    <div class="section">
      <div class="section-title">Regression History</div>
      <div class="card">${list(d.regressions)}</div>
    </div>
    <div class="section">
      <div class="section-title">Drift Detection</div>
      <div class="compare-row">
        <div class="compare-block">
          <div class="compare-label">Expected</div>
          <div class="compare-val expected">${escapeHtml(d.drift?.expected)}</div>
        </div>
        <div class="compare-block">
          <div class="compare-label">Observed</div>
          <div class="compare-val observed">${escapeHtml(d.drift?.observed)}</div>
          <div class="compare-label">${escapeHtml(d.drift?.source || "rule source pending")}</div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Rule Sources</div>
      ${pills(d.ruleSources)}
    </div>
    <div class="section">
      <div class="section-title">Protected Knowledge</div>
      <div class="warning-block">"${escapeHtml(d.protected)}"</div>
    </div>
    <div class="section">
      <div class="section-title">Source Trace</div>
      <div class="provenance">
        ${(d.trace || []).map((item) => `<div class="provenance-item"><span class="provenance-icon">↳</span> ${escapeHtml(item)}</div>`).join("") || "No provenance yet."}
      </div>
    </div>
  `;
}

function renderGraph() {
  const container = contentAreas.graph;
  const d = tabData.graph;
  if (!d) {
    container.innerHTML = loading("graph");
    return;
  }
  const repoNodes = (d.nodes || []).filter((node) => node.kind === "repo").slice(0, 5);

  container.innerHTML = `
    <div class="file-indicator">${escapeHtml(d.activeFile)}</div>
    <div class="section">
      <div class="section-title">Memory Graph</div>
      ${graphTree(d.nodes, d.edges)}
    </div>
    <div class="section">
      <div class="section-title">Shared Context</div>
      <div class="card">${list(d.sharedContext)}</div>
    </div>
    <div class="section">
      <div class="section-title">Connected Repositories</div>
      ${pills(d.connectedRepositories)}
    </div>
    <div class="section">
      <div class="section-title">Memory Signals</div>
      <div class="mono-block muted">${escapeHtml(d.signals)}</div>
    </div>
    <div class="section">
      <div class="section-title">Knowledge Flow</div>
      <div class="mono-block">${escapeHtml(d.flow)}</div>
    </div>
  `;
}

function renderAI() {
  const container = contentAreas.ai;
  const d = tabData.ai;
  if (!d) {
    container.innerHTML = loading("ai");
    return;
  }

  container.innerHTML = `
    <div class="file-indicator">${escapeHtml(d.activeFile)}</div>
    <div class="section" style="display: flex; justify-content: space-between; align-items: center;">
      <div class="section-title" style="margin: 0;">Context Packet</div>
      <div class="badge badge-medium" style="background: var(--axiom-bg-card); color: var(--axiom-text); border: 1px solid var(--axiom-border);">${escapeHtml(d.compression)}</div>
    </div>
    <div class="section">
      <div class="section-title">Compressed Memory</div>
      <div class="mono-block" style="color: var(--axiom-accent);">${escapeHtml(d.compressedMemory)}</div>
    </div>
    <div class="section">
      <div class="section-title">AI Actions</div>
      <div class="button-group">
        <button class="btn" data-command="axiom.copyAIPacket">Inject into Copilot</button>
        <button class="btn" data-command="axiom.exportAIPacket">Export Prompt</button>
        <button class="btn" data-command="axiom.compareAIPacket">Compare Raw vs AXIOM</button>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Context Quality</div>
      <div style="font-size: 11px; font-weight: 700; color: var(--axiom-risk-low); margin-bottom: 8px;">${escapeHtml(d.quality)}</div>
      ${pills(d.sources)}
    </div>
    <div class="section">
      <div class="section-title">Retrieval Explanation</div>
      <div class="mono-block muted">${escapeHtml((d.retrievalReasons || []).join("\n"))}</div>
    </div>
  `;

  container.querySelectorAll("button[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      vscode.postMessage({ command: button.dataset.command });
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
