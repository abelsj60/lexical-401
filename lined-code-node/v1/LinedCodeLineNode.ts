/* eslint-disable header/header */
import type { LinedCodeTextNode } from './LinedCodeTextNode';
import type {
  LexicalNode,
  NodeKey,
  Point,
  RangeSelection,
  SerializedParagraphNode,
  Spread,
} from 'lexical';

import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  ParagraphNode,
} from 'lexical';

import {$createLinedCodeNode, $isLinedCodeNode, LinedCodeNode} from './LinedCodeNode';
import { $isLinedCodeTextNode } from './LinedCodeTextNode';
import {addClassNamesToElement, getLinesFromSelection, isTabOrSpace, removeClassNamesFromElement} from './utils';

type SerializedLinedCodeLineNode = Spread<
  {
    discreteLineClasses: string;
    type: 'code-line';
    version: 1;
  },
  SerializedParagraphNode
>;

// TS will kick a 'type'-mismatch error if we don't give it:
// a helping hand: https://stackoverflow.com/a/57211915

const TypelessParagraphNode: (new (key?: NodeKey) => ParagraphNode) &
  Omit<ParagraphNode, 'type'> = ParagraphNode;

export class LinedCodeLineNode extends TypelessParagraphNode {
  /** @internal */
  __discreteLineClasses: string;

  static getType() {
    return 'code-line';
  }

  static clone(node: LinedCodeLineNode): LinedCodeLineNode {
    return new LinedCodeLineNode(node.__discreteLineClasses, node.__key);
  }

  constructor(discreteLineClasses?: string, key?: NodeKey) {
    super(key);

    // This generally isn't set during initialization. It's set during
    // user interaction. However, it's included in the constructor
    // so .clone and .updateDOM it during reconciliation.

    this.__discreteLineClasses = discreteLineClasses || '';
  }

  createDOM(): HTMLElement {
    const self = this.getLatest();
    const codeNode = self.getParent();
    const dom = document.createElement('div');
    const discreteLineClasses = self.getDiscreteLineClasses();
    const codeLineClasses = discreteLineClasses
      .split(' ')
      .filter((cls) => cls !== '');

    if ($isLinedCodeNode(codeNode)) {
      const {lineNumbers, theme: codeNodeTheme} = codeNode.getSettings();

      if (codeNodeTheme) {
        const {line: lineClasses, numbers: numberClass} = codeNodeTheme || {};
        const { base: lineBase, extension: lineExtension } = lineClasses || {};

        if (lineBase || lineExtension) {
          if (lineBase) {
            codeLineClasses.push(lineBase);
          }

          if (lineExtension) {
            codeLineClasses.push(lineExtension);
          }
        }

        if (lineNumbers && numberClass) {
          codeLineClasses.push(numberClass);
        }
      }

      addClassNamesToElement(dom, codeLineClasses.join(' '));
      dom.setAttribute('data-line-number', `${self.getLineNumber()}`);
    }

    return dom;
  }

  updateDOM(
    prevNode: ParagraphNode | LinedCodeLineNode,
    dom: HTMLElement,
  ): boolean {
    const self = this.getLatest();
    const codeNode = self.getParent();

    const nextLineClasses = self.getDiscreteLineClasses();
    const prevLineClasses = prevNode.__discreteLineClasses as string;

    const nextLineNumber = `${self.getLineNumber()}`;
    const prevLineNumber = dom.getAttribute('data-line-number');

    if (nextLineClasses !== prevLineClasses) {
      if (prevLineClasses) {
        removeClassNamesFromElement(dom, prevLineClasses);
      }

      addClassNamesToElement(dom, nextLineClasses);
    }

    if (prevLineNumber !== nextLineNumber) {
      dom.setAttribute('data-line-number', nextLineNumber);
    }

    if ($isLinedCodeNode(codeNode)) {
      const { lineNumbers, theme: codeNodeTheme } = codeNode.getSettings();
      const { numbers: numberClass } = codeNodeTheme || {};

      if (numberClass) {
        const hasLineNumbers = dom.classList.contains(numberClass);

        if (!lineNumbers && hasLineNumbers) {
          removeClassNamesFromElement(dom, numberClass);
        }

        if (lineNumbers && !hasLineNumbers) {
          addClassNamesToElement(dom, numberClass);
        }
      }
    }

    return false;
  }

  static importJSON(
    serializedNode: SerializedLinedCodeLineNode,
  ): LinedCodeLineNode {
    const node = $createLinedCodeLineNode();
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON(): SerializedLinedCodeLineNode {
    return {
      ...super.exportJSON(),
      discreteLineClasses: this.getLatest().getDiscreteLineClasses(),
      type: 'code-line',
      version: 1,
    };
  }

  append(...nodesToAppend: LexicalNode[]): this {
    const self = this.getLatest();
    let codeNode: LinedCodeNode | null;

    const readyToAppend = nodesToAppend.reduce((ready, node) => {
      if ($isLinedCodeTextNode(node)) {
        ready.push(node);
      } else if ($isTextNode(node)) {
        codeNode = self.getParent();

        if (!$isLinedCodeNode(codeNode)) {
          // If we're here, the line's new. It hasn't been
          // appended to a CodeNode yet. We'll make one
          // so we can use its methods...

          codeNode = $createLinedCodeNode();
        }

        const code = codeNode.getHighlightNodes(node.getTextContent());
        ready.push(...code);
      }

      return ready;
    }, [] as LinedCodeTextNode[]);

    return super.append(...readyToAppend);
  }

  collapseAtStart(): boolean {
    const self = this.getLatest();
    const codeNode = self.getParent();

    if ($isLinedCodeNode(codeNode)) {
      return codeNode.collapseAtStart();
    }

    return false;
  }

  insertNewAfter(selection: RangeSelection, restoreSelection: boolean): ParagraphNode | LinedCodeLineNode {
    const codeNode = this.getLatest().getParent();

    if ($isLinedCodeNode(codeNode)) {
      if (codeNode.exitOnReturn()) {
        return codeNode.insertNewAfter();
      }

      const {
        topPoint,
        splitText = [],
        topLine: line,
      } = getLinesFromSelection(selection);

      if ($isLinedCodeLineNode(line)) {
        const writableLine = line.getWritable();
        const newLine = $createLinedCodeLineNode();
        const lineOffset = writableLine.getLineOffset(topPoint);
        const firstCharacterIndex = writableLine.getFirstCharacterIndex(lineOffset);

        if (firstCharacterIndex > 0) {
          const [textBeforeSplit] = splitText;
          const whitespace = textBeforeSplit.substring(0, firstCharacterIndex);
          const code = codeNode.getHighlightNodes(whitespace);

          newLine.append(...code);
          writableLine.insertAfter(newLine);

          // Lexical can't 'select' the a newLine's leading whitespace
          // on its own, so we'll do it in mutation listener. See
          // the LinedCodePlugin for more.

          return newLine;
        }
      }
    }

    return super.insertNewAfter(selection, restoreSelection);
  }

  selectNext(anchorOffset?: number, focusOffset?: number) {
    const self = this.getLatest();
    const isEmpty = self.isEmpty();

    if (anchorOffset !== undefined || isEmpty) {
      const selectPoint =
        typeof anchorOffset === 'number' && focusOffset === undefined;
      const selectSingleLineRange =
        typeof anchorOffset === 'number' && typeof focusOffset === 'number';

      if (isEmpty) {
        return self.selectStart();
      } else if (selectPoint) {
        const {child, childOffset} =
          self.getChildFromLineOffset(anchorOffset);

        if ($isLinedCodeTextNode(child) && typeof childOffset === 'number') {
          return child.select(childOffset, childOffset);
        }
      } else if (selectSingleLineRange) {
        const {child: aChild, childOffset: aChildOffset} =
          self.getChildFromLineOffset(anchorOffset);
        const {child: bChild, childOffset: bChildOffset} =
          self.getChildFromLineOffset(focusOffset);

        const canUseChildA = $isLinedCodeTextNode(aChild) && typeof aChildOffset === 'number';
        const canUseChildB = $isLinedCodeTextNode(bChild) && typeof bChildOffset === 'number';

        if (canUseChildA && canUseChildB) {
          const selection = $getSelection();

          if ($isRangeSelection(selection)) {
            selection.anchor.set(
              aChild.getKey(),
              aChildOffset,
              $isTextNode(aChild) ? 'text' : 'element',
            );
            selection.focus.set(
              bChild.getKey(),
              bChildOffset,
              $isTextNode(bChild) ? 'text' : 'element',
            );

            // We just set a range selection, so
            // we'll give a range selection back.

            return $getSelection() as RangeSelection;
          }
        }
      }
    }

    return super.selectNext(anchorOffset, focusOffset);
  }

  addDiscreteLineClasses(lineClasses: string): boolean {
    const self = this.getLatest();
    const writableLine = this.getWritable();
    const discreteLineClasses = self.getDiscreteLineClasses();
    const splitDiscreteLineClasses = discreteLineClasses
      .split(' ')
      .filter((cls) => cls !== '');
    const splitLineClasses = lineClasses.split(' ');
    const nextClasses = splitLineClasses.reduce((list, nextClass) => {
      const hasLineClass = splitDiscreteLineClasses.some(
        (currentClass) => {
          return currentClass === nextClass;
        },
      );

      if (!hasLineClass) {
        list.push(nextClass);
        return list;
      }

      return list;
    }, splitDiscreteLineClasses);

    if (nextClasses.length > 0) {
      writableLine.__discreteLineClasses = nextClasses.join(' ');

      return true;
    }

    return false;
  }

  removeDiscreteLineClasses(lineClasses: string): boolean {
    const self = this.getLatest();
    const writableLine = this.getWritable();
    const discreteLineClasses = self.getDiscreteLineClasses();
    const splitDiscreteLineClasses = discreteLineClasses
      .split(' ')
      .filter((cls) => cls !== '');
    let result = false;

    const nxt: string[] = [];

    splitDiscreteLineClasses.forEach((cls) => {
      const match = lineClasses.match(cls);
      if (match === null) {
        nxt.push(cls);
      }

      result = true;
    });

    writableLine.__discreteLineClasses = nxt.join(' ');

    return result;
  }

  getDiscreteLineClasses() {
    return this.getLatest().__discreteLineClasses;
  }

  getLineOffset(point: Point) {
    const pointNode = point.getNode();
    const isEmpty = $isLinedCodeLineNode(pointNode) && pointNode.isEmpty();

    if (isEmpty) {
      return 0;
    }

    const previousSiblings = point.getNode().getPreviousSiblings();

    return (
      point.offset +
      previousSiblings.reduce((offset, _node) => {
        return (offset += _node.getTextContentSize());
      }, 0)
    );
  }

  getChildFromLineOffset(lineOffset: number) {
    const self = this.getLatest();
    const children = self.getChildren<LinedCodeTextNode>();
    let childOffset = lineOffset;

    // Empty lines should have no children.

    const child = children.find((_node) => {
      const textContentSize = _node.getTextContentSize();

      if (textContentSize >= childOffset) {
        return true;
      }

      childOffset -= textContentSize;

      return false;
    });

    return {
      child: typeof child !== 'undefined' ? child : null,
      childOffset: typeof childOffset === 'number' ? childOffset : null,
    };
  }

  getFirstCharacterIndex(lineOffset?: number): number {
    const self = this.getLatest();
    const text = self.getTextContent();
    const splitText = text.slice(0, lineOffset).split('');
    const isAllSpaces = splitText.every((char) => {
      return isTabOrSpace(char);
    });

    if (isAllSpaces) return splitText.length;

    return splitText.findIndex((char) => {
      return !isTabOrSpace(char);
    });
  }

  toggleLineNumbers() {
    // cmd: TOGGLE_LINE_NUMBERS_COMMAND
    const writableCodeNode = this.getWritable();

    writableCodeNode.__lineNumbers = !writableCodeNode.__lineNumbers;

    return writableCodeNode.__lineNumbers;
  }

  canInsertTab(): boolean {
    return false;
  }

  getLineNumber() {
    return this.getLatest().getIndexWithinParent() + 1;
  }

  extractWithChild(): boolean {
    return true;
  }
}

export function $createLinedCodeLineNode(discreteLineClasses?: string) {
  return new LinedCodeLineNode(discreteLineClasses);
}

export function $isLinedCodeLineNode(
  node: LexicalNode | null | undefined,
): node is LinedCodeLineNode {
  return node instanceof LinedCodeLineNode;
}
