export type Status =
  "not_started" | "in_progress" | "completed" | "review_needed";
export interface Location {
  projectId: string;
  lessonId: string;
  stepId: string;
}
export interface Step extends Location {
  key: string;
  title: string;
  required: boolean;
  exerciseRequired: boolean;
  revision: string;
}
export interface Manifest {
  schemaVersion: number;
  contentVersion: string;
  supportedContentVersions?: string[];
  steps: Step[];
  projects: {
    id: string;
    title: string;
    prerequisites: string;
    recommendedProjectIds: string[];
  }[];
  deleted: Record<string, string | null>;
}
export interface Row extends Location {
  status: Status;
  selfReview: "none" | "practice" | "explained";
  revision: string;
  updatedAt: string;
}
export interface Data {
  prerequisiteConfirmations: string[];
  schemaVersion: 1;
  contentVersion: string;
  revision: number;
  updatedAt: string;
  stepStates: Record<string, Row>;
  lastLocation: Location | null;
  preferences: { theme: "light" | "dark"; size: "normal" | "large" };
  events: (Location & { action: Status | "self_review"; at: string })[];
  archived: Record<string, Row>;
}
export interface Summary {
  total: number;
  done: number;
  ratio: number;
  status: Status | "unavailable";
}
export interface Overall {
  ratio: number;
  open: number;
  complete: number;
  total: number;
}
export const KEY: string;
export const MAX_BYTES: number;
export function keyOf(r: Location): string;
export function emptyProgress(m: Manifest): Data;
export function parseProgress(raw: string, m: Manifest): Data;
export function migrateProgress(
  d: Data,
  m: Manifest,
): { data: Data; notes: string[] };
export function effectiveStatus(s: Step, r?: Row): Status;
export function projectProgress(m: Manifest, d: Data, id: string): Summary;
export function overallProgress(m: Manifest, d: Data): Overall;
export function mergeProgress(a: Data, b: Data): Data;
export function importPreview(
  raw: string,
  m: Manifest,
  d: Data,
  mode: string,
): {
  data: Data;
  notes: string[];
  changed: number;
  before: Overall;
  after: Overall;
};
export function storageAdapter(
  storage: Pick<Storage, "getItem" | "setItem">,
  m: Manifest,
): {
  read(): { data: Data; notes: string[]; raw: string | null; error?: string };
  save(d: Data): Data;
  unlock(): void;
  raw(): string | null;
};

export function recommendStep(
  m: Manifest,
  d: Data,
): {
  project: Manifest["projects"][number];
  step: Step;
  active: boolean;
} | null;

export function parseManifest(value:unknown):Manifest;
