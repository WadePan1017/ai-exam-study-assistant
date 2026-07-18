import type { KnowledgeImportItem } from "@/features/knowledge/knowledge-import-schema";
import { SYLLABUS_MODULES } from "@/features/syllabus/syllabus-catalog";

import type {
  CatalogModule,
  CatalogNode,
  KnowledgeStateInput,
  StudyCatalog,
} from "./learning-content-store";

function makeNode(key: string, title: string): CatalogNode {
  return { key, title, children: [], knowledgePoints: [] };
}

function findOrCreateChild(parent: CatalogNode, title: string) {
  const existing = parent.children.find((child) => child.title === title);

  if (existing) {
    return existing;
  }

  const child = makeNode(`${parent.key}/${title}`, title);
  parent.children.push(child);
  return child;
}

function nodeHasContent(node: CatalogNode): boolean {
  return (
    node.knowledgePoints.length > 0 ||
    node.children.some(nodeHasContent)
  );
}

export function buildStudyCatalog(
  points: readonly KnowledgeImportItem[],
  states: ReadonlyMap<string, KnowledgeStateInput>,
  query = "",
): StudyCatalog {
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const published = points.filter(
    (item) => item.review_status === "published",
  );
  const matched = published.filter((item) => {
    if (!normalizedQuery) {
      return true;
    }

    return [
      item.title,
      item.summary,
      item.content_md,
      ...item.syllabus_path,
    ]
      .join("\n")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedQuery);
  });
  let matchedCount = 0;
  const modules: CatalogModule[] = SYLLABUS_MODULES.map((module) => ({
    ...makeNode(module.externalId, module.title),
    externalId: module.externalId,
    sortOrder: module.sortOrder,
  }));

  for (const item of matched) {
    const catalogModule = modules.find(
      (candidate) => candidate.title === item.syllabus_path[0],
    );

    if (!catalogModule) {
      continue;
    }

    let parent: CatalogNode = catalogModule;
    for (const segment of item.syllabus_path.slice(1)) {
      parent = findOrCreateChild(parent, segment);
    }

    parent.knowledgePoints.push({
      difficulty: item.difficulty,
      externalId: item.external_id,
      importance: item.importance,
      learningStatus:
        states.get(item.external_id)?.status ?? "not_started",
      summary: item.summary,
      title: item.title,
    });
    matchedCount += 1;
  }

  return {
    matchedPublished: matchedCount,
    modules: normalizedQuery ? modules.filter(nodeHasContent) : modules,
    totalPublished: published.length,
  };
}
