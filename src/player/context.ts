import { inject, provide, type InjectionKey } from 'vue';
import type { Appointment } from '../appointments/normalize';
import type { MediaDoc } from '../model/schema';

/** What blocks read while rendering; the player provides it, the designer preview will too. */
export interface StageContext {
    now: Date;
    timeZone: string;
    clockConfirmed: boolean;
    churchName: string;
    appointments: Appointment[];
    media: Map<string, MediaDoc>;
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
