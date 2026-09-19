export type MutationQueueSnapshot = {
  pending: number;
  activeLabel: string | null;
  enqueued: number;
  completed: number;
  failed: number;
};

export class MutationSerializationQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private activeLabel: string | null = null;
  private enqueued = 0;
  private completed = 0;
  private failed = 0;

  run<T>(operation: () => Promise<T>, label = 'storage-mutation'): Promise<T> {
    this.pending += 1;
    this.enqueued += 1;
    const execute = async (): Promise<T> => {
      this.activeLabel = label;
      try {
        const result = await operation();
        this.completed += 1;
        return result;
      } catch (error) {
        this.failed += 1;
        throw error;
      } finally {
        this.pending = Math.max(0, this.pending - 1);
        this.activeLabel = null;
      }
    };
    const result = this.tail.then(execute, execute);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async whenIdle(): Promise<void> {
    await this.tail;
  }

  snapshot(): MutationQueueSnapshot {
    return { pending: this.pending, activeLabel: this.activeLabel, enqueued: this.enqueued, completed: this.completed, failed: this.failed };
  }
}
