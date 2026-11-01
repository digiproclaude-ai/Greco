import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "supabase/**", "docs/**"]),

  // The secret (service-role) key lives in src/server/privileged. Only that folder and
  // API route handlers (webhooks, jobs) may import from it. See SECURITY.md §4.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/privileged/**", "src/app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/privileged", "@/server/privileged/**"],
              message:
                "Privileged code (secret key) may only be imported from src/server/privileged or src/app/api.",
            },
          ],
        },
      ],
    },
  },

  // Vendor SDKs stay behind adapters (ARCHITECTURE.md §3, docs/AI_DISCOVERY.md §5).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/adapters/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@anthropic-ai/*", "stripe", "@stripe/*", "resend", "postmark"],
              message: "Vendor SDKs may only be imported inside src/server/adapters.",
            },
          ],
        },
      ],
    },
  },

  // No hardcoded user-facing text in JSX: use next-intl messages (CLAUDE.md).
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          allowedStrings: ["·", "—", "–", "/", "|", "•", "©", "*", ":", "(", ")", "&", "+", "…", "★", ".", "Greco"],
          ignoreProps: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
