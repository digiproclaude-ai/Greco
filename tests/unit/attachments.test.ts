import { describe, expect, it } from "vitest";

import { formatFileSize } from "@/lib/files";
import { extensionOf, sniffMimeType } from "@/server/modules/attachments/sniff";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("sniffMimeType", () => {
  it("detects files from their first bytes", () => {
    expect(sniffMimeType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31), "brief.pdf")).toBe("application/pdf");
    expect(sniffMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "shot.PNG")).toBe("image/png");
    expect(sniffMimeType(bytes(0xff, 0xd8, 0xff, 0xe0), "photo.jpg")).toBe("image/jpeg");
  });

  it("uses the extension only to tell zip-based formats apart", () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0x14);
    expect(sniffMimeType(zip, "plan.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(sniffMimeType(zip, "data.zip")).toBe("application/zip");
    expect(sniffMimeType(zip, "setup.exe")).toBeNull();
  });

  it("refuses a PDF signature under another name", () => {
    expect(sniffMimeType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d), "invoice.html")).toBeNull();
  });

  it("accepts UTF-8 text only with a text extension", () => {
    expect(sniffMimeType(text("name,score\nada,10\n"), "scores.csv")).toBe("text/csv");
    expect(sniffMimeType(text("<script>alert(1)</script>"), "page.html")).toBeNull();
    expect(sniffMimeType(bytes(0x41, 0x00, 0x42), "notes.txt")).toBeNull();
    expect(sniffMimeType(bytes(0xc3, 0x28), "notes.txt")).toBeNull();
  });

  it("reads extensions case-insensitively", () => {
    expect(extensionOf("Report.FINAL.PDF")).toBe("pdf");
    expect(extensionOf("no-extension")).toBe("");
  });
});

describe("formatFileSize", () => {
  it("picks a readable unit", () => {
    expect(formatFileSize(512, "en")).toBe("512 byte");
    expect(formatFileSize(1536, "en")).toBe("1.5 kB");
    expect(formatFileSize(4 * 1024 * 1024, "en")).toBe("4 MB");
  });
});
