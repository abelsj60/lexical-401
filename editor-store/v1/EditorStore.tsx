import type {
  EditorStoreRecords,
  UseEditorStore,
} from './EditorStoreCtx';
import {
  EditorStoreCtx,
} from './EditorStoreCtx';
import * as React from 'react';
import { createEmptyHistoryState } from '@lexical/react/LexicalHistoryPlugin';

type Props = {
  children: JSX.Element | string | (JSX.Element | string)[];
};

export function EditorStore({children}: Props) {
  // don't expose the store directly. seems safer...
  const editorStore = React.useRef<EditorStoreRecords>({});

  // get
  const getEditor: UseEditorStore['getEditor'] = (storeKey) => {
    return (editorStore.current[storeKey] || {}).editor;
  };
  const getHistory: UseEditorStore['getHistory'] = (storeKey) => {
    return (editorStore.current[storeKey] || {}).historyState;
  };
  const getKeychain: UseEditorStore['getKeychain'] = () => {
    return Object.keys(editorStore.current);
  };
  const getRecord: UseEditorStore['getRecord'] = (storeKey) => {
    return editorStore.current[storeKey];
  };

  // mutate
  const addRecord: UseEditorStore['addRecord'] = (storeKey, editor, historyState) => {
    if (editorStore.current[storeKey] === undefined) {
      editorStore.current[storeKey] = {
        editor,
        historyState: historyState || createEmptyHistoryState(),
      }
    }

    return editorStore.current[storeKey];
  };
  const deleteRecord: UseEditorStore['deleteRecord'] = (storeKey) => {
    delete editorStore.current[storeKey];
  };
  const resetStore = () => {
    editorStore.current = {};
  };

  return (
    <EditorStoreCtx.Provider
      value={{
        addRecord,
        deleteRecord,
        getEditor,
        getHistory,
        getKeychain,
        getRecord,
        resetStore,
      }}>
      {children}
    </EditorStoreCtx.Provider>
  );
}
