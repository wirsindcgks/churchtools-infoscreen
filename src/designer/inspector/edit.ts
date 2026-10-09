import { useEditorStore } from '../editor-store';

/** Field edits are gestures: all keystrokes in one field are one undo step. */
export function useEdit(): { onFocus: () => void; onBlur: () => void } {
    const editor = useEditorStore();
    return { onFocus: () => editor.beginGesture(), onBlur: () => editor.endGesture() };
}
