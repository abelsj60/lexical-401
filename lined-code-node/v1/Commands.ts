import type {LexicalCommand} from 'lexical';
import {createCommand} from 'lexical';

// LinedCodeNode
export const CHANGE_THEME_NAME_COMMAND: LexicalCommand<string> = createCommand();
export const CODE_TO_PLAIN_TEXT_COMMAND: LexicalCommand<boolean | undefined> = createCommand();
export const SET_LANGUAGE_COMMAND: LexicalCommand<string> = createCommand();
export const TOGGLE_BLOCK_LOCK_COMMAND: LexicalCommand<void> = createCommand();
export const TOGGLE_LINE_NUMBERS_COMMAND: LexicalCommand<void> = createCommand();
export const TOGGLE_TABS_COMMAND: LexicalCommand<void> = createCommand();

// LinedCodeLineNode
export const ADD_DISCRETE_LINE_CLASS: LexicalCommand<string> = createCommand();
export const REMOVE_DISCRETE_LINE_CLASS: LexicalCommand<string> = createCommand();
