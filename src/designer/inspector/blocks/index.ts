import type { Component } from 'vue';
import type { BlockType } from '../../../model/schema';
import ClockInspector from './ClockInspector.vue';
import ImageInspector from './ImageInspector.vue';
import LegacyInspector from './LegacyInspector.vue';
import QrInspector from './QrInspector.vue';
import ShapeInspector from './ShapeInspector.vue';
import TextInspector from './TextInspector.vue';
import VideoInspector from './VideoInspector.vue';
import WebInspector from './WebInspector.vue';

/**
 * The inspector of each block type (Plan.md 79, B2). A type without an entry does not compile. Until part 2 the blocks
 * that have not moved share the transition inspector.
 */
export const BLOCK_INSPECTORS: Record<BlockType, Component> = {
    text: TextInspector,
    image: ImageInspector,
    shape: ShapeInspector,
    clock: ClockInspector,
    qr: QrInspector,
    web: WebInspector,
    video: VideoInspector,
    slideshow: LegacyInspector,
    'appointment-list': LegacyInspector,
    'next-appointment': LegacyInspector,
    countdown: LegacyInspector,
    'church-header': LegacyInspector,
    posts: LegacyInspector,
    groups: LegacyInspector,
    rooms: LegacyInspector,
};
