import { PUBLIC_CALENDAR_PATH } from '../../ct/api';
import { t } from '../../i18n/designer';
import { th } from '../../i18n/help';
import type { HelpSection } from './types';

const i = t.inspector;
const f = th.font;
const list = th.appointmentList;
const frame = th.pictureFrame;
const show = th.slideshow;
const shape = th.shape;
const next = th.nextAppointment;
const posts = th.posts;
const groups = th.groups;

/**
 * Every topic of the help, whatever is chosen (Plan.md 98, D): the search of the bar looks here as well, so "Schrift" finds
 * something while only the slide is chosen (user, 2026-10-20). Titles name the block where the section is its own.
 */
export const HELP_CATALOG: HelpSection[] = [
    // Out of its block "Allgemein" says nothing: the loose fields stand under the name of their block.
    { id: 'all-text', title: t.blocks.text, topic: { items: [th.general.text] } },
    { id: 'all-image', title: t.blocks.image, topic: { items: [th.general.image] } },
    { id: 'all-video', title: t.blocks.video, topic: { items: [th.general.video, th.general.videoRuntime, th.general.sound] } },
    { id: 'all-slideshow', title: t.blocks.slideshow, topic: { items: [th.general.slideshowAdd] } },
    { id: 'all-rooms', title: t.blocks.rooms, topic: { items: [th.rooms.add] } },
    { id: 'all-social', title: t.blocks.social, topic: { items: [th.social.add] } },
    { id: 'all-web', title: t.blocks.web, topic: { items: [th.web.address] } },
    { id: 'all-qr', title: t.blocks.qr, topic: { items: [th.qr.content] } },
    { id: 'all-template', title: t.blocks.template, topic: { items: [th.template.edit, th.template.unlink] } },
    {
        id: 'all-font',
        title: i.font,
        topic: {
            intro: f.intro,
            items: [f.level, f.family, f.size, f.weight, f.uppercase, f.color, f.align, f.lineHeight, f.letterSpacing, f.shadow, f.highlight, f.highlightColor, f.highlightOpacity, f.vertical],
        },
    },
    { id: 'all-frame-look', title: i.frameLook, topic: th.frameLook },
    { id: 'all-arrange', title: i.arrange, topic: { intro: th.arrange.intro, items: [th.arrange.regionFixed] } },
    { id: 'all-measures', title: i.measures, topic: th.measures },
    { id: 'all-image-look', title: `${t.blocks.image} · ${i.appearance}`, topic: { intro: th.image.intro, items: [...th.image.items, frame.corners, frame.shadow] } },
    { id: 'all-video-look', title: `${t.blocks.video} · ${i.appearance}`, topic: { intro: th.video.intro, items: [th.video.fit, frame.corners, frame.shadow] } },
    { id: 'all-slideshow-images', title: `${t.blocks.slideshow} · ${i.images}`, topic: show.images },
    {
        id: 'all-slideshow-look',
        title: `${t.blocks.slideshow} · ${i.appearance}`,
        topic: { intro: show.intro, items: [show.seconds, show.transition, show.motion, show.fit, frame.corners, frame.shadow] },
    },
    { id: 'all-clock-look', title: `${t.blocks.clock} · ${i.appearance}`, topic: { items: [th.clock.view] } },
    { id: 'all-countdown-look', title: `${t.blocks.countdown} · ${i.appearance}`, topic: { intro: th.countdown.intro, items: [th.countdown.showTitle, th.countdown.running] } },
    { id: 'all-shape-look', title: `${t.blocks.shape} · ${i.appearance}`, topic: { intro: shape.intro, items: [shape.form, shape.kind, shape.corners, shape.border, shape.borderColor] } },
    { id: 'all-line-look', title: `${t.blocks.line} · ${i.appearance}`, topic: th.line },
    { id: 'all-background', title: `${t.help.slide} · ${i.background}`, topic: th.background },
    {
        id: 'all-next-look',
        title: `${t.blocks['next-appointment']} · ${i.appearance}`,
        topic: { intro: next.intro, items: [next.view, next.showCalendar, next.showImage] },
    },
    { id: 'all-post-groups', title: `${t.blocks.posts} · ${i.groups}`, topic: posts.groups },
    {
        id: 'all-posts-look',
        title: `${t.blocks.posts} · ${i.appearance}`,
        topic: { intro: posts.intro, items: [posts.view, posts.count, posts.period, posts.seconds, posts.fit, posts.focus] },
    },
    { id: 'all-posts-details', title: `${t.blocks.posts} · ${i.details}`, topic: posts.details },
    { id: 'all-group-list', title: i.groupsHomepage, topic: groups.homepage },
    {
        id: 'all-groups-look',
        title: `${t.blocks.groups} · ${i.appearance}`,
        topic: { intro: groups.intro, items: [groups.view, groups.order, groups.perPage(true), groups.seconds(i.secondsPerPage)] },
    },
    { id: 'all-groups-details', title: `${t.blocks.groups} · ${i.details}`, topic: groups.details },
    { id: 'all-room-list', title: `${t.blocks.rooms} · ${i.rooms}`, topic: th.rooms.list },
    { id: 'all-rooms-look', title: `${t.blocks.rooms} · ${i.appearance}`, topic: { intro: th.rooms.intro, items: [th.rooms.view, th.rooms.period, th.rooms.seconds] } },
    { id: 'all-social-list', title: `${t.blocks.social} · ${i.socialProfiles}`, topic: th.social.list },
    { id: 'all-social-look', title: `${t.blocks.social} · ${i.appearance}`, topic: th.social.look },
    { id: 'all-web-look', title: `${t.blocks.web} · ${i.appearance}`, topic: th.web.look },
    { id: 'all-qr-look', title: `${t.blocks.qr} · ${i.appearance}`, topic: th.qr.look },
    { id: 'all-church-header-look', title: `${t.blocks['church-header']} · ${i.appearance}`, topic: th.churchHeader },
    {
        id: 'all-appointment-list',
        title: `${t.blocks['appointment-list']} · ${i.appearance}`,
        topic: { intro: list.intro, items: [list.view, list.showCalendar, list.period, list.count, list.showAll, list.secondsPerPage] },
    },
    { id: 'all-calendars', title: t.common.calendars.title, topic: { intro: t.common.calendars.info(PUBLIC_CALENDAR_PATH) } },
    { id: 'all-hide-tags', title: i.hideTagsTitle, topic: { intro: i.hideTagsInfo } },
    { id: 'all-services', title: i.servicesTitle, topic: { intro: i.servicesInfo } },
    { id: 'all-rooms-for', title: i.roomsFor, topic: th.roomsFor },
];
