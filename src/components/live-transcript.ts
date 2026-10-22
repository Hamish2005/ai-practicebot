export type LiveItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ready: boolean;
};

/** Data-channel order determines dialogue order; transcription arrival does not. */
export class LiveTranscript {
  items: LiveItem[] = [];
  add(id: string, role: LiveItem["role"], previous?: string) {
    let item = this.items.find((i) => i.id === id);
    if (!item) {
      item = { id, role, content: "", ready: false };
      const index = previous
        ? this.items.findIndex((i) => i.id === previous)
        : -1;
      if (index >= 0) this.items.splice(index + 1, 0, item);
      else this.items.push(item);
    }
    return item;
  }
  complete(id: string, role: LiveItem["role"], content: string) {
    if (this.items.find((i) => i.id === id)?.ready) return;
    Object.assign(this.add(id, role), { content: content.trim(), ready: true });
  }
  prefix() {
    const firstPending = this.items.findIndex((i) => !i.ready);
    return this.items
      .slice(0, firstPending < 0 ? undefined : firstPending)
      .filter((i) => i.content)
      .map(({ id, role, content }) => ({ id, role, content }));
  }
  pendingUsers() {
    return this.items.filter((i) => i.role === "user" && !i.ready);
  }
}
