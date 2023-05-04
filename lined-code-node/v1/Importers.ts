/* eslint-disable header/header */
import type {DOMConversionOutput} from 'lexical';

import {$createLinedCodeNode} from './LinedCodeNode';

export function convertPreElement(domNode: Node): DOMConversionOutput {
  // domNode is a <pre> since we matched it by nodeName
  const pre = domNode as HTMLPreElement;
  const preChildren = pre.childNodes;
  let rawLines = preChildren;

  if (preChildren[0].nodeName.toLowerCase() === 'code') {
    rawLines = preChildren[0].childNodes;
  }

  const codeNode = $createLinedCodeNode();
  const rawText = codeNode.getRawText(rawLines);
  const codeLines = codeNode.createCodeLines(rawText);

  codeNode.append(...codeLines);

  return {
    forChild: () => null,
    node: codeNode,
    preformatted: true,
  };
}

export function convertDivElement(domNode: Node): DOMConversionOutput {
  // domNode is a <div> since we matched it by nodeName
  const div = domNode as HTMLDivElement;
  const codeNode = $createLinedCodeNode();
  const rawText = codeNode.getRawText(div.childNodes);
  const codeLines = codeNode.createCodeLines(rawText);

  codeNode.append(...codeLines);

  return {
    forChild: () => null,
    node: codeNode,
    preformatted: true,
  };
}

export function convertTableElement(domNode: Node): DOMConversionOutput {
  // domNode is a <table> since we matched it by nodeName
  const table = domNode as HTMLTableElement;
  const codeNode = $createLinedCodeNode();

  if (table.textContent) {
    const tableRows = table.getElementsByTagName('tr');
    const rawText = codeNode.getRawText(tableRows);
    const codeLines = codeNode.createCodeLines(rawText);

    codeNode.append(...codeLines);
  }

  return {
    forChild: () => null,
    node: codeNode,
    preformatted: true,
  };
}

export function isCodeElement(div: HTMLDivElement): boolean {
  return div.style.fontFamily.match('monospace') !== null;
}

export function isGitHubCodeTable(
  table: HTMLTableElement,
): table is HTMLTableElement {
  return table.classList.contains('js-file-line-container');
}
