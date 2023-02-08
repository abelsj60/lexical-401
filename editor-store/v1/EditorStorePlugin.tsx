import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { HistoryState } from "@lexical/react/LexicalHistoryPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import React from "react";
import { useEditorStore } from "./EditorStoreCtx";

interface EditorStorePluginProps { 
  externalHistoryState?: HistoryState;
  namespace: string;
}

export function EditorStorePlugin({
  externalHistoryState,
  namespace, 
}: EditorStorePluginProps) {
  const hasRendered = React.useRef(false);
  const [editor] = useLexicalComposerContext();
  const {addRecord, getRecord} = useEditorStore();

  let editorRecord = getRecord(namespace);
  const mayBeRelocating = editorRecord !== undefined;

  if (editorRecord === undefined) {
    editorRecord = addRecord(namespace, editor, externalHistoryState);
  } 

  React.useEffect(() => {
    // On its own, relocation adds an extra and unwanted entry on the undoStack. 
    // Why? Newly mounted React-based Lexical plugins will cause their various 
    // Lexical liseners to re-register on the editor istance. The problem is 
    // transforms. They invoke 'markAllNodesDirty,' thereby causing the 
    // history package to 'push' a new entry onto the undoStack. 

    // We can prevent this by telling it to 'merge' the new entry
    // into the last on — i.e., replace it — instead.
    
    const isRelocating = mayBeRelocating && !hasRendered.current;
    if (isRelocating) editor._updateTags.add('history-merge');
    hasRendered.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HistoryPlugin 
      externalHistoryState={editorRecord.historyState} 
    />
  );
}

export function NestedEditorStorePlugin() {
  const [editor] = useLexicalComposerContext();
  const {getRecord} = useEditorStore();
  const namespace = editor._config.namespace;
  const editorRecord = getRecord(namespace);

  if (editorRecord === undefined) {
    throw new Error('No record found. Are you using the EditorStorePlugin?');
  }

  return (
    <HistoryPlugin 
      externalHistoryState={editorRecord.historyState} 
    />
  );
}
