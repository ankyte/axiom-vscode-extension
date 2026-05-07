# AXIOM

AXIOM stands for **AXIOM eXtracts Intent from Operational Memory**.

Git stores code. AXIOM stores understanding.

AXIOM is local-first context infrastructure for AI-assisted development. It ingests repository behavior and AI-assisted reasoning, compresses intent into operational memory, and exports portable context for any assistant.

## Core MVP

- Repository ingestion
- Hierarchical compression (Caveman, Developer, System)
- Operational memory store (JSON + graph + lightweight vectors)
- Retrieval commands
- Context export
- Engineering auditor

## New Feature: AI Chat Context Adapters

AXIOM can now import local AI conversation context and convert it into operational memory.

Implemented:

- Adapter architecture under `src/adapters/`
- Full `CopilotAdapter` (local workspaceStorage scan, resilient JSON/JSONL parsing)
- `WindsurfAdapter` scaffold
- `MarkdownAdapter` scaffold
- Intent extraction service (`WHAT`, `WHY`, `IMPACT`)
- Merge into AXIOM summaries, graph, decisions, and risks
- Sidebar sections for imported AI reasoning
- Combined context export for external assistants

Privacy behavior:

- Local-first only
- Explicit command-triggered import
- No telemetry
- No cloud sync
- No conversation upload

## Commands

- `AXIOM: Initialize Repository`
- `/axiom-context`
- `/axiom-caveman`
- `/axiom-summary`
- `/axiom-risks`
- `/axiom-why`
- `AXIOM: Copy AXIOM Context`
- `AXIOM: Copy Combined Operational Context`
- `AXIOM: Export Context`
- `AXIOM: Import AI Context`
- `AXIOM: Refresh Imported Context`
- `AXIOM: Compress AI Conversations`

## Sidebar Sections

- Project Overview
- Caveman Summary
- Key Decisions
- Operational Risks
- Recent Changes
- Context Graph
- Imported AI Context
- Historical AI Decisions
- AI-Derived Operational Risks
- AI Reasoning Summaries

## Setup

1. Install dependencies:

```bash
npm install
```

2. Compile:

```bash
npm run compile
```

3. Press `F5` in VS Code to run Extension Development Host.

4. In a target repository:

- Run `AXIOM: Initialize Repository`
- Run `AXIOM: Import AI Context`
- Run `AXIOM: Copy Combined Operational Context`

## Copilot Source Discovery

AXIOM scans default VS Code workspace storage locations:

- Windows: `%APPDATA%/Code/User/workspaceStorage/`
- macOS: `~/Library/Application Support/Code/User/workspaceStorage/`
- Linux: `~/.config/Code/User/workspaceStorage/`

Then it looks for `chatSessions` folders and parses `.json` / `.jsonl` session files.

## Mocked Sample Data

- Mock PR summaries: `src/mock-data/pr-summaries.json`
- Mock chat sessions: `src/mock-data/copilot-sessions/sample-session.jsonl`

## Architecture Diagram

See [docs/architecture.md](docs/architecture.md).
