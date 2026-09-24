/**
 * Hand-written subset of the ChurchTools API types.
 *
 * Temporary: replaced by the generated snapshot `ct-types.d.ts` once Custom
 * Modules are enabled on the test instance (Preparation.md, B5). Only fields
 * this code actually reads belong here.
 */
export interface Person {
    id: number;
    firstName: string;
    lastName: string;
}
