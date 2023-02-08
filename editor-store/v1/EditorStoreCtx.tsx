import type {HistoryState} from '@lexical/react/LexicalHistoryPlugin';
import type {LexicalEditor} from 'lexical';

import * as React from 'react';

export type EditorStoreRecord = {
  editor: LexicalEditor; // top-level editor contains nested editor references
  historyState: HistoryState | undefined;
};
export type EditorStoreRecords = Record<string, EditorStoreRecord>;

type EditorStoreGetters = {
  getEditor: (storeKey: string) => LexicalEditor | undefined;
  getHistory: (
    storeKey: string,
  ) => HistoryState | undefined;
  getRecord: (
    storeKey: string,
  ) => EditorStoreRecord | undefined;
  getKeychain: () => string[];
};
type EditorStoreMutations = {
  deleteRecord: (storeKey: string) => void; 
  addRecord: (
    storeKey: string, 
    editor: LexicalEditor, 
    historyState?: HistoryState
  ) => EditorStoreRecord; 
  resetStore: () => void;
};

export type UseEditorStore = EditorStoreGetters & EditorStoreMutations;

export const EditorStoreCtx: React.Context<UseEditorStore> =
  React.createContext<UseEditorStore>({} as UseEditorStore);

export function useEditorStore(): UseEditorStore {
  return React.useContext(EditorStoreCtx);
}
