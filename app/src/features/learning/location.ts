import type { LearningIndex } from "./content";
export interface ReadingLocation {
  schemaVersion: "1.0";
  contentVersion: string;
  projectId: string;
  lessonId: string;
  stepId: string;
  updatedAt: string;
}
export const locationKey = "da-learning:location:v1";
export function validLocation(
  value: unknown,
  index: LearningIndex,
): value is ReadingLocation {
  if (!value || typeof value !== "object") return false;
  const p = value as ReadingLocation;
  return (
    p.schemaVersion === "1.0" &&
    p.contentVersion === index.contentVersion &&
    typeof p.updatedAt === "string" &&
    !Number.isNaN(Date.parse(p.updatedAt)) &&
    Boolean(
      index.projects
        .find((x) => x.id === p.projectId)
        ?.lessons.find((x) => x.id === p.lessonId && x.status === "ready")
        ?.steps.some((s) => s.id === p.stepId && s.status === "ready"),
    )
  );
}
export function readLocation(
  index: LearningIndex,
  storage: Pick<Storage, "getItem"> = localStorage,
): { location: ReadingLocation | null; error: string } {
  try {
    const raw = storage.getItem(locationKey);
    if (!raw) return { location: null, error: "" };
    const value: unknown = JSON.parse(raw);
    return validLocation(value, index)
      ? { location: value, error: "" }
      : {
          location: null,
          error: "此前阅读位置与当前课程不匹配，请选择步骤重新开始。",
        };
  } catch {
    return {
      location: null,
      error: "无法读取本地阅读位置。请检查浏览器存储设置。",
    };
  }
}
export function writeLocation(
  location: ReadingLocation,
  index: LearningIndex,
  storage: Pick<Storage, "setItem"> = localStorage,
): string {
  if (!validLocation(location, index)) return "无效步骤未写入阅读位置。";
  try {
    storage.setItem(locationKey, JSON.stringify(location));
    return "";
  } catch {
    return "无法保存阅读位置；当前内容仍可阅读，请保留此页地址。";
  }
}
