export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function safeExportBasename(taskName: string, fallback: string): string {
  const safe = taskName
    .trim()
    .replace(/[^a-zA-Z0-9-_àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 40);
  return safe || fallback;
}
