// The two browser file moves the Saves and Settings panels need (DESIGN §14.3): hand the player a file to keep, and read
// the file they chose. Both are thin and report failure instead of throwing, so the panels can say so in words.

/** Starts a download of `text` as `fileName` (a Blob behind a temporary link). False where the browser cannot. */
export function downloadText(fileName: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

/** The text of a chosen file, or null if it cannot be read. */
export async function readFileText(file: Pick<File, 'text'>): Promise<string | null> {
  try {
    return await file.text();
  } catch {
    return null;
  }
}
