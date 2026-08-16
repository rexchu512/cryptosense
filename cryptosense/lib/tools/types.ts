export type ToolResult<T> = {
  data: T | null; source: string; timestamp: string; error?: string;
  /** 讓畫面分辨失敗的種類。`unlisted`＝這個標的本來就沒有資料（不是故障），
   *  `unavailable`＝上游暫時掛掉。少了它，兩種情況都只能顯示「暫無資料」。 */
  code?: "unlisted" | "unavailable";
};
