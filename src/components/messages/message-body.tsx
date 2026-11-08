import { CONTACT_HIDDEN_TOKEN } from "@/server/modules/messaging/schemas";

/** Message text as plain text, with the "contact details hidden" token shown as a label. */
export function MessageBody({ text, hiddenLabel }: { text: string; hiddenLabel: string }) {
  const parts = text.split(CONTACT_HIDDEN_TOKEN);
  return (
    <p className="break-words whitespace-pre-line">
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 ? (
            <span className="mx-0.5 rounded-sm bg-warning/10 px-1 text-sm text-warning italic">{hiddenLabel}</span>
          ) : null}
        </span>
      ))}
    </p>
  );
}
