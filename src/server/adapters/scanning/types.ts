export type ScanVerdict = "clean" | "infected" | "error";

export interface FileScanner {
  readonly id: string;
  /** Scan a stored object; the caller updates file_objects.scan_status with the verdict. */
  scan(input: { bucket: string; path: string; sha256?: string }): Promise<{ verdict: ScanVerdict; detail?: string }>;
}
