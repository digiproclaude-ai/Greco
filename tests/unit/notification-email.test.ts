import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://greco.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key_123456");
});

describe("notification emails", () => {
  it("escape user text and link to the right page", async () => {
    const { renderNotificationEmail } = await import("@/server/modules/notifications/email");
    const email = await renderNotificationEmail({
      type_key: "project.invited",
      entity_type: "project",
      entity_id: "00000000-0000-4000-8000-000000000001",
      params: { projectTitle: '<img src=x onerror="alert(1)">' },
      count: 1,
      name: "Ada & Co",
      locale: "en",
    });
    expect(email.subject).toContain("<img");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(email.html).toContain("Hi Ada &amp; Co,");
    expect(email.html).toContain("https://greco.test/dashboard/expert/projects/00000000-0000-4000-8000-000000000001");
    expect(email.text).toContain("https://greco.test/dashboard/settings/notifications");
  });

  it("render the unread digest", async () => {
    const { renderDigestEmail } = await import("@/server/modules/notifications/email");
    const email = await renderDigestEmail({ name: "Ada", locale: "fr", conversations: 2 });
    expect(email.subject).toBe("You have unread messages on Greco");
    expect(email.text).toContain("You have unread messages in 2 conversations.");
    expect(email.text).toContain("https://greco.test/dashboard/messages");
  });
});
