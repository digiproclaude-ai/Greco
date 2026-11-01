import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en";

const SOURCE_DIR = join(__dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function lookup(path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], en);
}

describe("English messages", () => {
  it("define every statically referenced namespace", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(SOURCE_DIR)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g)) {
        const namespace = match[1]!;
        if (lookup(namespace) === undefined) missing.push(`${namespace} (${file})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("have no empty strings", () => {
    const empty: string[] = [];
    const walk = (node: unknown, prefix: string) => {
      if (typeof node === "string") {
        if (node.trim() === "") empty.push(prefix);
      } else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) walk(value, prefix ? `${prefix}.${key}` : key);
      }
    };
    walk(en, "");
    expect(empty).toEqual([]);
  });
});
