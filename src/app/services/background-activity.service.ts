import { computed, Injectable, signal } from '@angular/core';

export interface BackgroundTask {
  id: string;
  label: string;
  startedAt: number;
}

@Injectable({ providedIn: 'root' })
export class BackgroundActivityService {
  private readonly tasks = signal<ReadonlyMap<string, BackgroundTask>>(new Map());

  readonly activeCount = computed(() => this.tasks().size);
  readonly activeTasks = computed(() => [...this.tasks().values()]);
  readonly busy = computed(() => this.tasks().size > 0);

  start(id: string, label: string): void {
    this.tasks.update(prev => {
      const next = new Map(prev);
      next.set(id, { id, label, startedAt: Date.now() });
      return next;
    });
  }

  end(id: string): void {
    this.tasks.update(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  /** Wraps an async operation with automatic start/end tracking. */
  async wrap<T>(id: string, label: string, fn: () => Promise<T>): Promise<T> {
    this.start(id, label);
    try {
      return await fn();
    } finally {
      this.end(id);
    }
  }
}
