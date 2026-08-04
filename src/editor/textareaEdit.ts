/**
 * Applies an Edit to a textarea without breaking the browser's undo history.
 *
 * Assigning to `textarea.value` clears the native undo stack, so Cmd-Z after an
 * auto-inserted bracket would throw away everything the player had typed. The
 * only way to edit a textarea and keep that history is to make the change as if
 * the user had: select the range, then let the browser perform the insertion.
 * `document.execCommand` is deprecated but remains the sole route to it, and it
 * also fires `input` on its own, so the recompile is triggered normally.
 */
import type { Edit } from './autoPairs.js';

export function applyEdit(input: HTMLTextAreaElement, edit: Edit): void {
  input.focus();
  input.setSelectionRange(edit.from, edit.to);

  let handled = false;
  try {
    handled = edit.text
      ? document.execCommand('insertText', false, edit.text)
      : // An empty insertion is a no-op, so deletions go through `delete`.
        edit.from !== edit.to && document.execCommand('delete');
  } catch {
    handled = false;
  }

  if (!handled) {
    // No undo history, but the edit still lands and the game still reacts.
    const { value } = input;
    input.value = value.slice(0, edit.from) + edit.text + value.slice(edit.to);
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  input.setSelectionRange(edit.selectFrom, edit.selectTo);
}
