/**
 * Shrinks large images in the browser before upload. ChurchTools keeps
 * uploads at full size – `max_width` on the upload changes nothing (G27) –
 * and the image service scales for display anyway. An 8-megapixel phone
 * photo would otherwise occupy storage that nobody ever sees.
 */
export const MAX_EDGE = 3840;

export function targetSize(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
    const longest = Math.max(width, height);
    if (longest <= maxEdge) return { width, height };
    const factor = maxEdge / longest;
    return { width: Math.round(width * factor), height: Math.round(height * factor) };
}

export interface PreparedImage {
    blob: Blob;
    name: string;
    width: number;
    height: number;
}

/** Returns the file unchanged when it is small enough or not a raster image the browser can decode. */
export async function prepareImage(file: File): Promise<PreparedImage> {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.type === 'image/gif') {
        return { blob: file, name: file.name, width: 0, height: 0 };
    }
    const bitmap = await createImageBitmap(file);
    const size = targetSize(bitmap.width, bitmap.height);
    if (size.width === bitmap.width && size.height === bitmap.height) {
        bitmap.close();
        return { blob: file, name: file.name, ...size };
    }
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    // PNG keeps transparency (logos); photos become JPEG.
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild ließ sich nicht verkleinern.'))), type, 0.88),
    );
    const name = type === 'image/jpeg' ? file.name.replace(/\.(png|webp)$/i, '.jpg') : file.name;
    return { blob, name, ...size };
}
