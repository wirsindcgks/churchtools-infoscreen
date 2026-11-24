/**
 * The player's side of the service worker (Plan.md, 37; G10): registers it after the first successful
 * render, and asks it whether it still has a page cached when the network itself is unreachable
 * (`canReload()`, `controller.ts`). The worker itself lives under `src/sw/` and knows nothing of this
 * file – the contract between the two (the `has-page` message) is the only thing they share, by
 * convention, not by import.
 */

/**
 * Registers the worker, once the player has shown something – registering earlier would still leave a
 * restart before the very first successful load with the browser's error page, since nothing is cached
 * yet. Only in the production build, and only where a browser has the API at all; a kiosk browser too old
 * for it simply keeps today's behaviour. A failure (e.g. ChurchTools answering with its login page instead
 * of the file, without a session) never reaches the screen – only a warning in the console.
 */
export function registerPlayerServiceWorker(base: string): void {
    if (!import.meta.env.PROD) return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
        console.warn('Service Worker nicht registriert:', error);
    });
}

/** The part of `navigator.serviceWorker` {@link watchForNewVersion} uses – a test passes its own. */
export type VersionWatchContainer = Pick<ServiceWorkerContainer, 'controller' | 'getRegistration' | 'addEventListener' | 'removeEventListener'>;

/**
 * Tells `onNewVersion` when a newer player is installed (Plan.md 117). The worker carries the version (`sw.ts`), so its file differs with
 * every release; every `everyMs` the browser fetches it afresh (`update()`), and a different one takes over this page at once
 * (`skipWaiting`, `clients.claim`) – the `controllerchange`. The very first takeover, on a page that had no worker yet, is no new
 * version. Without the API it does nothing; the nightly reload stays. Returns the function that stops it.
 */
export function watchForNewVersion(
    base: string,
    onNewVersion: () => void,
    everyMs: number,
    container: VersionWatchContainer | undefined = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
): () => void {
    if (!container) return () => {};
    let controlled = container.controller !== null;
    const onChange = (): void => {
        if (controlled) onNewVersion();
        controlled = true;
    };
    container.addEventListener('controllerchange', onChange);
    const timer = setInterval(() => {
        container
            .getRegistration(base)
            .then((registration) => registration?.update())
            // Offline or ChurchTools answering with its login page: the next try comes in `everyMs`.
            .catch(() => undefined);
    }, everyMs);
    return () => {
        clearInterval(timer);
        container.removeEventListener('controllerchange', onChange);
    };
}

/**
 * Asks the browser to keep the player's storage (`navigator.storage.persist()`). Without it, storage is
 * "best effort": on a full SD card Chromium may clear the origin – the worker's copy, IndexedDB and the
 * videos at once – and the next outage finds no copy (docs/Ausfall.md). Chromium decides without asking
 * anyone; the answer only goes to the console, like everything the TV cannot show.
 */
export async function keepPlayerStorage(storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined = navigator.storage): Promise<void> {
    if (!storage?.persist) return;
    try {
        if (await storage.persisted()) return;
        if (!(await storage.persist())) console.warn('Speicher des Players nicht dauerhaft: der Browser darf ihn räumen.');
    } catch (error) {
        console.warn('Speicher des Players nicht dauerhaft:', error);
    }
}

/**
 * Asks the service worker controlling this page whether it has `url` cached (message `has-page`) – the
 * fallback `canReload()` uses when a `HEAD` request to the network itself fails. `false` without a
 * controller, on any error, and when no answer arrives within `timeoutMs`.
 */
export function askServiceWorkerHasPage(url: string, timeoutMs = 1000): Promise<boolean> {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(false), timeoutMs);
        channel.port1.onmessage = (event: MessageEvent<boolean>) => {
            clearTimeout(timer);
            resolve(event.data === true);
        };
        controller.postMessage({ type: 'has-page', url }, [channel.port2]);
    });
}
