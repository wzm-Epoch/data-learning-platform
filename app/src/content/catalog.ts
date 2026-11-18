export interface SourceRef {
  path: string;
  sha256: string;
  role: string;
}
export interface Project {
  id: string;
  title: string;
  originalNames: string[];
  categoryId: string;
  summary: string;
  difficulty: string;
  skillTags: string[];
  learning: { readyLessons: number; readySteps: number; plannedSteps: number };
  availability?: {course:string;label:string;result:string;models:string[];gaps:string[]};
  readiness: { source: string; course: string; rerun: string; offline: string };
  detailRef: string;
  searchKeywords: string[];
  prerequisites: string;
  recommendedProjectIds: string[];
  recommendationNote: string;
}
export interface Catalog {
  schemaVersion: "1.1";
  contentVersion: string;
  categories: {
    id: string;
    title: string;
    intro: string;
    objectives: string[];
    projectIds: string[];
  }[];
  stages: { id: string; title: string; goal: string; projectIds: string[] }[];
  projects: Project[];
}
export interface Dataset {
  id: string;
  path: string;
  sha256: string;
  sheet: string | null;
  rows: number;
  columns: number;
  encoding: string | null;
  grain: string;
  origin: string | null;
  license: string | null;
  fields: {
    name: string;
    dtype: string;
    missing: number | null;
    meaning: string | null;
    unit: string | null;
    evidence: string;
  }[];
  teachingMappings: {
    source: string;
    cell: number;
    code: string;
    inputFields: string[];
    outputFields: string[];
    note: string;
  }[];
}
export interface ProjectDetail extends Project {
  schemaVersion: "1.0";
  contentVersion: string;
  methods: string;
  sourceRefs: SourceRef[];
  limitations: string[];
  learningObjectives: string[];
  lessons: {
    id: string;
    title: string;
    source: string;
    status: "ready" | "planned";
    stepCount: number;
  }[];
  exercise: { text: string; provenance: string; answerStatus: string };
  datasets: Dataset[];
  scopeNotes: string[];
  originalWorkflow: string | null;
  savedResult: string | null;
  sourceEvidence: string[];
}
export interface Knowledge {
  schemaVersion: "1.0";
  tags: {
    id: string;
    title: string;
    evidenceNote: string;
    usages: {
      projectId: string;
      auditEvidence: string;
      codeRefs: { source: string; cell: number; snippet: string }[];
    }[];
  }[];
  branches: { id: string; title: string; requires: string[] }[];
}
export function searchProjects(projects: Project[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return projects.filter((p) => {
    const text = [
      p.id,
      p.title,
      ...p.originalNames,
      ...p.skillTags,
      ...p.searchKeywords,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((t) => text.includes(t));
  });
}
export interface Filters {
  q?: string;
  category?: string;
  difficulty?: string;
  tag?: string;
  readiness?: string;
  sort?: string;
}
export function filterProjects(c: Catalog, f: Filters) {
  const route = c.stages.flatMap((s) => s.projectIds);
  const categories = c.categories.map((x) => x.id);
  return searchProjects(c.projects, f.q || "")
    .filter(
      (p) =>
        (!f.category || p.categoryId === f.category) &&
        (!f.difficulty || p.difficulty === f.difficulty) &&
        (!f.tag || p.skillTags.includes(f.tag)) &&
        (!f.readiness ||
          (f.readiness === "representative-ready"
            ? p.readiness.course === "representative-ready"
            : f.readiness === "not-adapted"
              ? p.readiness.course === "not-adapted"
              : f.readiness === "not-run"
                ? p.readiness.rerun === "not-run"
                : p.readiness.source === f.readiness)),
    )
    .sort((a, b) =>
      f.sort === "category"
        ? categories.indexOf(a.categoryId) - categories.indexOf(b.categoryId) ||
          route.indexOf(a.id) - route.indexOf(b.id)
        : route.indexOf(a.id) - route.indexOf(b.id),
    );
}
async function readJson(path: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}content/${path}`);
  if (!response.ok)
    throw new Error(`本地资源加载失败（${response.status}）：${path}`);
  return response.json() as Promise<unknown>;
}
export async function loadCatalog(): Promise<Catalog> {
  const { catalogSchema } = await import("../../../schemas/catalog.mjs");
  return catalogSchema.parse(await readJson("catalog.json")) as Catalog;
}
export async function loadProject(id: string): Promise<ProjectDetail> {
  if (!/^P\d{2}$/.test(id)) throw new Error("项目ID格式不正确");
  const { detailSchema } = await import("../../../schemas/catalog.mjs");
  const detail = detailSchema.parse(
    await readJson(`projects/${id}/project.json`),
  ) as ProjectDetail;
  if (detail.id !== id) throw new Error("项目包ID与地址不一致");
  return detail;
}
export async function loadKnowledge(): Promise<Knowledge> {
  const { knowledgeSchema } = await import("../../../schemas/catalog.mjs");
  return knowledgeSchema.parse(
    await readJson("knowledge-index.json"),
  ) as Knowledge;
}
