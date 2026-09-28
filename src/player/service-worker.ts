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
