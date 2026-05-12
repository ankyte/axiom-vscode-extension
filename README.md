# AXIOM
## Operational Memory for Engineering Organizations

> "Code remembers."

AXIOM is a realtime organizational memory system that continuously captures, compresses, and surfaces engineering context across repositories, teams, pull requests, incidents, and local development workflows.

Instead of relying on documentation that becomes stale, AXIOM passively observes engineering activity and builds a continuously evolving memory layer for both developers and AI systems.

---

# Vision

Modern engineering systems are stateless by design.

Critical context becomes fragmented across:
- Git commits
- Pull requests
- Incident reports
- Architecture docs
- Tribal engineering knowledge
- Slack discussions
- Local developer workflows

As organizations scale:
- onboarding slows down
- regressions repeat
- architectural intent gets lost
- AI tools operate with incomplete context
- operational scars disappear from memory

AXIOM turns engineering systems into something that remembers.

---

# Core Philosophy

## Traditional Systems

Codebases store implementation.
Organizations lose intent.

---

## AXIOM

AXIOM continuously builds:
- historical memory
- architectural memory
- operational memory
- cross-repository relationships
- machine-consumable context

The result is:

- safer AI-assisted engineering
- faster onboarding
- reduced regressions
- preserved organizational knowledge
- realtime engineering awareness

---

# Key Concepts

## Organizational Memory

AXIOM is not a chatbot.

It is an organizational memory layer.

The system continuously observes engineering activity and converts it into structured memory.

Example:

A developer opens:

```python
RetryHandler.py
```

AXIOM surfaces:

- historical outages related to retry logic
- architectural intent
- rollback history
- connected repositories
- compressed AI context packets
- operational warnings

---

## Realtime Passive Ingestion

AXIOM continuously ingests engineering signals without requiring developers to manually document context.

The system evolves automatically as engineering systems evolve.

---

## Engineering Memory States

Not all memory has the same trust level.

AXIOM classifies memory into:

### LOCAL MEMORY
Private or experimental development state.

Examples:
- local commits
- WIP branches
- in-progress refactors

---

### PROVISIONAL MEMORY
Shared but not yet canonical.

Examples:
- active PRs
- ongoing architectural changes
- experimental implementations

---

### CANONICAL MEMORY
Approved organizational knowledge.

Examples:
- merged PRs
- incident reports
- production architecture
- validated operational learnings

---

# High Level Architecture

```text
Signals
   ↓
Normalization
   ↓
Memory Extraction
   ↓
Relationship Engine
   ↓
Compression Engine
   ↓
Memory Graph
   ↓
Retrieval + Context Surfacing
```

---

# System Architecture

## 1. Signal Ingestion Layer

Collects engineering signals from:

### Local Signals
- git commits
- branch changes
- workspace changes
- architecture file updates
- dependency changes
- BreadKit artifacts

### Remote Signals
- PR creation
- PR merges
- PR discussions
- incident links
- pipeline failures
- rollback commits
- work item references

---

## 2. Memory Extraction Engine

Converts raw engineering activity into structured memory.

Example:

Input:

```text
Reverted async retries after duplicate execution bug during OMS outage
```

Extracted memory:

```json
{
  "type": "historical_context",
  "summary": "Async retries reverted after OMS outage",
  "risk": "duplicate execution",
  "confidence": 0.91
}
```

---

## 3. Relationship Engine

Builds semantic relationships across:
- repositories
- services
- incidents
- architectural patterns
- retry strategies
- operational behaviors

This enables:
- cross-repo context
- organizational awareness
- dependency memory
- shared operational learning

---

## 4. Compression Engine

AXIOM includes a semantic compression engine inspired by caveman-style prompting.

The engine:
- removes filler language
- preserves causality
- preserves identifiers
- preserves operational meaning
- reduces AI token usage

Example:

Raw:

```text
The retry logic was rewritten after an outage caused by async execution under vendor throttling.
```

Compressed:

```text
retry rewrite after async outage vendor throttle
```

---

## 5. Retrieval Layer

Retrieves the most relevant memory for:
- current file
- current repository
- connected repositories
- active engineering task
- AI augmentation

Retrieval combines:
- metadata filtering
- semantic similarity
- relationship graph traversal
- confidence scoring

---

# Storage Architecture

## S3 Memory Store

AXIOM stores organizational memory in S3.

Stored artifacts include:
- extracted memories
- compressed context packets
- architectural intent
- incident correlations
- semantic snapshots
- relationship metadata

---

## Vector Database

The vector database stores embeddings for:
- incidents
- rationale
- architectural decisions
- operational learnings
- compressed memory packets

This enables semantic retrieval.

Example:

When a developer opens:

```python
retry.py
```

AXIOM retrieves:
- similar retry incidents
- related rollback patterns
- architectural rationale
- connected systems

---

# Azure DevOps Integration

The environment uses Azure DevOps and Azure CLI due to enterprise restrictions.

AXIOM integrates using:

```bash
az repos pr list
az repos pr show
az repos ref list
```

Combined with:

```bash
git log
git diff
git branch
```

This enables:
- PR ingestion
- merge tracking
- branch awareness
- repository indexing
- operational event extraction

---

# VSCode Extension

The VSCode extension is the primary interaction surface.

The sidebar provides multiple views into organizational memory.

---

# Sidebar Overview

## MEMORY TAB
### "Why does this code exist?"

Surfaces:
- historical context
- architectural intent
- forensic timeline
- connected systems
- rationale reconstruction

Example:

```text
Retry logic rewritten after OMS outage
Async execution reverted in 2024
Vendor throttle workaround active
```

---

## RISKS TAB
### "What can go wrong?"

Surfaces:
- historical regressions
- rollback history
- operational warnings
- architectural drift
- protected engineering knowledge

Example:

```text
EXPECTED:
exponential backoff

OBSERVED:
fixed retries in recent commits
```

---

## GRAPH TAB
### "How does this connect?"

Surfaces:
- repository relationships
- dependency memory
- shared operational signals
- knowledge propagation
- organizational topology

---

## AI TAB
### "Make AI organization-aware"

Surfaces:
- compressed context packets
- confidence scoring
- AI augmentation actions
- memory provenance
- semantic compression metrics

Example:

```text
retry tied vendor throttle
async caused dup execution
preserve debounce guard
```

---

# Connected Repository Model

AXIOM supports cross-repository memory.

Example:

A developer working in:

```text
frontend-ui
```

can connect:

```text
backend-api
pricing-service
oms-gateway
```

This allows:
- cross-system context awareness
- dependency memory
- architecture propagation
- operational linkage

---

# Memory Scopes

AXIOM retrieves memory across multiple scopes.

```text
File
↓
Module
↓
Repository
↓
Cross-Repository
↓
Organization
```

This prevents noisy retrieval while preserving organizational awareness.

---

# Context Update Scenarios

AXIOM updates memory continuously based on engineering events.

---

## Scenario 1 — Local Commit

Developer creates:

```bash
git commit -m "temporary retry bypass for vendor throttle"
```

AXIOM:
- extracts intent
- stores provisional memory
- updates local semantic graph
- syncs compressed context to S3

State:

```text
PROVISIONAL MEMORY
```

---

## Scenario 2 — Branch Creation

Developer creates:

```text
feature/retry-redesign
```

AXIOM:
- detects architectural evolution
- tracks in-progress memory
- surfaces evolving implementation patterns

---

## Scenario 3 — Pull Request Created

PR description:

```text
Introduced async retries to reduce OMS latency.
```

AXIOM:
- extracts rationale
- links affected systems
- builds semantic memory entries
- updates repository relationships

---

## Scenario 4 — Pull Request Discussion

Reviewer comment:

```text
This breaks settlement reconciliation under load.
```

AXIOM stores:
- operational warning
- tribal engineering knowledge
- risk signal

---

## Scenario 5 — Pull Request Merged

Memory transitions:

```text
PROVISIONAL → CANONICAL
```

AXIOM updates:
- organizational memory
- vector embeddings
- knowledge graph
- timeline reconstruction
- AI context packets

---

## Scenario 6 — Rollback

Rollback detected.

AXIOM interprets this as:

```text
System rejected previous evolution
```

This becomes a high-value operational memory signal.

---

## Scenario 7 — Incident Linked

Incident:

```text
OMS-4821
```

AXIOM correlates:
- commits
- PRs
- files
- repositories
- retry patterns

This builds long-term operational memory.

---

## Scenario 8 — Architecture Manifest Changed

BreadKit manifest updated.

AXIOM updates:
- architectural intent
- expected system behavior
- drift detection baseline

---

# Drift Detection

One of AXIOM's most important capabilities.

AXIOM continuously compares:

```text
Declared Architecture
vs
Observed Reality
```

Example:

Declared:

```yaml
retry_strategy: exponential
```

Observed:

```python
for i in range(3):
```

AXIOM surfaces:

```text
EXPECTED:
exponential backoff

OBSERVED:
fixed retries
```

---

# Confidence Scoring

Every memory item includes confidence levels.

Examples:

| Source | Confidence |
|---|---|
| Merged PR discussion | High |
| Incident report | High |
| BreadKit manifest | High |
| Local commit | Medium |
| Code comment | Medium |
| Inferred relationship | Low |

This prevents hallucinated organizational memory.

---

# Example End-to-End Flow

## Developer opens:

```python
RetryHandler.py
```

AXIOM retrieves:

- historical outages
- rollback history
- retry architecture intent
- connected backend systems
- related incidents
- compressed AI context

The developer asks Copilot to refactor.

Without AXIOM:
- generic AI response

With AXIOM:
- organization-aware response
- preserves historical safeguards
- avoids known regressions

---

# Business Impact

## Faster Onboarding

New engineers inherit operational memory instantly.

---

## Reduced Regressions

Historical failures remain visible.

---

## Lower AI Token Costs

Semantic compression reduces noisy context.

---

## Persistent Organizational Knowledge

Engineering intent survives employee turnover.

---

## Safer AI-Assisted Engineering

AI systems operate with historical and operational awareness.

---

# What AXIOM Is NOT

AXIOM is NOT:
- a chatbot
- a documentation tool
- a generic RAG system
- a Copilot replacement
- a static knowledge base

AXIOM is:

```text
Realtime organizational memory infrastructure.
```

---

# Future Possibilities

Potential future capabilities:

- Slack ingestion
- incident platform integrations
- architecture evolution analytics
- organizational drift analysis
- AI-safe deployment validation
- engineering cognition timelines
- autonomous memory maintenance
- system evolution forecasting

---

# Final Statement

AXIOM transforms engineering systems into something that remembers continuously, collaboratively, and semantically.

It creates a living memory layer for organizations, enabling humans and AI systems to operate with accumulated engineering experience instead of isolated context.

```text
Code remembers.
```
