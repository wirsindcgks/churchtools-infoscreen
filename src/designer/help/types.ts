/** One explained setting of a topic: the label of its row and what it does. */
export interface HelpItem {
    term: string;
    text: string;
}

/** What the help bar shows for one part of the inspector (Plan.md 98): an introduction (paragraphs split by a blank line) and an explanation per setting. */
export interface HelpTopic {
    intro?: string;
    items?: HelpItem[];
}

/** A topic with its place in the bar: the id of the section it belongs to (or `general`) and its title. */
export interface HelpSection {
    id: string;
    title: string;
    topic: HelpTopic;
}

/** Whether a topic says anything at all; a section without words has no "?". */
export function hasHelp(topic: HelpTopic | undefined): topic is HelpTopic {
    return !!topic && (!!topic.intro?.trim() || !!topic.items?.length);
}
