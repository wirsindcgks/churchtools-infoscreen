/**
 * Undo/redo as snapshots of state, not as reversible commands (decided for V1,
 * Plan.md, Offene Entscheidungen 1). A screen is a few kilobytes, so copying
 * it per step is cheap and cannot drift out of sync with the data.
 */
import { cloneJson } from './ops';

export class History<T> {
    private past: T[] = [];
    private future: T[] = [];

    constructor(private readonly limit = 100) {}

    get canUndo(): boolean {
        return this.past.length > 0;
    }

    get canRedo(): boolean {
        return this.future.length > 0;
    }

    /** Remember the state before a change. */
    record(before: T): void {
        this.past.push(cloneJson(before));
        if (this.past.length > this.limit) this.past.shift();
        this.future = [];
    }

    undo(current: T): T | null {
        const previous = this.past.pop();
        if (previous === undefined) return null;
        this.future.push(cloneJson(current));
        return previous;
    }

    redo(current: T): T | null {
        const next = this.future.pop();
        if (next === undefined) return null;
        this.past.push(cloneJson(current));
        return next;
    }

    clear(): void {
        this.past = [];
        this.future = [];
    }
}
