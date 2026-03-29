import type { AiWorkbenchStep, ReportData, ReportHistoryItem } from "./types";

/** 与 AppContext 中需持久化的字段保持一致 */
export interface SessionSnapshotInput {
  searchKeyword: string;
  searchFeeds: Array<Record<string, unknown>>;
  searchRecommended: string[];
  reportHistory: ReportHistoryItem[];
  report: ReportData | null;
  reportKeyword: string;
  reportFeeds: Array<Record<string, unknown>>;
  reportMinCount: number;
  reportMaxFeeds: number;
  reportWithIllustrations: boolean;
  aiInput: string;
  aiSelectedPreset: string;
  aiMinCount: number;
  aiAnalyzeMaxFeeds: number;
  aiFeeds: Array<Record<string, unknown>>;
  aiResults: Array<Record<string, unknown>>;
  aiSummary: string;
  aiFilteredByBlock: number | null;
  aiStep: AiWorkbenchStep;
  aiError: string;
}

export const SESSION_SNAPSHOT_VERSION = 1;

const AI_STEPS: AiWorkbenchStep[] = ["idle", "searching", "analyzing", "done"];

function isAiStep(x: unknown): x is AiWorkbenchStep {
  return typeof x === "string" && (AI_STEPS as string[]).includes(x);
}

export function buildSessionSnapshot(s: SessionSnapshotInput): Record<string, unknown> {
  return {
    version: SESSION_SNAPSHOT_VERSION,
    searchKeyword: s.searchKeyword,
    searchFeeds: s.searchFeeds,
    searchRecommended: s.searchRecommended,
    reportHistory: s.reportHistory,
    report: s.report,
    reportKeyword: s.reportKeyword,
    reportFeeds: s.reportFeeds,
    reportMinCount: s.reportMinCount,
    reportMaxFeeds: s.reportMaxFeeds,
    reportWithIllustrations: s.reportWithIllustrations,
    aiInput: s.aiInput,
    aiSelectedPreset: s.aiSelectedPreset,
    aiMinCount: s.aiMinCount,
    aiAnalyzeMaxFeeds: s.aiAnalyzeMaxFeeds,
    aiFeeds: s.aiFeeds,
    aiResults: s.aiResults,
    aiSummary: s.aiSummary,
    aiFilteredByBlock: s.aiFilteredByBlock,
    aiStep: s.aiStep === "searching" || s.aiStep === "analyzing" ? "idle" : s.aiStep,
    aiError: s.aiError,
  };
}

export function applySessionSnapshot(
  raw: unknown
): Partial<SessionSnapshotInput> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ver = Number(o.version);
  if (!Number.isFinite(ver) || ver < 1) return null;

  const out: Partial<SessionSnapshotInput> = {};

  if (typeof o.searchKeyword === "string") out.searchKeyword = o.searchKeyword;
  if (Array.isArray(o.searchFeeds)) out.searchFeeds = o.searchFeeds as Array<Record<string, unknown>>;
  if (Array.isArray(o.searchRecommended))
    out.searchRecommended = o.searchRecommended.filter((x) => typeof x === "string") as string[];

  if (Array.isArray(o.reportHistory)) out.reportHistory = o.reportHistory as ReportHistoryItem[];
  if (o.report === null || (typeof o.report === "object" && o.report !== null))
    out.report = o.report as ReportData | null;
  if (typeof o.reportKeyword === "string") out.reportKeyword = o.reportKeyword;
  if (Array.isArray(o.reportFeeds)) out.reportFeeds = o.reportFeeds as Array<Record<string, unknown>>;

  if (typeof o.reportMinCount === "number" && Number.isFinite(o.reportMinCount))
    out.reportMinCount = Math.min(200, Math.max(5, Math.round(o.reportMinCount)));
  if (typeof o.reportMaxFeeds === "number" && Number.isFinite(o.reportMaxFeeds))
    out.reportMaxFeeds = Math.min(40, Math.max(1, Math.round(o.reportMaxFeeds)));
  if (typeof o.reportWithIllustrations === "boolean")
    out.reportWithIllustrations = o.reportWithIllustrations;

  if (typeof o.aiInput === "string") out.aiInput = o.aiInput;
  if (typeof o.aiSelectedPreset === "string") out.aiSelectedPreset = o.aiSelectedPreset;
  if (typeof o.aiMinCount === "number" && Number.isFinite(o.aiMinCount))
    out.aiMinCount = Math.min(200, Math.max(5, Math.round(o.aiMinCount)));
  if (typeof o.aiAnalyzeMaxFeeds === "number" && Number.isFinite(o.aiAnalyzeMaxFeeds))
    out.aiAnalyzeMaxFeeds = Math.min(50, Math.max(1, Math.round(o.aiAnalyzeMaxFeeds)));

  if (Array.isArray(o.aiFeeds)) out.aiFeeds = o.aiFeeds as Array<Record<string, unknown>>;
  if (Array.isArray(o.aiResults)) out.aiResults = o.aiResults as Array<Record<string, unknown>>;
  if (typeof o.aiSummary === "string") out.aiSummary = o.aiSummary;
  if (o.aiFilteredByBlock === null || typeof o.aiFilteredByBlock === "number")
    out.aiFilteredByBlock = o.aiFilteredByBlock as number | null;
  if (isAiStep(o.aiStep)) {
    out.aiStep = o.aiStep === "searching" || o.aiStep === "analyzing" ? "idle" : o.aiStep;
  }
  if (typeof o.aiError === "string") out.aiError = o.aiError;

  return Object.keys(out).length ? out : null;
}
