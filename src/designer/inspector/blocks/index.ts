import type { Component } from 'vue';
import type { BlockType } from '../../../model/schema';
import AppointmentListInspector from './AppointmentListInspector.vue';
import ChurchHeaderInspector from './ChurchHeaderInspector.vue';
import ClockInspector from './ClockInspector.vue';
import CountdownInspector from './CountdownInspector.vue';
import GroupsInspector from './GroupsInspector.vue';
import ImageInspector from './ImageInspector.vue';
import NextAppointmentInspector from './NextAppointmentInspector.vue';
import PostsInspector from './PostsInspector.vue';
import QrInspector from './QrInspector.vue';
import RoomsInspector from './RoomsInspector.vue';
import ShapeInspector from './ShapeInspector.vue';
import SlideshowInspector from './SlideshowInspector.vue';
import TextInspector from './TextInspector.vue';
import VideoInspector from './VideoInspector.vue';
import WebInspector from './WebInspector.vue';

/**
 * The inspector of each block type (Plan.md 79, B2). A type without an entry does not compile.
 */
export const BLOCK_INSPECTORS: Record<BlockType, Component> = {
    text: TextInspector,
    image: ImageInspector,
    shape: ShapeInspector,
    clock: ClockInspector,
    qr: QrInspector,
    web: WebInspector,
    video: VideoInspector,
    slideshow: SlideshowInspector,
    'appointment-list': AppointmentListInspector,
    'next-appointment': NextAppointmentInspector,
    countdown: CountdownInspector,
    'church-header': ChurchHeaderInspector,
    posts: PostsInspector,
    groups: GroupsInspector,
    rooms: RoomsInspector,
};
