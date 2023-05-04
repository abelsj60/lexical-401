/* eslint-disable header/header */
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-objectivec';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-swift';

import * as Prism from 'prismjs';

export interface Token {
  type: string;
  content: string | Token | (string | Token)[];
}

export interface NormalizedToken {
  type: string | undefined;
  content: string;
}

export interface Tokenizer {
  tokenize(text: string, language?: string): (string | Token)[];
}

interface Map {
  [key: string]: string | undefined
}

// Map format: { value: label }
//  - Don't include it if you haven't imported it!
//  - Keys should match the library's internal key/import...

export const DEFAULT_CODE_LANGUAGE = 'javascript (default)';
export const codeLanguageMap: Map = {
  [DEFAULT_CODE_LANGUAGE]: 'JavaScript (default)',
  c: 'C',
  clike: 'C-like',
  css: 'CSS',
  html: 'HTML',
  javascript: 'JavaScript',
  js: 'JavaScript',
  markdown: 'Markdown',
  markup: 'Markup',
  objectivec: 'Objective-C',
  python: 'Python',
  rust: 'Rust',
  sql: 'SQL',
  swift: 'Swift',
};

export const getCodeLanguage = (language: keyof typeof codeLanguageMap | string | null | undefined) => {
  const hasValue = language !== undefined && language !== null && typeof language !== 'number';
  const isMappedLanguage = hasValue && codeLanguageMap[language] !== undefined;
  if (isMappedLanguage) return language;
  return DEFAULT_CODE_LANGUAGE;
};

export const PrismTokenizer: Tokenizer = {
  tokenize(text: string, language: string): (string | Token)[] {
    return Prism.tokenize(text, Prism.languages[language !== DEFAULT_CODE_LANGUAGE ? language : 'javascript']);
  },
};
