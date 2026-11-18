export interface StepBrief {
  id: string;
  title: string;
  status: "ready" | "planned";
}
export interface CodeRef {
  path: string;
  notebookSha256: string;
  cell: number;
  code: string;
  codeSha256: string;
}
export interface ReadyStep extends StepBrief {
  status: "ready";
  kind: string;
  knowledgeIds: string[];
  explanation: string[];
  teachingCode: string;
  limitations: string[];
  codeRefs: CodeRef[];
  inputRefs: { path: string; sha256: string }[];
  outputRefs: string[];
  outputTitles?: Record<string, string>;
  exercise: {
    prompt: string;
    hint: string;
    checklist: string[];
    provenance: string;
  };
}
export interface Lesson {
  schemaVersion: "1.0";
  contentVersion: string;
  projectId: string;
  id: string;
  title: string;
  status: "ready" | "planned";
  steps: (StepBrief | ReadyStep)[];
}
export interface LearningIndex {
  schemaVersion: "1.0";
  contentVersion: string;
  projects: {
    id: string;
    lessons: {
      id: string;
      title: string;
      status: "ready" | "planned";
      ref: string;
      steps: StepBrief[];
    }[];
  }[];
}
export interface Resource {
  schemaVersion: "1.0";
  id: string;
  title: string;
  kind: "table" | "text" | "image";
  images?: string[];
  probabilities?: boolean;
  chart?: {
    type: string;
    x: number;
    ys: number[];
    question: string;
    xLabel: string;
    yLabel: string;
    denominator: string;
    range: string;
    filters: string;
    nullPolicy: string;
    interpretation: string;
    filterColumn?: number;
    tree?: Record<string, unknown>;
    fallback?: string;
  };
  columns: string[];
  rows: (string | number | boolean | null)[][];
  text: string | null;
  context: {
    identity: "new-precomputed" | "original-saved" | "teaching-adaptation";
    buildId: string;
    createdAt: string;
    inputs: { path: string; sha256: string }[];
    note: string;
    unit: string;
    sample: string | null;
    modelRerun: boolean;
    modelVersion?: string;
  };
}
async function json(ref: string) {
  if (
    !/^learning\/[a-zA-Z0-9_./-]+\.json$/.test(ref) ||
    ref.split("/").includes("..")
  )
    throw new Error("课程资源地址无效");
  const response = await fetch(`${import.meta.env.BASE_URL}content/${ref}`);
  if (!response.ok) throw new Error(`本地学习资源未找到（${response.status}）`);
  return response.json() as Promise<unknown>;
}
let learningIndexPromise: Promise<LearningIndex> | null = null;
export function loadLearningIndex(): Promise<LearningIndex> {
  if (!learningIndexPromise)
    learningIndexPromise = (async () => {
      const { learningIndexSchema } =
        await import("../../../../schemas/learning.mjs");
      return learningIndexSchema.parse(
        await json("learning/index.json"),
      ) as LearningIndex;
    })().catch((error) => {
      learningIndexPromise = null;
      throw error;
    });
  return learningIndexPromise;
}
export async function loadLesson(ref: string): Promise<Lesson> {
  const { lessonSchema } = await import("../../../../schemas/learning.mjs");
  const result = lessonSchema.safeParse(await json(ref));
  if (!result.success) throw new Error("课节结构或版本不匹配，请恢复本地课程文件或重新构建。");
  return result.data as Lesson;
}
export async function loadResource(ref: string): Promise<Resource> {
  const { resourceSchema } = await import("../../../../schemas/learning.mjs");
  const result = resourceSchema.safeParse(await json(ref));
  if (!result.success) throw new Error("结果资源结构或版本不匹配，请恢复本地课程文件或重新构建。");
  return result.data as Resource;
}
export function stepUrl(projectId: string, lessonId: string, stepId: string) {
  return `/projects/${projectId}/lessons/${lessonId}/steps/${stepId}`;
}
