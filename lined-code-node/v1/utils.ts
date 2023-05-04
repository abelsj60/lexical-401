/* eslint-disable header/header */
import type {LinedCodeLineNode} from './LinedCodeLineNode';
import type {LinedCodeNode, LinedCodeNodeTheme} from './LinedCodeNode';
import type {NormalizedToken, Token} from './Prism';
import type {
  GridSelection,
  LexicalNode,
  NodeSelection,
  ParagraphNode,
  Point,
  RangeSelection,
  TextNode as LexicalTextNode,
} from 'lexical';

import {
  $getSelection,
  $isRangeSelection,
} from 'lexical';

import {$isLinedCodeLineNode} from './LinedCodeLineNode';
import {$isLinedCodeNode} from './LinedCodeNode';
import {$isLinedCodeTextNode} from './LinedCodeTextNode';

type BorderPoints = {
  bottomPoint: Point;
  topPoint: Point;
};
type SelectedLines = {
  bottomLine?: LinedCodeLineNode;
  lineRange?: LinedCodeLineNode[];
  splitText?: string[];
  topLine?: LinedCodeLineNode;
};
type PartialLinesFromSelection = BorderPoints & Partial<SelectedLines>;
type LinesFromSelection = BorderPoints & SelectedLines;

function getLineFromPoint(point: Point): LinedCodeLineNode | null {
  const pointNode = point.getNode();

  if ($isLinedCodeTextNode(pointNode)) {
    return pointNode.getParent();
  } else if ($isLinedCodeLineNode(pointNode)) {
    return pointNode;
  }

  return null;
}

export function getLinesFromSelection(selection: RangeSelection) {
  const anchor = selection.anchor;
  const focus = selection.focus;

  const codeNode = $getLinedCodeNode();
  const partialLineData = {} as PartialLinesFromSelection;

  partialLineData.topPoint = selection.isBackward() ? focus : anchor;
  partialLineData.bottomPoint = selection.isBackward() ? anchor : focus;

  const topLine = getLineFromPoint(partialLineData.topPoint);
  const bottomLine = getLineFromPoint(partialLineData.bottomPoint);

  const skipLineSearch =
    !$isLinedCodeNode(codeNode) ||
    !$isLinedCodeLineNode(topLine) ||
    !$isLinedCodeLineNode(bottomLine);

  if (!skipLineSearch) {
    const start = topLine.getIndexWithinParent();
    const end = bottomLine.getIndexWithinParent() + 1;
    const lineData = Object.assign({}, partialLineData) as LinesFromSelection;

    lineData.lineRange = codeNode
      .getChildren<LinedCodeLineNode>()
      .slice(start, end);
    lineData.topLine = topLine;
    lineData.bottomLine = bottomLine;

    const topLineOffset = topLine.getLineOffset(lineData.topPoint);
    const bottomLineOffset = bottomLine.getLineOffset(lineData.bottomPoint);

    const [textBefore] = codeNode.splitLineText(topLineOffset, topLine);
    const [, textAfter] = codeNode.splitLineText(bottomLineOffset, bottomLine);

    lineData.splitText = [textBefore, textAfter];

    return lineData;
  }

  return partialLineData;
}

export function $getLinedCodeNode(): LinedCodeNode | null {
  const selection = $getSelection();

  if ($isRangeSelection(selection)) {
    const anchor = selection.anchor;
    const anchorNode = anchor.getNode();
    const parentNode = anchorNode.getParent();
    const grandparentNode = parentNode && parentNode.getParent();

    const codeNode =
      [
        anchorNode,
        parentNode,
        grandparentNode,
      ].find((node): node is LinedCodeNode => {
        return $isLinedCodeNode(node);
      });

    return codeNode || null;
  }

  return null;
}

export function isInLinedCodeNodeFamily(node: LexicalNode) {
  return $isLinedCodeTextNode(node) || $isLinedCodeLineNode(node) || $isLinedCodeNode(node);
}

export function getLinedCodeNodesFromSelection(
  selection: RangeSelection | NodeSelection | GridSelection | null
) {
  const codeSet = new Set<LinedCodeNode>();
  const linedCodeNodeFamilyNodes = selection?.getNodes().filter((node) => {
    return isInLinedCodeNodeFamily(node);
  });

  linedCodeNodeFamilyNodes?.forEach((node) => {
    if ($isLinedCodeNode(node)) {
      if (!codeSet.has(node)) {
        codeSet.add(node);
      }
    }

    if ($isLinedCodeLineNode(node)) {
      const codeNode = node.getParent();

      if ($isLinedCodeNode(codeNode)) {
        if (!codeSet.has(codeNode)) {
          codeSet.add(codeNode);
        }
      }
    }

    if ($isLinedCodeTextNode(node)) {
      const line = node.getParent();

      if ($isLinedCodeLineNode(line)) {
        const codeNode = line.getParent();

        if ($isLinedCodeNode(codeNode)) {
          if (!codeSet.has(codeNode)) {
            codeSet.add(codeNode);
          }
        }
      }
    }
  });

  return Array.from(codeSet);
}

export function getCodeNodeFromEntries(
  pointNode: LexicalNode,
  codeNodes: LinedCodeNode[]
) {
  return codeNodes.find((codeNode) => {
    const ln = getLineCarefully(pointNode);

    return codeNode.getChildren<LinedCodeLineNode>().filter((line) => {
      return ln !== null && line.getKey() === ln.getKey();
    }).length > 0
  });
}

export function $convertCodeToPlainText(
  selection: RangeSelection | NodeSelection | GridSelection | null
) {
  const codeNodes = getLinedCodeNodesFromSelection(selection);
  codeNodes.forEach((codeNode) => codeNode.convertToPlainText(true));

  return $getSelection();
}

export function $isStartOfFirstCodeLine(line: LinedCodeLineNode) {
  const selection = $getSelection();

  if ($isRangeSelection(selection)) {
    const isCollapsed = selection.isCollapsed();

    if (isCollapsed) {
      const anchorLine = selection.anchor
        .getNode()
        .getParent() as LinedCodeLineNode;
      const isLineSelected =
        selection.anchor.key === line.getKey() ||
        anchorLine.getKey() === line.getKey();

      if (isLineSelected) {
        const isFirstLine = line.getIndexWithinParent() === 0;
        return isLineSelected && isFirstLine && selection.anchor.offset === 0;
      }
    }
  }

  return false;
}

export function $isEndOfLastCodeLine(line: LinedCodeLineNode) {
  const selection = $getSelection();

  if ($isRangeSelection(selection)) {
    const anchor = selection.anchor;
    const codeNode = line.getParent();

    if ($isLinedCodeNode(codeNode)) {
      const isLastLine =
        line.getIndexWithinParent() === codeNode.getChildrenSize() - 1;

      if (isLastLine) {
        if (!line.isEmpty()) {
          const lastChild = line.getLastChild();

          if ($isLinedCodeTextNode(lastChild)) {
            const isLastChild = anchor.key === lastChild.getKey();
            const isLastOffset =
              anchor.offset === lastChild.getTextContentSize();

            return isLastChild && isLastOffset;
          }
        } else {
          return anchor.offset === 0;
        }
      }
    }
  }

  return false; // end of empty line
}

export function addOptionOrNull<T>(option: T | null) {
  const hasOption = option !== null && typeof option !== 'undefined';
  return hasOption ? option : null;
}

export function addOptionOrDefault<T1, T2>(option: T1, defaultValue: T2) {
  const finalValue = addOptionOrNull(option);
  return finalValue !== null ? finalValue : defaultValue;
}

export function isTabOrSpace(char: string) {
  const isString = typeof char === 'string';
  const isMultipleCharacters = char.length > 1;

  if (!isString || isMultipleCharacters) return false;

  return /[\t ]/.test(char);
}

export function getNormalizedTokens(
  tokens: (string | Token)[],
): NormalizedToken[] {
  return tokens.reduce((line, token) => {
    const isPlainText = typeof token === 'string';

    if (isPlainText) {
      line.push({content: token, type: undefined});
    } else {
      const {content, type} = token;

      const isStringToken = typeof content === 'string';
      const isNestedStringToken =
        Array.isArray(content) &&
        content.length === 1 &&
        typeof content[0] === 'string';
      const isNestedTokenArray = Array.isArray(content);

      if (isStringToken) {
        line.push({content: content as string, type});
      } else if (isNestedStringToken) {
        line.push({content: content[0] as string, type});
      } else if (isNestedTokenArray) {
        line.push(...getNormalizedTokens(content));
      }
    }

    return line;
  }, [] as NormalizedToken[]);
}

export function getHighlightThemeClass(
  theme: LinedCodeNodeTheme,
  highlightType: string | null | undefined,
): string | null | undefined {
  return (
    highlightType &&
    theme &&
    theme[highlightType]
  );
}

export function addClassNamesToElement(
  element: HTMLElement,
  ...classNames: Array<typeof undefined | boolean | null | string>
): void {
  classNames.forEach((className) => {
    if (typeof className === 'string') {
      const classesToAdd = className.split(' ').filter((n) => n !== '');
      element.classList.add(...classesToAdd);
    }
  });
}

export function removeClassNamesFromElement(
  element: HTMLElement,
  ...classNames: Array<typeof undefined | boolean | null | string>
): void {
  classNames.forEach((className) => {
    if (typeof className === 'string') {
      element.classList.remove(...className.split(' '));
    }
  });
}

export function getParamsToSetSelection (
  block: ParagraphNode,
  child: LexicalTextNode | null,
  offset: number | null
): [string, number, 'text' | 'element'] {
  const isEmptyLine = child === null;
  if (isEmptyLine) return [block.getKey(), 0, 'element'];
  return [child.getKey(), offset as number, 'text'];
}

export function normalizePoints(
  anchor: Point,
  focus: Point,
  isBackward: boolean
): { topPoint: Point; bottomPoint: Point } {
  return {
    bottomPoint: !isBackward ? focus : anchor,
    topPoint: !isBackward ? anchor : focus,
  }
}

export function getLineCarefully(node: LexicalNode) {
  const lineNode = $isLinedCodeTextNode(node)
    ? node.getParent() as LinedCodeLineNode
    : $isLinedCodeLineNode(node)
    ? node as LinedCodeLineNode
    : null;

  return lineNode;
}

export function $transferSelection(
  anchorOffset: number,
  focusOffset: number,
  topLine: LinedCodeLineNode | null,
  bottomLine: LinedCodeLineNode | null
) {
  const selection = $getSelection();

  if ($isRangeSelection(selection)) {
    if ($isLinedCodeLineNode(topLine)) {
      if (selection.isCollapsed()) {
        topLine.selectNext(anchorOffset);
      } else {
        if ($isLinedCodeLineNode(bottomLine)) {
          const { child: topChild, childOffset: topOffset } = topLine.getChildFromLineOffset(anchorOffset);
          const { child: bottomChild, childOffset: bottomOffset } = bottomLine.getChildFromLineOffset(focusOffset);

          selection.anchor.set(...getParamsToSetSelection(topLine, topChild, topOffset));
          selection.focus.set(...getParamsToSetSelection(bottomLine, bottomChild, bottomOffset));
        }
      }
    }
  }
}
