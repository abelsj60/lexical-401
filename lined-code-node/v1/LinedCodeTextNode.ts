import {
  $createLineBreakNode,
  TextNode,
} from 'lexical';
import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedTextNode,
  Spread,
} from 'lexical';

import {$isLinedCodeNode} from './LinedCodeNode';
import {addClassNamesToElement, getHighlightThemeClass, removeClassNamesFromElement} from './utils';
import { $isLinedCodeLineNode } from './LinedCodeLineNode';

type SerializedLinedCodeTextNode = Spread<
  {
    highlightType: string | null | undefined;
    type: 'code-text';
    version: 1;
  },
  SerializedTextNode
>;

/** @noInheritDoc */
export class LinedCodeTextNode extends TextNode {
  /** @internal */
  __highlightType: string | null | undefined;

  constructor(
    text: string,
    highlightType?: string | null | undefined,
    key?: NodeKey,
  ) {
    super(text, key);
    this.__highlightType = highlightType;
  }

  static getType() {
    return 'code-text';
  }

  static clone(node: LinedCodeTextNode): LinedCodeTextNode {
    return new LinedCodeTextNode(
      node.__text,
      node.__highlightType || undefined,
      node.__key,
    );
  }

  // View

  createDOM(config: EditorConfig): HTMLElement {
    const self = this.getLatest();
    const line = self.getParent();
    let highlightClass = '';

    if ($isLinedCodeLineNode(line)) {
      const codeNode = line.getParent();
  
      if ($isLinedCodeNode(codeNode)) {
        const {theme: codeNodeTheme} = codeNode.getSettings();
        const { highlight: highlightClasses } = codeNodeTheme || {};
        
        if (highlightClasses !== undefined) {
          highlightClass = getHighlightThemeClass(
            highlightClasses,
            self.__highlightType,
          ) || '';
        }
      }
    }

    const element = super.createDOM(config);

    if (highlightClass.length > 0) {
      addClassNamesToElement(element, highlightClass);
    }

    return element;
  }

  updateDOM(
    prevNode: TextNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    const update = super.updateDOM(prevNode, dom, config);
    const self = this.getLatest();
    const line = self.getParent();

    if ($isLinedCodeLineNode(line)) {
      const codeNode = line.getParent();
  
      if ($isLinedCodeNode(codeNode)) {
        const {theme: codeNodeTheme} = codeNode.getSettings();
        const { highlight: highlightClasses } = codeNodeTheme || {};
  
        if (highlightClasses) {
          const prevHighlightClass = getHighlightThemeClass(
            highlightClasses,
            prevNode.__highlightType,
          );
          const nextHighlightClass = getHighlightThemeClass(
            highlightClasses,
            self.__highlightType,
          );
        
          if (prevHighlightClass) {
            removeClassNamesFromElement(dom, prevHighlightClass);
          }

          if (nextHighlightClass) {
            addClassNamesToElement(dom, nextHighlightClass);
          }
        }
      }
    }

    return update;
  }

  static importJSON(
    serializedNode: SerializedLinedCodeTextNode,
  ): LinedCodeTextNode {
    // note: can't fix blank strings here b/c there's no way to remove
    // the node that's being created from the function's return value
    // may be able to fix in CodeLineNode or in a core command
    const node = $createLinedCodeTextNode(
      serializedNode.text,
      serializedNode.highlightType,
    );
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);

    return node;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const {element} = super.exportDOM(editor);

    if (element) {
      const isBlankString = element.innerText === '';
      
      // If the point is at the last character of a line, Lexical
      // will create a highlightNode with a blank string ('').
      // This is no good, so we counteract it here.
      const hasPreviousSiblings = this.getPreviousSiblings().length > 0;

      if (isBlankString && hasPreviousSiblings) {
        const lineBreak = $createLineBreakNode();
        return {...lineBreak.exportDOM(editor)};
      }
    }

    return {
      element,
    };
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      highlightType: this.getLatest().getHighlightType(),
      type: 'code-text',
      version: 1,
    };
  }

  // Mutation

  // Prevent formatting (bold, underline, etc)
  setFormat(_format: number) {
    return this;
  }

  // Helpers

  getHighlightType() {
    return this.getLatest().__highlightType;
  }

  canBeEmpty() {
    return false;
  }

  canContainTabs(): boolean {
    return true;
  }
}

export function $createLinedCodeTextNode(
  text: string,
  highlightType?: string | null | undefined,
): LinedCodeTextNode {
  return new LinedCodeTextNode(text, highlightType);
}

export function $isLinedCodeTextNode(
  node: LexicalNode | LinedCodeTextNode | null | undefined,
): node is LinedCodeTextNode {
  return node instanceof LinedCodeTextNode;
}
