import type { TicketMessage, Ticket, Transcript } from "@/db/schema";
import { MessageRow, type ReplyPreview } from "./message-row";

function excerpt(message: TicketMessage): string {
  const text =
    message.content ||
    (message.attachments.length ? "[attachment]" : "") ||
    (message.embeds.length ? "[embed]" : "");
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

/**
 * Full transcript page body: a header summarising the ticket, then the captured
 * conversation rendered Discord-style. Self-contained dark theme so the public
 * page looks right regardless of the visitor's theme.
 */
export function TranscriptView({
  transcript,
  ticket,
  messages,
}: {
  transcript: Transcript;
  ticket: Ticket;
  messages: TicketMessage[];
}) {
  // Index by Discord message ID so replies can show a preview of their target.
  const byId = new Map<string, TicketMessage>();
  for (const m of messages) {
    if (m.discordMessageId) byId.set(m.discordMessageId, m);
  }

  const replyPreview = (m: TicketMessage): ReplyPreview => {
    if (!m.replyToId) return null;
    const target = byId.get(m.replyToId);
    if (!target) return null;
    return { authorTag: target.authorTag, excerpt: excerpt(target) };
  };

  return (
    <div className="min-h-screen bg-[#313338] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 rounded-lg border border-white/10 bg-[#2b2d31] p-5">
          <h1 className="text-xl font-semibold">Ticket #{ticket.number}</h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-white/70">
            <div>
              <dt className="inline text-white/40">Opened by </dt>
              <dd className="inline font-mono text-xs">{ticket.openerId}</dd>
            </div>
            <div>
              <dt className="inline text-white/40">Messages </dt>
              <dd className="inline">{transcript.messageCount}</dd>
            </div>
            <div>
              <dt className="inline text-white/40">Opened </dt>
              <dd className="inline">{ticket.openedAt.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="inline text-white/40">Closed </dt>
              <dd className="inline">
                {ticket.closedAt?.toLocaleString() ?? "—"}
              </dd>
            </div>
            {ticket.closedBy && (
              <div>
                <dt className="inline text-white/40">Closed by </dt>
                <dd className="inline font-mono text-xs">{ticket.closedBy}</dd>
              </div>
            )}
            {transcript.closeReason && (
              <div className="col-span-2">
                <dt className="inline text-white/40">Reason </dt>
                <dd className="inline">{transcript.closeReason}</dd>
              </div>
            )}
          </dl>
        </header>

        <main className="flex flex-col">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-white/40">
              No messages were captured for this ticket.
            </p>
          ) : (
            messages.map((m) => (
              <MessageRow key={m.id} message={m} replyTo={replyPreview(m)} />
            ))
          )}
        </main>

        <footer className="mt-8 text-center text-xs text-white/30">
          Transcript generated {transcript.createdAt.toLocaleString()}
        </footer>
      </div>
    </div>
  );
}
