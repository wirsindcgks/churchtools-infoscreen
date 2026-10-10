/**
 * Videos in the media library (Plan.md, Nächste Schritte 52): what is accepted,
 * and how length and size are read. The image service takes no videos (G42), so
 * a video is kept as it is, MP4 with H.264, and played from its download address.
 */
import { t } from '../i18n/designer';

export const VIDEO_TYPES = ['video/mp4'];
export const VIDEO_MAX_BYTES = 128 * 1024 * 1024;

/** Why a file may not go up as a video; `null` when it may. Checked before anything is sent. */
export function videoProblem(file: { name: string; type: string; size: number }): string | null {
    if (!VIDEO_TYPES.includes(file.type)) return t.media.library.onlyMp4;
    if (file.size > VIDEO_MAX_BYTES) return t.media.library.tooLarge(file.name, VIDEO_MAX_BYTES / 1024 / 1024);
    return null;
}

/** Whether a dropped or chosen file is meant as a video, whatever its type. */
export function looksLikeVideo(file: { name: string; type: string }): boolean {
    return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name);
}

export interface VideoMetadata {
    durationSeconds?: number;
    width?: number;
    height?: number;
}

/** The part of a `<video>` element the reader uses – replaceable in tests. */
export interface VideoProbe {
    preload: string;
    muted: boolean;
    src: string;
    readonly duration: number;
    readonly videoWidth: number;
    readonly videoHeight: number;
    addEventListener(type: 'loadedmetadata' | 'error', listener: () => void): void;
    removeAttribute(name: string): void;
    load(): void;
}

export const METADATA_TIMEOUT_MS = 10_000;

/**
 * Reads length and size of a video from its download address through an
 * element that is never attached. Not from the local file: the content
 * security policy of ChurchTools allows no `blob:` for media (G47). Never
 * rejects – without an answer in time the video is saved without the figures.
 */
export function readVideoMetadata(
    url: string,
    create: () => VideoProbe = () => document.createElement('video'),
    timeoutMs = METADATA_TIMEOUT_MS,
): Promise<VideoMetadata> {
    return new Promise((resolve) => {
        let probe: VideoProbe;
        try {
            probe = create();
        } catch {
            resolve({});
            return;
        }
        let done = false;
        const finish = (result: VideoMetadata) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            probe.removeAttribute('src');
            probe.load();
            resolve(result);
        };
        const timer = setTimeout(() => finish({}), timeoutMs);
        probe.addEventListener('loadedmetadata', () =>
            finish({
                ...(Number.isFinite(probe.duration) && probe.duration >= 0 ? { durationSeconds: Math.round(probe.duration * 10) / 10 } : {}),
                ...(probe.videoWidth > 0 ? { width: probe.videoWidth } : {}),
                ...(probe.videoHeight > 0 ? { height: probe.videoHeight } : {}),
            }),
        );
        probe.addEventListener('error', () => finish({}));
        probe.preload = 'metadata';
        probe.muted = true;
        probe.src = url;
    });
}

/** "0:12", "3:05" – the length on a tile; nothing without one. */
export function formatDuration(seconds: number | undefined): string {
    if (seconds === undefined || !Number.isFinite(seconds)) return '';
    const whole = Math.round(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
