export type AiWorkbenchStep = "idle" | "searching" | "analyzing" | "done";

export interface ReportVisuals {
  primary_image_url?: string;
  more_image_urls?: string[];
  caption?: string;
  image_prompt_hint?: string;
}

export interface ReportData {
  title: string;
  overview: string;
  top_feeds: Array<Record<string, unknown>>;
  analysis: string;
  recommendations: string[];
  filtered_by_block_words?: number;
  report_visuals?: ReportVisuals | null;
}

export interface ReportHistoryItem {
  keyword: string;
  report: ReportData;
  feeds: Array<Record<string, unknown>>;
  date: string;
}
