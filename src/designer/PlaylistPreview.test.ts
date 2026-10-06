import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import type { Group } from '../groups/normalize';
import { makeSlide } from '../model/testing';
import type { Block } from '../model/schema';
import { provideStageContext, type StageContext } from '../player/context';
import type { Post } from '../posts/normalize';
import PlaylistPreview from './PlaylistPreview.vue';

const style = { fontFamily: 'sans', fontSize: 40, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
const frame = { x: 0, y: 0, width: 1400, height: 700 };

const post: Post = {
    id: 4,
    groupId: 31,
    groupName: 'ISD-Beitragstest',
    color: null,
    groupInitials: 'I',
    groupImageUrl: null,
    title: 'Biete Akkuschrauber',
    content: 'Text',
    publishedAt: new Date('2026-10-03T08:00:00Z'),
    expiresAt: null,
    author: null,
    imageUrl: null,
    imageRatio: null,
};

const group: Group = {
    id: 8,
    name: 'Kinderkirche',
    note: '',
    imageUrl: null,
    weekday: 'Sonntag',
    weekdaySort: 6,
    meetingTime: '10:00',
    targetGroup: '',
    category: '',
    color: null,
    leaders: [],
    freePlaces: null,
    waitinglist: false,
    publicUrl: 'https://example.church.tools/publicgroup/8',
};

const postsBlock: Block = {
    ...frame,
    id: 'p',
    type: 'posts',
    groupIds: [31],
    limit: 3,
    maxAgeDays: 30,
    layout: 'card',
    showImage: true,
    showAuthor: false,
    style,
};
const groupsBlock: Block = {
    ...frame,
    id: 'g',
    type: 'groups',
    y: 800,
    parentGroupId: 10,
    groupIds: [],
    sort: 'weekday',
    layout: 'card',
    perPage: 1,
    show: { name: true, image: true, when: true, targetGroup: true, category: true, note: true, leaders: false, leaderImages: false, places: true, qr: true },
    style,
};

describe('the playlist preview', () => {
    // It builds its own stage context from the editor's; data it does not pass on is missing only
    // here, while the TV shows it (seen with the groups block on the test instance, 2026-09-29).
    it('shows the posts and groups the editor has loaded, as the TV does', () => {
        const editorContext = reactive<StageContext>({
            now: new Date('2026-10-04T08:00:00Z'),
            timeZone: 'Europe/Berlin',
            clockConfirmed: true,
            churchName: 'Gemeinde',
            appointments: [],
            posts: [post],
            groupHomepages: [{ parentGroupId: 10, groups: [group] }],
            media: new Map(),
        });
        const Host = defineComponent({
            setup() {
                provideStageContext(editorContext);
                return () =>
                    h(PlaylistPreview, {
                        slides: [makeSlide({ blocks: [postsBlock, groupsBlock] })],
                        stage: { width: 1920, height: 1920 },
                    });
            },
        });
        const wrapper = mount(Host);
        expect(wrapper.find('[data-testid="posts-card"]').text()).toContain('Biete Akkuschrauber');
        expect(wrapper.find('[data-testid="groups-card"]').text()).toContain('Kinderkirche');
        wrapper.unmount();
    });
});
