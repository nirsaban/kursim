import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queueInstance } = vi.hoisted(() => ({
  queueInstance: {
    getJob: vi.fn(),
    add: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => queueInstance),
}));
vi.mock('@/lib/ai/queue', () => ({ getQueueConnection: () => ({}) }));

import { enqueueTranscription } from '@/lib/transcription/queue';

beforeEach(() => {
  vi.clearAllMocks();
  queueInstance.getJob.mockResolvedValue(null);
});

describe('enqueueTranscription — jobId reuse', () => {
  it('adds a fresh job with an underscore-separated jobId (":" is rejected by BullMQ)', async () => {
    await enqueueTranscription({ tenantId: 't1', kind: 'lesson', id: 'l1' });
    expect(queueInstance.add).toHaveBeenCalledWith(
      'transcribe',
      expect.objectContaining({ id: 'l1' }),
      expect.objectContaining({ jobId: 'lesson_l1' }),
    );
  });

  it('does nothing extra when no job with this id exists yet', async () => {
    await enqueueTranscription({ tenantId: 't1', kind: 'index', id: 'l1' });
    expect(queueInstance.getJob).toHaveBeenCalledWith('index_l1');
    expect(queueInstance.add).toHaveBeenCalledOnce();
  });

  it('removes a previously COMPLETED job under the same id before re-adding — otherwise a retry would silently no-op', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    queueInstance.getJob.mockResolvedValue({ getState: vi.fn().mockResolvedValue('completed'), remove });
    await enqueueTranscription({ tenantId: 't1', kind: 'lesson', id: 'l1', force: true });
    expect(remove).toHaveBeenCalled();
    expect(queueInstance.add).toHaveBeenCalled();
  });

  it('removes a previously FAILED job under the same id before re-adding', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    queueInstance.getJob.mockResolvedValue({ getState: vi.fn().mockResolvedValue('failed'), remove });
    await enqueueTranscription({ tenantId: 't1', kind: 'index', id: 'l2' });
    expect(remove).toHaveBeenCalled();
    expect(queueInstance.add).toHaveBeenCalled();
  });

  it('leaves an active/waiting job alone — that is the real dedup guard, not something to clobber', async () => {
    const remove = vi.fn();
    for (const state of ['active', 'waiting', 'delayed'] as const) {
      queueInstance.getJob.mockResolvedValue({ getState: vi.fn().mockResolvedValue(state), remove });
      await enqueueTranscription({ tenantId: 't1', kind: 'attachment', id: 'a1' });
    }
    expect(remove).not.toHaveBeenCalled();
  });
});
