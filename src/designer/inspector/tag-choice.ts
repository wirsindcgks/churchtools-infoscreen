import { computed } from 'vue';
import type { Block } from '../../model/schema';
import { useInspectorContext } from './context';
import { useBlockEdit } from './use-block';

type TagBlock = Extract<Block, { type: 'appointment-list' | 'next-appointment' | 'countdown' }>;

/** At most this many tags per block; the same bound as the schema (1.37). */
export const HIDE_TAGS_MAX = 20;

/** The tags a block hides (Plan.md 82 C), for the `TagField` of its inspector. */
export function useTagChoice(block: () => TagBlock) {
    const context = useInspectorContext();
    const { setBlock } = useBlockEdit(block);

    /** The last tag taken away leaves the field out altogether, not an empty list. */
    function toggleTag(id: number, on: boolean): void {
        const current = block().hideTagIds ?? [];
        const next = on ? [...new Set([...current, id])].sort((a, b) => a - b) : current.filter((t) => t !== id);
        setBlock({ hideTagIds: next.length ? next : undefined });
    }

    /** Null while the tags are not loaded and where they cannot be: then the block has no field for them. */
    const tags = computed(() => context.tags ?? null);

    return { tags, toggleTag };
}
