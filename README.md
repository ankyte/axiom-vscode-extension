# AXIOM

AXIOM stands for **AXIOM eXtracts Intent from Operational Memory**.

Git stores code. AXIOM stores understanding.

AXIOM is context infrastructure for AI-assisted development. It ingests repository history, compresses engineering intent into high-signal summaries, and exports portable context you can paste into Copilot, Claude, ChatGPT, Windsurf, or any assistant.

## MVP Features

1. Repository ingestion (`AXIOM: Initialize Repository`)
2. Hierarchical context compression (Caveman Engine)
3. Operational memory store (local JSON + graph + lightweight vectors)
4. Context retrieval (`/axiom-context`, `/axiom-caveman`, `/axiom-summary`, `/axiom-risks`, `/axiom-why`)
5. AI context export (`Copy AXIOM Context`, `Export Context`)
6. Monochrome sidebar with operational sections
7. AI engineering auditor heuristics

## Commands

- `AXIOM: Initialize Repository`
- `/axiom-context`
- `/axiom-caveman`
- `/axiom-summary`
- `/axiom-risks`
- `/axiom-why`
- `AXIOM: Copy AXIOM Context`
- `AXIOM: Export Context`

## How It Works

### 1) Ingestion

- Scans important repository files
- Reads recent git commits
- Loads mock PR summaries from `.axiom/pr-summaries.json` or bundled sample data
- Builds initial architecture and risk signals

### 2) Caveman Engine Compression

Creates three levels:

- Caveman Summary
- Developer Summary
- System Summary

Pipeline:

- summarize files
- summarize commits
- summarize services/modules
- recursively compress for repository-level understanding

### 3) Operational Memory

Persisted in VS Code global storage as local JSON.

Contains:

- architecture snapshot
- file insights
- commit insights
- PR insights
- compressed summaries
- graph nodes and edges (`affects`, `introduced_by`, `related_to`)
- risk and auditor findings

### 4) Retrieval + Export

Retrieval queries are vector-matched against compressed summaries (not raw code). Export composes a compact high-signal prompt pack for external AI tools.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Compile extension:

```bash
npm run compile
```

3. Open this project in VS Code and press `F5` to launch Extension Development Host.

4. In target repository:

- Run `AXIOM: Initialize Repository`
- Run `/axiom-context`
- Use sidebar buttons for copy/export

## OpenAI API (Optional)

AXIOM works without API access using deterministic local compression. To improve summaries, set:

```bash
export OPENAI_API_KEY=your_key_here
```

When key is present, AXIOM attempts concise summary calls through OpenAI Responses API.

## Demo Flow

1. Open unfamiliar repository
2. Run `/axiom-context`
3. Review architecture, decisions, risks, recent changes
4. Click `Copy AXIOM Context`
5. Paste into external AI assistant
6. Show improved reasoning with operational memory

## Architecture Diagram

See [docs/architecture.md](docs/architecture.md).
