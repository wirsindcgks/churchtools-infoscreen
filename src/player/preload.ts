/**
 * Decodes the images of the next slide while the current one is still shown.
 * On a weak device decoding a full-screen picture takes long enough to be
 * seen; done ahead, the fade shows a finished picture instead of a blank one.
 */
export function createPreloader(): (urls: string[]) => void {
    // Held until the next call, so the browser keeps the decoded pictures.
    let held: HTMLImageElement[] = [];
    return (urls) => {
        // The previous set is on the stage by now, or no longer needed; long-running devices must not collect them.
        for (const image of held) image.removeAttribute('src');
        held = urls.map((url) => {
            const image = new Image();
            image.src = url;
            // A picture that fails here fails on the stage too, where the placeholder takes over.
            void image.decode().catch(() => undefined);
            return image;
        });
    };
}
