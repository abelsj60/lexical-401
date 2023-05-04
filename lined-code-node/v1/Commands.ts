/* eslint-disable header/header */
import type {LexicalCommand} from 'lexical';

import {createCommand} from 'lexical';

// LinedCodeNode
export const CHANGE_THEME_NAME_COMMAND: LexicalCommand<string> = createCommand('CHANGE_THEME_NAME_COMMAND');
export const CODE_TO_PLAIN_TEXT_COMMAND: LexicalCommand<boolean | undefined> = createCommand('CODE_TO_PLAIN_TEXT_COMMAND');
export const SET_LANGUAGE_COMMAND: LexicalCommand<string> = createCommand('SET_LANGUAGE_COMMAND');
export const TOGGLE_BLOCK_LOCK_COMMAND: LexicalCommand<void> = createCommand('TOGGLE_BLOCK_LOCK_COMMAND');
export const TOGGLE_LINE_NUMBERS_COMMAND: LexicalCommand<void> = createCommand('TOGGLE_LINE_NUMBERS_COMMAND');
export const TOGGLE_TABS_COMMAND: LexicalCommand<void> = createCommand('TOGGLE_TABS_COMMAND');

// LinedCodeLineNode
export const ADD_DISCRETE_LINE_CLASS: LexicalCommand<string> = createCommand('ADD_DISCRETE_LINE_CLASS');
export const REMOVE_DISCRETE_LINE_CLASS: LexicalCommand<string> = createCommand('REMOVE_DISCRETE_LINE_CLASS');
