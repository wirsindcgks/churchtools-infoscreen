import { onBeforeUnmount, ref, type Ref } from 'vue';
import type { HeartbeatDoc } from '../model/heartbeat';
import type { ScreenRepository } from '../store/screen-repository';

const ALIVE_REFRESH_MS = 60_000;

/**
 * The signs of life by screen slug (Plan.md 59), reloaded every minute while the page stands. `heartbeats` is
 * null while this person cannot see them or loading failed; `now` is the clock the pages compare with,
 * moved along with each reload. Without a repository yet, a reload does nothing.
 */
export function useHeartbeats(repository: Ref<ScreenRepository | null>) {
    const heartbeats = ref<Map<string, HeartbeatDoc> | null>(null);
    const now = ref(new Date());

    /** A failure leaves the hint out without a message. */
    async function refreshHeartbeats(): Promise<void> {
        if (!repository.value) return;
        heartbeats.value = await repository.value.listHeartbeats().catch(() => null);
        now.value = new Date();
    }

    const timer = setInterval(() => void refreshHeartbeats(), ALIVE_REFRESH_MS);
    onBeforeUnmount(() => clearInterval(timer));

    return { heartbeats, now, refreshHeartbeats };
}
