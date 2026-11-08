import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en";
import { notificationHref, notificationText } from "@/server/modules/notifications/present";

const t = createTranslator({ locale: "en", messages: en, namespace: "notifications" });
const n = (type_key: string, entity_type: string, params: Record<string, unknown> = {}, count = 1) => ({
  type_key,
  entity_type,
  entity_id: "00000000-0000-4000-8000-000000000001",
  params,
  count,
});

describe("notificationText", () => {
  it("counts grouped notifications", () => {
    expect(notificationText(t, n("proposal.received", "project", { projectTitle: "Voice bot" }, 3)).title).toBe(
      "3 new proposals for “Voice bot”",
    );
    expect(notificationText(t, n("message.received", "conversation", { senderName: "Ada" })).title).toBe("New message from Ada");
  });

  it("describes moderation decisions with their subject", () => {
    const approved = notificationText(t, n("moderation.decided", "listing", { decision: "approve", targetType: "listing", title: "Chatbots" }));
    expect(approved.title).toBe("Approved: your service “Chatbots”");
    const removed = notificationText(t, n("content.removed", "conversation", { targetType: "message", reason: "Shared a phone number" }));
    expect(removed.title).toBe("Greco removed one of your messages");
    expect(removed.reason).toBe("Reason: Shared a phone number");
  });

  it("never fails on missing or unknown values", () => {
    expect(notificationText(t, n("proposal.shortlisted", "proposal")).title).toBe("Your proposal for “” was shortlisted");
    expect(notificationText(t, n("something.new", "thing")).title).toBe("your content");
    expect(notificationText(t, n("moderation.decided", "provider", { decision: "weird" })).title).toBe("Update about your expert profile");
  });

  it("uses the match count for saved searches", () => {
    expect(notificationText(t, n("saved_search.match", "saved_search", { name: "Voice", count: 4 })).title).toBe(
      "4 new results for your saved search “Voice”",
    );
  });
});

describe("notificationHref", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  it("leads each type to the right page", () => {
    expect(notificationHref(n("proposal.received", "project"))).toBe(`/dashboard/client/projects/${id}`);
    expect(notificationHref(n("proposal.declined", "proposal"))).toBe(`/dashboard/expert/proposals/${id}`);
    expect(notificationHref(n("project.invited", "project"))).toBe(`/dashboard/expert/projects/${id}`);
    expect(notificationHref(n("message.received", "conversation"))).toBe(`/dashboard/messages/${id}`);
    expect(notificationHref(n("moderation.decided", "listing"))).toBe(`/dashboard/expert/services/${id}`);
    expect(notificationHref(n("moderation.decided", "provider"))).toBe("/dashboard/expert/profile");
    expect(notificationHref(n("saved_search.match", "saved_search"))).toBe("/dashboard/saved#searches");
    expect(notificationHref(n("unknown.type", "x"))).toBe("/dashboard/notifications");
  });
});
