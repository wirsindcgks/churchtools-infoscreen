import { onBeforeUnmount, onMounted } from 'vue';

/** The part of the Screen Wake Lock API this page uses. */
interface WakeLockLike {
    request(type: 'screen'): Promise<{ release(): Promise<void> }>;
}

/**
 * Keeps the screen of the phone on while the page is open (user, 2026-11-13: a musician on stage must not find a locked phone).
 * The browser drops the lock whenever the page is hidden, so it is asked for again each time the page comes back. Where the API is
 * missing or refuses (old browser, battery saver), nothing happens – the page works as before.
 */
export function keepScreenOn(wakeLock: WakeLockLike | undefined, doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>): () => void {
    let lock: { release(): Promise<void> } | null = null;
    let stopped = false;
    const ask = async () => {
        if (!wakeLock || stopped || doc.visibilityState !== 'visible') return;
        try {
            const got = await wakeLock.request('screen');
            if (stopped) void got.release().catch(() => undefined);
            else lock = got;
        } catch {
            // Refused: the screen locks as usual.
        }
    };
    const onVisibility = () => void ask();
    doc.addEventListener('visibilitychange', onVisibility);
    void ask();
    return () => {
        stopped = true;
        doc.removeEventListener('visibilitychange', onVisibility);
        void lock?.release().catch(() => undefined);
        lock = null;
    };
}

/** {@link keepScreenOn} for the life of a component. */
export function useWakeLock(): void {
    let stop: (() => void) | undefined;
    onMounted(() => {
        stop = keepScreenOn((navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock, document);
    });
    onBeforeUnmount(() => stop?.());
}
