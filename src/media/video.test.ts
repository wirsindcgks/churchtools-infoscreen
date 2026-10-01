import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDuration, looksLikeVideo, readVideoMetadata, videoProblem, type VideoProbe } from './video';

class FakeProbe implements VideoProbe {
    preload = '';
    muted = false;
    src = '';
    duration = NaN;
    videoWidth = 0;
    videoHeight = 0;
    private listeners = new Map<string, () => void>();
    addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, listener);
    }
    removeAttribute() {}
    load() {}
    fire(type: string) {
        this.listeners.get(type)?.();
    }
}

describe('readVideoMetadata', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('reads length and size from the address once the metadata is there', async () => {
        const probe = new FakeProbe();
        const result = readVideoMetadata('https://ct.example/?q=public/filedownload&id=1', () => probe);
        expect(probe).toMatchObject({ preload: 'metadata', muted: true, src: 'https://ct.example/?q=public/filedownload&id=1' });
        Object.assign(probe, { duration: 11.96, videoWidth: 1920, videoHeight: 1080 });
        probe.fire('loadedmetadata');
        expect(await result).toEqual({ durationSeconds: 12, width: 1920, height: 1080 });
    });

    it('gives nothing on an error, after the time limit, or without an element', async () => {
        const failing = new FakeProbe();
        const onError = readVideoMetadata('x', () => failing);
        failing.fire('error');
        expect(await onError).toEqual({});

        const silent = new FakeProbe();
        const late = readVideoMetadata('x', () => silent, 10_000);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(await late).toEqual({});

        expect(await readVideoMetadata('x', () => { throw new Error('kein Browser'); })).toEqual({});
    });

    it('leaves out a length that is not a number (a stream)', async () => {
        const probe = new FakeProbe();
        const result = readVideoMetadata('x', () => probe);
        Object.assign(probe, { duration: Infinity, videoWidth: 640, videoHeight: 360 });
        probe.fire('loadedmetadata');
        expect(await result).toEqual({ width: 640, height: 360 });
    });
});

describe('videoProblem', () => {
    it('takes MP4 up to the limit and refuses the rest, with a reason', () => {
        expect(videoProblem({ name: 'a.mp4', type: 'video/mp4', size: 5 })).toBeNull();
        expect(videoProblem({ name: 'a.webm', type: 'video/webm', size: 5 })).toBe('Nur MP4-Videos (H.264) werden unterstützt.');
        expect(videoProblem({ name: 'a.mp4', type: 'video/mp4', size: 129 * 1024 * 1024 })).toBe('„a.mp4" ist größer als 128 MB.');
    });

    it('tells a video from an image by type or name', () => {
        expect(looksLikeVideo({ name: 'a.mp4', type: '' })).toBe(true);
        expect(looksLikeVideo({ name: 'a', type: 'video/webm' })).toBe(true);
        expect(looksLikeVideo({ name: 'a.png', type: 'image/png' })).toBe(false);
    });
});

describe('formatDuration', () => {
    it('writes minutes and seconds, and nothing without a length', () => {
        expect(formatDuration(12)).toBe('0:12');
        expect(formatDuration(185.4)).toBe('3:05');
        expect(formatDuration(undefined)).toBe('');
    });
});
