export type ScanVerdict = "clean" | "infected" | "error";

export interface FileScanner {
  readonly id: string;
  /** Scan file bytes; the caller records the verdict on file_objects.scan_status. */
  scan(input: { bytes: Uint8Array; fileName: string }): Promise<{ verdict: ScanVerdict; detail?: string }>;
}
