import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeartbeatDoc } from '../model/heartbeat';

const writeHeartbeat = vi.fn<(doc: HeartbeatDoc) => Promise<void>>(async () => {});
const getRepository = vi.fn(async () => ({ repository: { writeHeartbeat }, demo: false }));

vi.mock('../store/backend', () => ({ getRepository }));
vi.mock('../ct/client', async (importOriginal) => ({ ...(await importOriginal<object>()), ensureSignedIn: vi.fn() }));

const { createChurchToolsPlayerData, churchToolsPlayerData } = await import('./data');

const doc: HeartbeatDoc = {
    kind: 'heartbeat',
    screen: 'foyer',
    at: '2026-10-05T10:00:00.000Z',
    version: '0.17.0',
    playlistId: null,
    clockConfirmed: true,
};

// Only a TV with a device login reports (Plan.md 59).
describe('PlayerData.reportAlive', () => {
    beforeEach(() => {
        writeHeartbeat.mockClear();
        getRepository.mockClear();
    });

    it('does nothing without a device login', async () => {
        await createChurchToolsPlayerData().reportAlive(doc);
        await churchToolsPlayerData.reportAlive(doc);
        expect(getRepository).not.toHaveBeenCalled();
        expect(writeHeartbeat).not.toHaveBeenCalled();
    });

    it('writes with a device login', async () => {
        await createChurchToolsPlayerData({ loginToken: 't', personId: 22 }).reportAlive(doc);
        expect(writeHeartbeat).toHaveBeenCalledWith(doc);
    });
});
