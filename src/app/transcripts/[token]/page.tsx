import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TranscriptView } from "@/components/transcript/transcript-view";
import { getTranscriptByToken } from "@/lib/queries/tickets";

export const metadata: Metadata = {
  title: "Ticket transcript",
  robots: { index: false, follow: false },
};

/**
 * Public, token-gated transcript viewer. The unguessable token in the URL is
 * the access control — anyone with the link (e.g. staff without dashboard
 * access) can view it, matching how the link is shared in Discord.
 */
export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getTranscriptByToken(token);
  if (!data) notFound();

  return (
    <TranscriptView
      transcript={data.transcript}
      ticket={data.ticket}
      messages={data.messages}
    />
  );
}
