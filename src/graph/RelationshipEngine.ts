import { MemoryRecord, RelatedEntity } from '../models/memory';
import { RepositoryConnection } from '../models/signals';
import { hashId } from '../utils';

export interface MemoryGraphNode {
  id: string;
  kind: 'repo' | 'file' | 'incident' | 'memory' | 'dependency';
  label: string;
}

export interface MemoryGraphEdge {
  from: string;
  to: string;
  relation: string;
  confidence: number;
}

export interface MemoryGraph {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
}

export class RelationshipEngine {
  public build(memories: MemoryRecord[], connections: RepositoryConnection[]): MemoryGraph {
    const nodes = new Map<string, MemoryGraphNode>();
    const edges = new Map<string, MemoryGraphEdge>();
    const addNode = (node: MemoryGraphNode): void => {
      nodes.set(node.id, node);
    };
    const addEdge = (edge: MemoryGraphEdge): void => {
      edges.set(`${edge.from}:${edge.to}:${edge.relation}`, edge);
    };

    for (const memory of memories) {
      addNode({ id: `repo:${memory.repo}`, kind: 'repo', label: memory.repo });
      addNode({ id: `memory:${memory.id}`, kind: 'memory', label: memory.summary });
      addEdge({ from: `repo:${memory.repo}`, to: `memory:${memory.id}`, relation: 'owns_memory', confidence: memory.confidence });
      if (memory.file) {
        addNode({ id: `file:${memory.file}`, kind: 'file', label: memory.file });
        addEdge({ from: `memory:${memory.id}`, to: `file:${memory.file}`, relation: 'touches_file', confidence: memory.confidence });
      }
      for (const entity of memory.relatedEntities) {
        this.addEntity(addNode, entity);
        addEdge({ from: `memory:${memory.id}`, to: `${entity.kind}:${entity.id}`, relation: entity.relation, confidence: memory.confidence });
      }
    }

    for (const connection of connections) {
      addNode({ id: `repo:${connection.fromRepo}`, kind: 'repo', label: connection.fromRepo });
      addNode({ id: `repo:${connection.toRepo}`, kind: 'repo', label: connection.toRepo });
      addEdge({ from: `repo:${connection.fromRepo}`, to: `repo:${connection.toRepo}`, relation: connection.relation, confidence: connection.confidence });
    }

    this.detectSharedPatternEdges(memories, addEdge);
    return { nodes: [...nodes.values()], edges: [...edges.values()] };
  }

  public connectedRepositories(repo: string, connections: RepositoryConnection[], memories: MemoryRecord[]): string[] {
    const fromConnections = connections
      .filter((connection) => connection.fromRepo === repo || connection.toRepo === repo)
      .map((connection) => (connection.fromRepo === repo ? connection.toRepo : connection.fromRepo));
    const fromMemories = memories.flatMap((memory) =>
      memory.repo === repo ? memory.relatedEntities.filter((entity) => entity.kind === 'repo').map((entity) => entity.id) : [],
    );
    return [...new Set([...fromConnections, ...fromMemories])];
  }

  private addEntity(addNode: (node: MemoryGraphNode) => void, entity: RelatedEntity): void {
    if (entity.kind === 'repo') addNode({ id: `repo:${entity.id}`, kind: 'repo', label: entity.label });
    else if (entity.kind === 'file') addNode({ id: `file:${entity.id}`, kind: 'file', label: entity.label });
    else if (entity.kind === 'incident') addNode({ id: `incident:${entity.id}`, kind: 'incident', label: entity.label });
    else if (entity.kind === 'dependency') addNode({ id: `dependency:${entity.id}`, kind: 'dependency', label: entity.label });
  }

  private detectSharedPatternEdges(memories: MemoryRecord[], addEdge: (edge: MemoryGraphEdge) => void): void {
    const retryRepos = new Set(memories.filter((memory) => memory.tags.includes('retry')).map((memory) => memory.repo));
    const asyncRepos = new Set(memories.filter((memory) => memory.tags.includes('async-risk')).map((memory) => memory.repo));
    this.connectRepoSet(retryRepos, 'shared_retry_pattern', addEdge);
    this.connectRepoSet(asyncRepos, 'shared_async_race_pattern', addEdge);
  }

  private connectRepoSet(repos: Set<string>, relation: string, addEdge: (edge: MemoryGraphEdge) => void): void {
    const list = [...repos];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        addEdge({ from: `repo:${list[i]}`, to: `repo:${list[j]}`, relation, confidence: 0.82 });
      }
    }
  }

  public relationshipMemory(repo: string, connection: RepositoryConnection): MemoryRecord {
    return {
      id: hashId(`relationship:${connection.fromRepo}:${connection.toRepo}:${connection.relation}`),
      type: 'RELATIONSHIP',
      repo,
      state: 'CANONICAL',
      summary: `${connection.fromRepo} ${connection.relation.replace(/_/g, ' ')} ${connection.toRepo}: ${connection.reason}`,
      source: { provider: 'relationship-engine', sourceId: `${connection.fromRepo}:${connection.toRepo}`, label: 'Relationship Engine' },
      timestamp: new Date().toISOString(),
      confidence: connection.confidence,
      tags: ['relationship', connection.relation],
      relatedEntities: [
        { kind: 'repo', id: connection.fromRepo, label: connection.fromRepo, relation: 'from_repo' },
        { kind: 'repo', id: connection.toRepo, label: connection.toRepo, relation: 'to_repo' },
      ],
    };
  }
}
