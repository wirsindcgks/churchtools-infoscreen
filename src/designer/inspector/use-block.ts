import { sizedImageUrl } from '../../player/format';
import { formatDuration } from '../../media/video';
import type { Block, TextStyle } from '../../model/schema';
import { useEditorStore } from '../editor-store';

/** A block with a text style: the ones that get a "Schrift" section. */
export type StyledBlock = Extract<Block, { style: TextStyle }>;

/** The edits every inspector of a block needs, bound to the block it shows. */
export function useBlockEdit(block: () => Block) {
    const editor = useEditorStore();

    function setBlock(patch: Record<string, unknown>): void {
        editor.updateBlock(block().id, patch as Partial<Block>);
    }

    function setStyle(patch: Partial<TextStyle>): void {
        const current = block();
        if (!('style' in current)) return;
        const style: Record<string, unknown> = { ...current.style, ...patch };
        // An undefined value takes the field away instead of leaving the key behind ("Normal", "Ohne").
        for (const key of Object.keys(style)) if (style[key] === undefined) delete style[key];
        setBlock({ style });
    }

    /** The preview address of a library image, or null for none. */
    function mediaUrl(id: string | undefined, fit: 'crop' | 'max' = 'crop'): string | null {
        const media = id ? editor.media.find((m) => m.id === id) : undefined;
        return media ? sizedImageUrl(media.imageUrl, 272, 153, fit) : null;
    }

    /** The chosen video's name and length for the line under the button, "Film.mp4 · 0:12". */
    function videoLabel(id: string | undefined): string | null {
        const media = id ? editor.media.find((m) => m.id === id) : undefined;
        if (!media) return null;
        const length = formatDuration(media.durationSeconds);
        return length ? `${media.name} · ${length}` : media.name;
    }

    return { editor, setBlock, setStyle, mediaUrl, videoLabel };
}
