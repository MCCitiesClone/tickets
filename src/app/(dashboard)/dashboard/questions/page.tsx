import { ListChecks } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { listFormQuestions } from "@/lib/queries/form-questions";
import { listGuildPanels } from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { QuestionLibrary } from "./question-library";

export default async function QuestionsPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const [questions, panels] = active
    ? await Promise.all([listFormQuestions(active.id), listGuildPanels(active.id)])
    : [[], []];

  // How many panels use each question, so deleting one isn't a blind action.
  const usage = new Map<string, string[]>();
  for (const panel of panels) {
    for (const id of panel.sharedQuestionIds) {
      usage.set(id, [...(usage.get(id) ?? []), panel.title]);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Shared questions"
        description={
          active
            ? `Questions you can reuse across ${active.name}'s panels.`
            : "Questions you can reuse across panels."
        }
      />

      {!active ? (
        <EmptyState
          icon={<ListChecks className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      ) : (
        <QuestionLibrary
          guildId={active.id}
          initial={questions}
          usage={Object.fromEntries(usage)}
        />
      )}
    </div>
  );
}
