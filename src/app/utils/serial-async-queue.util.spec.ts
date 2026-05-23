import { describe, expect, it, vi } from 'vitest';
import { SerialAsyncQueue } from './serial-async-queue.util';

describe('SerialAsyncQueue', () => {
  it('runs tasks in order', async () => {
    const q = new SerialAsyncQueue();
    const order: number[] = [];
    await Promise.all([
      q.enqueue(async () => {
        await delay(20);
        order.push(1);
      }),
      q.enqueue(async () => {
        order.push(2);
      })
    ]);
    expect(order).toEqual([1, 2]);
  });

  it('continues after a rejected task', async () => {
    const q = new SerialAsyncQueue();
    const order: number[] = [];

    const p1 = q.enqueue(async () => {
      order.push(1);
      throw new Error('fail');
    });
    const p2 = q.enqueue(async () => {
      order.push(2);
    });

    await expect(p1).rejects.toThrow('fail');
    await p2;
    expect(order).toEqual([1, 2]);
  });

  it('reset does not cancel in-flight work but clears pending tail', async () => {
    const q = new SerialAsyncQueue();
    let ran = false;
    void q.enqueue(async () => {
      await delay(30);
      ran = true;
    });
    q.reset();
    await q.enqueue(async () => undefined);
    await delay(40);
    expect(ran).toBe(true);
  });
});

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    vi.useRealTimers();
    setTimeout(resolve, ms);
  });
}
