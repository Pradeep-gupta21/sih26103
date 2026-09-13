/** Downloads rows already on screen as a CSV file. Formatting only; nothing is fetched or recomputed. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const escape = (value: string | number) => { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
  const body = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
