import { inject, provide, type InjectionKey } from 'vue';
import type { Appointment } from '../appointments/normalize';
import type { MediaDoc } from '../model/schema';

/** What blocks read while rendering; the player provides it, the designer preview will too. */
export interface StageContext {
    now: Date;
    timeZone: string;
    clockConfirmed: boolean;
    churchName: string;
    /** Image service address of the church logo without size (G29); null without one. */
    churchLogo?: string | null;
    appointments: Appointment[];
    media: Map<string, MediaDoc>;
    /** Image addresses already on the device (original → blob URL); the player fills it, the designer does not. */
    images?: Map<string, string>;
}

/** The local copy of an image if there is one, else its address in ChurchTools. */
export function imageSource(context: StageContext, url: string): string {
    return context.images?.get(url) ?? url;
}

const KEY: InjectionKey<StageContext> = Symbol('stage-context');

export function provideStageContext(context: StageContext): void {
    provide(KEY, context);
}

export function useStageContext(): StageContext {
    const context = inject(KEY);
    if (!context) throw new Error('Blocks must be rendered inside a stage.');
    return context;
}
