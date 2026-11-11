import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    admin: vi.fn(),
    repo: vi.fn(),
    catalog: vi.fn(),
    plan: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock('@churchtools/churchtools-client', () => ({ churchtoolsClient: { get: vi.fn().mockResolvedValue([]) } }));
vi.mock('../designer/administrator', () => ({ isAdministrator: mocks.admin }));
vi.mock('../store/backend', () => ({ getRepository: mocks.repo }));
vi.mock('../ct/api', () => ({
    fetchCalendars: vi.fn().mockResolvedValue([]),
    fetchPublicCalendars: vi.fn().mockResolvedValue([]),
    fetchResourceMasterdata: vi.fn().mockResolvedValue(null),
}));
vi.mock('../ct/client', () => ({ instanceBaseUrl: () => 'https://x' }));
vi.mock('./catalog', () => ({ loadAuthCatalog: mocks.catalog }));
vi.mock('./load', () => ({ churchToolsProvisionApi: {}, loadGroups: vi.fn().mockResolvedValue([]) }));
vi.mock('./locks', () => ({ readLocks: vi.fn().mockResolvedValue(null) }));
vi.mock('./provision', () => ({
    planProvisioning: mocks.plan,
    readRefresh: mocks.refresh,
    refreshIsEmpty: (g: unknown[]) => g.length === 0,
}));

import { CATEGORIES } from '../store/screen-repository';
import { checkRightsPending, rightsPending, setRightsPending } from './pending';

function repository() {
    const visible = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, 1]));
    return {
        loadSettings: vi.fn().mockResolvedValue({}),
        roomIdsInUse: vi.fn().mockResolvedValue([]),
        appointmentRoomsInUse: vi.fn().mockResolvedValue([]),
        serviceCalendarIdsInUse: vi.fn().mockResolvedValue([]),
        agendaCalendarIdsInUse: vi.fn().mockResolvedValue([]),
        songsheetInUse: vi.fn().mockResolvedValue(false),
        visibleCategories: vi.fn().mockResolvedValue(visible),
        statusCategoryId: vi.fn().mockResolvedValue(2),
        controlCategoryId: vi.fn().mockResolvedValue(36),
        drafts: { categoryId: vi.fn().mockResolvedValue(3) },
        changelog: { categoryId: vi.fn().mockResolvedValue(4) },
    };
}

describe('checkRightsPending (Plan.md 122)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        window.sessionStorage.clear();
        rightsPending.value = false;
        mocks.admin.mockResolvedValue(true);
        mocks.repo.mockResolvedValue({ repository: repository(), demo: false });
        mocks.catalog.mockResolvedValue({});
        mocks.plan.mockReturnValue([]);
        mocks.refresh.mockResolvedValue({ groups: [{}], blocked: [] });
    });

    it('is true when the refresh has something to do', async () => {
        await checkRightsPending();
        expect(rightsPending.value).toBe(true);
    });

    it('is false when the refresh is empty', async () => {
        mocks.refresh.mockResolvedValue({ groups: [], blocked: [] });
        await checkRightsPending();
        expect(rightsPending.value).toBe(false);
    });

    it('plans the steering category and the musicians group from the settings', async () => {
        mocks.repo.mockResolvedValue({
            repository: { ...repository(), loadSettings: vi.fn().mockResolvedValue({ createdGroupIds: [84], musicianGroupId: 84 }) },
            demo: false,
        });
        await checkRightsPending();
        expect(mocks.plan).toHaveBeenCalledWith(expect.objectContaining({ controlCategoryId: 36, musicianGroupId: 84 }));
        expect(mocks.refresh.mock.calls[0]![1]).toMatchObject({ musician: 84 });
    });

    it('is false when a right is locked', async () => {
        mocks.refresh.mockResolvedValue({ groups: [{}], blocked: [{}] });
        await checkRightsPending();
        expect(rightsPending.value).toBe(false);
    });

    it('does not read for non-administrators and in the demo', async () => {
        mocks.admin.mockResolvedValue(false);
        await checkRightsPending();
        expect(rightsPending.value).toBe(false);
        expect(mocks.repo).not.toHaveBeenCalled();
        mocks.admin.mockResolvedValue(true);
        mocks.repo.mockResolvedValue({ repository: repository(), demo: true });
        window.sessionStorage.clear();
        await checkRightsPending();
        expect(rightsPending.value).toBe(false);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('is false and only warns when the plan fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        mocks.plan.mockImplementation(() => {
            throw new Error('plan');
        });
        await checkRightsPending();
        expect(rightsPending.value).toBe(false);
        expect(warn).toHaveBeenCalled();
    });

    it('is false without a catalog', async () => {
        mocks.catalog.mockRejectedValue(new Error('none'));
        await checkRightsPending();
        expect(rightsPending.value).toBe(false);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('keeps the answer 10 minutes in the session', async () => {
        vi.useFakeTimers();
        try {
            await checkRightsPending();
            expect(mocks.refresh).toHaveBeenCalledTimes(1);
            rightsPending.value = false;
            vi.advanceTimersByTime(9 * 60 * 1000);
            await checkRightsPending();
            expect(mocks.refresh).toHaveBeenCalledTimes(1);
            expect(rightsPending.value).toBe(true);
            vi.advanceTimersByTime(2 * 60 * 1000);
            await checkRightsPending();
            expect(mocks.refresh).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('shares one run between concurrent calls', async () => {
        await Promise.all([checkRightsPending(), checkRightsPending()]);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('setRightsPending sets the ref and the session', async () => {
        setRightsPending(true);
        expect(rightsPending.value).toBe(true);
        rightsPending.value = false;
        await checkRightsPending();
        expect(rightsPending.value).toBe(true);
    });
});
