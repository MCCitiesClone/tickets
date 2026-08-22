import { cn } from "@/lib/utils";

/**
 * Insert `text` at the caret of a controlled input/textarea. Uses the native
 * value setter + a dispatched `input` event so React's `onChange` fires and the
 * component's state updates — this lets token buttons write into any field
 * without each field wiring up its own insert handler.
 */
export function insertAtCaret(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
) {
  replaceRange(
    el,
    el.selectionStart ?? el.value.length,
    el.selectionEnd ?? el.value.length,
    text,
  );
}

/**
 * Swap `[start, end)` of a controlled input/textarea for `text`, leaving the
 * caret just after it. Same native-setter trick as `insertAtCaret` — it's what
 * lets the `:emoji` autocomplete rewrite a field it doesn't own.
 */
export function replaceRange(
  el: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));

  const caret = start + text.length;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

/**
 * A subtle `used/limit` counter for a field, turning destructive when the value
 * reaches or exceeds the Discord character limit.
 */
export function CharCount({ value, max }: { value: string; max: number }) {
  const used = value.length;
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] tabular-nums text-muted-foreground",
        used >= max && "text-destructive",
      )}
    >
      {used}/{max}
    </span>
  );
}
