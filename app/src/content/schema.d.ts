declare module "*.mjs" {
  export function imageCaption(resource: {
    context: { identity: string };
  }): string;
  export function selectRows(
    rows: (string | number | boolean | null)[][],
    options?: {
      column?: number;
      value?: string;
      from?: string;
      to?: string;
      x?: number;
    },
  ): (string | number | boolean | null)[][];
  export function thresholdMetrics(
    rows: (string | number | boolean | null)[][],
    threshold: number,
  ): {
    tn: number;
    fp: number;
    fn: number;
    tp: number;
    precision: number | null;
    recall: number | null;
    accuracy: number | null;
  };
  export const catalogSchema: {
    parse(value: unknown): unknown;
    safeParse(
      value: unknown,
    ): { success: true; data: unknown } | { success: false; error: unknown };
  };
  export const detailSchema: {
    parse(value: unknown): unknown;
    safeParse(
      value: unknown,
    ): { success: true; data: unknown } | { success: false; error: unknown };
  };
  export const knowledgeSchema: {
    parse(value: unknown): unknown;
    safeParse(
      value: unknown,
    ): { success: true; data: unknown } | { success: false; error: unknown };
  };
  export const lessonSchema: {
    parse(value: unknown): unknown;
    safeParse(
      value: unknown,
    ): { success: true; data: unknown } | { success: false; error: unknown };
  };
  export const learningIndexSchema: {
    parse(value: unknown): unknown;
    safeParse(
      value: unknown,
    ): { success: true; data: unknown } | { success: false; error: unknown };
  };
  export const resourceSchema: {
    parse(value: unknown): unknown;
    safeParse(
      value: unknown,
    ): { success: true; data: unknown } | { success: false; error: unknown };
  };
}
