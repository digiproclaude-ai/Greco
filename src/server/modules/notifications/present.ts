/**
 * How a notification reads and where it leads. Shared by the notifications page and the email
 * job, so both say the same thing. Params come from database functions, never from user input
 * other than titles and names, which are rendered as plain text.
 */

export type NotificationLike = {
  type_key: string;
  entity_type: string;
  entity_id: string | null;
  params: unknown;
  count: number;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

const KNOWN_TYPES = new Set([
  "proposal.received",
  "proposal.shortlisted",
  "proposal.declined",
  "proposal.withdrawn",
  "proposal.expired",
  "project.invited",
  "invitation.declined",
  "message.received",
  "messages.unread_digest",
  "moderation.decided",
  "content.removed",
  "saved_search.match",
]);

function text(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value.slice(0, 200) : "";
}

function subject(t: Translate, targetType: string, title: string): string {
  switch (targetType) {
    case "listing":
      return title ? t("subjects.listing", { title }) : t("subjects.listingUntitled");
    case "project":
      return t("subjects.project", { title });
    case "provider":
    case "portfolio_item":
    case "message":
      return t(`subjects.${targetType}`);
    default:
      return t("subjects.other");
  }
}

/** Title (and the moderator's reason, when there is one) in the reader's language. */
export function notificationText(translate: unknown, n: NotificationLike): { title: string; reason: string | null } {
  const t = translate as Translate;
  const params = n.params && typeof n.params === "object" ? (n.params as Record<string, unknown>) : {};
  if (!KNOWN_TYPES.has(n.type_key)) return { title: t("subjects.other"), reason: null };
  const targetType = text(params, "targetType") || n.entity_type;
  const values: Record<string, string | number> = {
    count: n.count,
    projectTitle: text(params, "projectTitle"),
    expertName: text(params, "expertName"),
    senderName: text(params, "senderName"),
    name: text(params, "name"),
    decision: text(params, "decision") || "other",
    subject: subject(t, targetType, text(params, "title")),
  };
  if (n.type_key === "saved_search.match") values.count = Number(params.count ?? n.count) || n.count;
  const reason = text(params, "reason");
  return { title: t(`types.${n.type_key}`, values), reason: reason ? t("reason", { reason }) : null };
}

/** Where the notification leads (a path without the locale prefix). */
export function notificationHref(n: NotificationLike): string {
  const id = n.entity_id;
  switch (n.type_key) {
    case "proposal.received":
    case "proposal.withdrawn":
    case "invitation.declined":
      return id ? `/dashboard/client/projects/${id}` : "/dashboard/client/projects";
    case "proposal.shortlisted":
    case "proposal.declined":
    case "proposal.expired":
      return id ? `/dashboard/expert/proposals/${id}` : "/dashboard/expert/proposals";
    case "project.invited":
      return id ? `/dashboard/expert/projects/${id}` : "/dashboard/expert/projects";
    case "message.received":
    case "messages.unread_digest":
      return id && n.entity_type === "conversation" ? `/dashboard/messages/${id}` : "/dashboard/messages";
    case "moderation.decided":
      if (n.entity_type === "listing" && id) return `/dashboard/expert/services/${id}`;
      if (n.entity_type === "portfolio_item" && id) return `/dashboard/expert/portfolio/${id}`;
      return "/dashboard/expert/profile";
    case "content.removed":
      if (n.entity_type === "project" && id) return `/dashboard/client/projects/${id}`;
      if (n.entity_type === "conversation" && id) return `/dashboard/messages/${id}`;
      return "/dashboard/notifications";
    case "saved_search.match":
      return "/dashboard/saved#searches";
    default:
      return "/dashboard/notifications";
  }
}
