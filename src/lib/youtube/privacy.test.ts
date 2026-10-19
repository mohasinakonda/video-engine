import { describe, expect, it, vi } from 'vitest';
import { makeDataset } from './__tests__/fixtures';
import { runDiagnosis } from './diagnosis';
import { DEFAULT_SETTINGS } from './settings';

const dbCalls = vi.fn();
vi.mock('./db', () => ({
  getServiceClient: () => {
    dbCalls();
    throw new Error('the diagnosis must not touch the database');
  },
}));
vi.mock('./fetcher', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./fetcher')>()),
  fetchChannelDataset: async () => makeDataset(),
}));
vi.mock('@/lib/llm-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm-providers')>()),
  callLLM: async () => null,
}));

describe('privacy', () => {
  it('runs a full diagnosis without reading or writing the database', async () => {
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await runDiagnosis({
      userId: 'user-1',
      accessToken: 'ya29.secret-access-token',
      connection: { channelId: 'UC123', title: 'Test', thumbnail: null, url: '', status: 'active', reportingStartedAt: null },
      reportingJobId: 'job',
      settings: { ...DEFAULT_SETTINGS, maxThumbnails: 0 },
      range: '28d',
      onStage: () => {},
    });

    expect(dbCalls).not.toHaveBeenCalled();
    expect(result.report.source).toBe('fallback');
    // The result that goes to the browser never carries the token.
    expect(JSON.stringify(result)).not.toContain('secret-access-token');
    expect(logs.mock.calls.flat().join(' ')).not.toContain('secret-access-token');
    logs.mockRestore();
  });
});
