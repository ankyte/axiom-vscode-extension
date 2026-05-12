import { MemoryRecord, RiskLevel, RiskReport } from '../models/memory';

export class RiskEngine {
  public score(repo: string, memories: MemoryRecord[], file?: string): RiskReport {
    const scoped = file
      ? memories.filter((memory) => memory.file === file || memory.relatedEntities.some((entity) => entity.kind === 'file' && entity.label === file))
      : memories.filter((memory) => memory.repo === repo);
    const rollbackFrequency = scoped.filter((memory) => memory.tags.includes('rollback') || memory.type === 'REGRESSION').length;
    const incidentLinks = scoped.filter((memory) => memory.tags.includes('incident') || memory.relatedEntities.some((entity) => entity.kind === 'incident')).length;
    const todoDensity = scoped.filter((memory) => memory.tags.includes('unfinished-work')).length;
    const fileChurn = scoped.filter((memory) => memory.type === 'HISTORICAL_CONTEXT' || memory.source.label.toLowerCase().includes('commit')).length;
    const hotfixMentions = scoped.filter((memory) => memory.tags.includes('hotfix')).length;
    const rawScore = rollbackFrequency * 3 + incidentLinks * 2 + todoDensity + fileChurn * 0.5 + hotfixMentions * 2;
    const score: RiskLevel = rawScore >= 8 ? 'HIGH' : rawScore >= 4 ? 'MEDIUM' : 'LOW';
    const reasons = [
      rollbackFrequency ? `${rollbackFrequency} rollback/regression signals` : '',
      incidentLinks ? `${incidentLinks} incident-linked memories` : '',
      todoDensity ? `${todoDensity} TODO/FIXME knowledge markers` : '',
      hotfixMentions ? `${hotfixMentions} hotfix mentions` : '',
      fileChurn ? `${fileChurn} churn/history signals` : '',
    ].filter(Boolean);
    return {
      repo,
      file,
      score,
      reasons: reasons.length ? reasons : ['No high-risk organizational memory found yet'],
      trace: scoped.slice(0, 6).map((memory) => memory.source),
      factors: { rollbackFrequency, incidentLinks, todoDensity, fileChurn, hotfixMentions },
    };
  }
}
