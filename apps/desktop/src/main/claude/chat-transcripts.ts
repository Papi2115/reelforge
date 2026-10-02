/** Started chat turns per project (newest last, capped), keyed case-insensitively on Windows. */
import path from 'node:path';

export function projectKey(dir: string): string {
  const resolved = path.resolve(dir);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** Started turns kept per project in the chat transcript. */
export const MAX_TRANSCRIPT_TURNS = 100;

export class ChatTranscripts<Item extends { readonly projectDir: string }> {
  private readonly lists = new Map<string, Item[]>();

  add(item: Item): void {
    const key = projectKey(item.projectDir);
    const list = this.lists.get(key) ?? [];
    list.push(item);
    if (list.length > MAX_TRANSCRIPT_TURNS) list.splice(0, list.length - MAX_TRANSCRIPT_TURNS);
    this.lists.set(key, list);
  }

  remove(item: Item): void {
    const key = projectKey(item.projectDir);
    this.lists.set(
      key,
      (this.lists.get(key) ?? []).filter((entry) => entry !== item),
    );
  }

  of(key: string): readonly Item[] {
    return this.lists.get(key) ?? [];
  }
}
