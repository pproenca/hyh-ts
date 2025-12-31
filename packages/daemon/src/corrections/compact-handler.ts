// packages/daemon/src/corrections/compact-handler.ts
interface Message {
  role: string;
  content: string;
}

interface CompactOptions {
  preserve?: string[];
  summarize?: string[];
  discard?: string[];
  preCompact?: (messages: Message[]) => Promise<{ preserved: string[]; discarded: number }>;
}

export class CompactHandler {
  private readonly options: CompactOptions;

  constructor(options: CompactOptions = {}) {
    this.options = options;
  }

  async compact(messages: Message[]): Promise<Message[]> {
    if (this.options.preCompact) {
      await this.options.preCompact(messages);
    }

    const preserved: Message[] = [];
    const preservePatterns = this.options.preserve ?? ['decisions', 'interfaces', 'blockers'];

    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      const shouldPreserve = preservePatterns.some(p => content.includes(p));

      if (shouldPreserve) {
        preserved.push(msg);
      }
    }

    // Always keep at least the last message
    if (preserved.length === 0 && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        preserved.push(lastMessage);
      }
    }

    return preserved;
  }
}
