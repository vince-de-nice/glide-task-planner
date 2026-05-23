/**
 * File d’attente FIFO pour tâches async : une erreur n’empêche pas les suivantes.
 * (Contrairement à `prev.then(fn)` sur une promesse rejetée, qui saute `fn`.)
 */
export class SerialAsyncQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.catch(() => undefined).then(() => task());
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  reset(): void {
    this.tail = Promise.resolve();
  }
}

const queuesByKey = new WeakMap<object, SerialAsyncQueue>();

/** Une file par clé (ex. instance MapLibre). */
export function getSerialQueue(key: object): SerialAsyncQueue {
  let queue = queuesByKey.get(key);
  if (!queue) {
    queue = new SerialAsyncQueue();
    queuesByKey.set(key, queue);
  }
  return queue;
}

export function resetSerialQueue(key: object): void {
  queuesByKey.get(key)?.reset();
}
