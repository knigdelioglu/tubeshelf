import type { ChannelInput } from "./types";

export interface CsvImportResult { channels: ChannelInput[]; ignored: number }

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted) quoted = false;
      else if (field === "") quoted = true;
      else field += char;
    } else if (!quoted && char === ",") {
      row.push(field); field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      row.push(field); field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else field += char;
  }
  if (quoted) throw new Error("CSV dosyasında kapanmamış tırnak alanı var.");
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}
export function parseTakeoutCsv(text: string): CsvImportResult {
  const rows = parseCsv(text);
  const headers = rows.shift()?.map((x) => x.trim().toLowerCase().replace(/[\s_-]/g, "")) ?? [];
  const idIndex = headers.indexOf("channelid");
  const titleIndex = headers.findIndex((h) => h === "channeltitle" || h === "channelname");
  if (idIndex < 0 || titleIndex < 0) throw new Error("Google Takeout CSV dosyasında Channel Id ve Channel Title başlıkları bulunamadı.");
  const ids = new Set<string>(), channels: ChannelInput[] = [];
  let ignored = 0;
  for (const row of rows) {
    const id = row[idIndex]?.trim() ?? "", title = row[titleIndex]?.trim() ?? "";
    if (!/^UC[A-Za-z0-9_-]{22}$/.test(id) || !title || ids.has(id)) { ignored++; continue; }
    ids.add(id);
    channels.push({ id, title });
  }
  if (!channels.length) throw new Error("CSV dosyasında geçerli kanal bulunamadı.");
  return { channels, ignored };
}
