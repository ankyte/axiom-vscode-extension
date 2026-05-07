# AXIOM MVP Architecture

```mermaid
flowchart TD
  A[Initialize Repository Command] --> B[Repository Ingestion]
  B --> B1[File Scanner]
  B --> B2[Git Commit Parser]
  B --> B3[Mock PR Loader]
  B --> C[Caveman Engine]

  C --> C1[Caveman Summaries]
  C --> C2[Developer Summaries]
  C --> C3[System Summaries]

  C --> D[Operational Memory Store]
  D --> D1[Local JSON Persistence]
  D --> D2[Vector Index]
  D --> D3[Graph Nodes and Edges]

  D --> E[Retrieval Engine]
  E --> E1[/axiom-context]
  E --> E2[/axiom-caveman]
  E --> E3[/axiom-summary]
  E --> E4[/axiom-risks]
  E --> E5[/axiom-why]

  D --> F[Engineering Auditor]
  F --> F1[Contradiction Heuristics]
  F --> F2[Safeguard Removal Alerts]

  E --> G[Context Export]
  G --> G1[Copy AXIOM Context]
  G --> G2[Export Context]

  D --> H[Sidebar UI]
  H --> H1[Project Overview]
  H --> H2[Caveman Summary]
  H --> H3[Decisions and Risks]
  H --> H4[Recent Changes and Graph]
```
