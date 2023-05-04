/* eslint-disable header/header */
import type{LinedCodeLineNode} from './LinedCodeLineNode';
import type {LinedCodeNode} from './LinedCodeNode';
import type {
  Point,
  RangeSelection,
} from 'lexical';

import {
  $getPreviousSelection,
  $getSelection,
  $isRangeSelection,
} from 'lexical';

import {$isLinedCodeLineNode} from './LinedCodeLineNode';
import {$isLinedCodeNode} from './LinedCodeNode';
import {$isLinedCodeTextNode} from './LinedCodeTextNode';
import {
  $isEndOfLastCodeLine,
  $isStartOfFirstCodeLine,
  getLinesFromSelection,
} from './utils';

type ArrowTypes = 'KEY_ARROW_UP_COMMAND' | 'KEY_ARROW_DOWN_COMMAND';
type DentTypes = 'INDENT_CONTENT_COMMAND' | 'OUTDENT_CONTENT_COMMAND';
type MoveTypes = 'MOVE_TO_START' | 'MOVE_TO_END';

function getTextKeyForNewChildren(point: Point) {
  // The selection is set to type 'element' when the line is empty.
  // When a tab or space is added, it should be updated to type
  // 'text.' As we've taken over, it needs a helping hand.

  if (point.offset === 0) {
    const pointNode = point.getNode();

    if ($isLinedCodeLineNode(pointNode)) {
      const children = pointNode.getChildren();

      if (children.length === 1) {
        return children[0].getKey();
      }
    }
  }
}

function setPointAfterDent(
  isIndent: boolean,
  originalLineOffset: number,
  originalLineTextLength: number,
  line: LinedCodeLineNode,
  point: Point,
  position: 'top' | 'bottom',
) {
  // Note: There can be a slight delay when returning the selection
  // to 0 via the OUTDENT command. It would be nice to fix someday.
  const canUpdatePoint = isIndent
    ? line.getTextContentSize() > originalLineTextLength
    : originalLineTextLength > line.getTextContentSize();

  if (canUpdatePoint) {
    let offset = isIndent
      ? originalLineOffset + 1
      : originalLineOffset > 0
      ? originalLineOffset - 1
      : originalLineOffset;
    const {child, childOffset} = line.getChildFromLineOffset(offset);
    const isValid = child && typeof childOffset === 'number';

    if (isValid) {
      const selection = $getSelection() as RangeSelection;
      const prevSelection = $getPreviousSelection() as RangeSelection;
      const textKeyForNewChildren = getTextKeyForNewChildren(point);

      const key = textKeyForNewChildren || child.getKey();
      let type: 'text' | 'element' = 'text';
      offset = childOffset;

      // Give Lex a helping hand
      if (selection.isCollapsed()) {
        if (isIndent) {
          if (textKeyForNewChildren) {
            offset = 1;
          }
        } else {
          if (offset === 0) {
            type = 'element';
          }
        }
      }

      // Give it another hand...
      if (!selection.isCollapsed()) {
        if (position === 'top') {
          const anchorOffset = prevSelection.anchor.offset;
          const focusOffset = prevSelection.focus.offset;

          if (!selection.isBackward() && anchorOffset === 0) {
            offset = 0;
          } else if (selection.isBackward() && focusOffset === 0) {
            offset = 0;
          }
        }
      }

      point.set(key, offset, type);
    }
  }
}

function doDent(line: LinedCodeLineNode, isIndent: boolean) {
  const lineText = line.getTextContent();
  const codeNode = line.getParent() as LinedCodeNode;

  if (isIndent) {
    codeNode.replaceLineCode(`\t${lineText}`, line);
  } else {
    const hasTabOrSpaceForDelete =
      lineText.startsWith('\t') || lineText.startsWith(' ');

    if (hasTabOrSpaceForDelete) {
      codeNode.replaceLineCode(lineText.substring(1), line);
    }
  }
}

export function handleDents(type: DentTypes): boolean {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return false;
  }

  const {
    bottomLine,
    topLine,
    topPoint,
    bottomPoint,
    lineRange: linesForUpdate,
  } = getLinesFromSelection(selection);

  const isValid =
    $isLinedCodeLineNode(topLine) &&
    $isLinedCodeLineNode(bottomLine) &&
    Array.isArray(linesForUpdate);

  if (isValid) {
    const isIndent = type === 'INDENT_CONTENT_COMMAND';

    const topLineOffset = topLine.getLineOffset(topPoint);
    const bottomLineOffset = bottomLine.getLineOffset(bottomPoint);

    const topLineTextLength = topLine.getTextContentSize();
    const bottomLineTextLength = bottomLine.getTextContentSize();

    linesForUpdate.forEach((line) => doDent(line, isIndent));

    setPointAfterDent(
      isIndent,
      topLineOffset,
      topLineTextLength,
      topLine,
      topPoint,
      'top',
    );

    setPointAfterDent(
      isIndent,
      bottomLineOffset,
      bottomLineTextLength,
      bottomLine,
      bottomPoint,
      'bottom',
    );

    return true;
  }

  return false;
}

export function handleBorders(type: ArrowTypes, event: KeyboardEvent): boolean {
  const selection = $getSelection();

  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const {topLine: line} = getLinesFromSelection(selection);

  if ($isLinedCodeLineNode(line)) {
    const codeNode = line.getParent();

    if ($isLinedCodeNode(codeNode)) {
      if (!codeNode.getSettings().isBlockLocked) {
        const isArrowUp = type === 'KEY_ARROW_UP_COMMAND';

        if (isArrowUp && $isStartOfFirstCodeLine(line)) {
          if (codeNode.getPreviousSibling() === null) {
            event.preventDefault();
            // select node before codeNode
            codeNode.selectPrevious();
            return true;
          }
        } else if (!isArrowUp && $isEndOfLastCodeLine(line)) {
          if (codeNode.getNextSibling() === null) {
            event.preventDefault();
            // select node after codeNode
            codeNode.selectNext();
            return true;
          }
        }
      }
    }
  }

  return false;
}

function setMultiLineRangeWhenShiftingLines(
  topLineOffset: number,
  bottomLineOffset: number,
  topPoint: Point,
  bottomPoint: Point,
  topLine: LinedCodeLineNode,
  bottomLine: LinedCodeLineNode,
) {
  const {child: nextTopNode, childOffset: nextTopOffset} =
    topLine.getChildFromLineOffset(topLineOffset);
  const {child: nextBottomNode, childOffset: nextBottomOffset} =
    bottomLine.getChildFromLineOffset(bottomLineOffset);

  const topKey = nextTopNode !== null
    ? nextTopNode.getKey()
    : topLine.getKey();
  const topOffset = nextTopNode !== null
    ? (nextTopOffset as number)
    : 0;
  const topNodeType = nextTopNode !== null
    ? 'text'
    : 'element';

  const bottomKey = nextBottomNode !== null
    ? nextBottomNode.getKey()
    : bottomLine.getKey();
  const bottomOffset = nextBottomNode !== null
    ? (nextBottomOffset as number)
    : 0;
  const bottomNodeType = nextBottomNode !== null
    ? 'text'
    : 'element';

  topPoint.set(topKey, topOffset, topNodeType);
  bottomPoint.set(bottomKey, bottomOffset, bottomNodeType);
}

export function handleShiftingLines(
  type: ArrowTypes,
  event: KeyboardEvent,
): boolean {
  // We only care about the alt+arrow keys
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return false;
  }

  const {
    bottomPoint,
    topLine,
    bottomLine,
    topPoint,
    lineRange: linesForUpdate,
  } = getLinesFromSelection(selection);
  const isArrowUp = type === 'KEY_ARROW_UP_COMMAND';
  const isCollapsed = selection.isCollapsed();

  if ($isLinedCodeLineNode(topLine) && Array.isArray(linesForUpdate)) {
    // From here, we may not be able to be able to move the lines
    // around, but we want to return true either way to prevent
    // the event's default behavior.

    event.preventDefault();
    event.stopPropagation(); // required to stop cursor movement under Firefox

    const codeNode = topLine.getParent();

    if ($isLinedCodeNode(codeNode)) {
      const displacedLine = isArrowUp
        ? topLine.getPreviousSibling()
        : topLine.getNextSibling();
      const isEndOfBlock =
        $isLinedCodeLineNode(bottomLine) &&
        bottomLine.getKey() ===
          (codeNode.getLastChild() as LinedCodeLineNode).getKey();
      const isOutOfRoom =
        (!isArrowUp && isEndOfBlock) ||
        (isArrowUp && topLine.getPreviousSibling() === null);

      if (!isOutOfRoom && $isLinedCodeLineNode(displacedLine)) {
        const displacedLineIndex = displacedLine.getIndexWithinParent();
        const originalTopLineOffset = topLine.getLineOffset(topPoint);
        const originalBottomLineOffset =
          !isCollapsed && $isLinedCodeLineNode(bottomLine)
            ? bottomLine.getLineOffset(bottomPoint)
            : undefined;

        linesForUpdate.forEach((ln) => ln.remove());
        codeNode.splice(displacedLineIndex, 0, linesForUpdate);

        if (isCollapsed) {
          topLine.selectNext(originalTopLineOffset);
        } else {
          const isMultiLineRange =
            $isLinedCodeLineNode(bottomLine) &&
            typeof originalBottomLineOffset === 'number';

          if (isMultiLineRange) {
            setMultiLineRangeWhenShiftingLines(
              originalTopLineOffset,
              originalBottomLineOffset,
              topPoint,
              bottomPoint,
              topLine,
              bottomLine,
            );
          }
        }
      }
    }
  }

  return true;
}

export function handleMoveTo(type: MoveTypes, event: KeyboardEvent): boolean {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return false;
  }

  const {topLine: line} = getLinesFromSelection(selection);

  if ($isLinedCodeLineNode(line)) {
    const isMoveToStart = type === 'MOVE_TO_START';

    event.preventDefault();
    event.stopPropagation();

    const {topPoint} = getLinesFromSelection(selection);
    const lineOffset = line.getLineOffset(topPoint);
    const firstCharacterIndex = line.getFirstCharacterIndex(lineOffset);
    const lastCharacterIndex = line.getTextContentSize();
    const {child, childOffset} = isMoveToStart
      ? line.getChildFromLineOffset(firstCharacterIndex)
      : line.getChildFromLineOffset(lastCharacterIndex);

    if ($isLinedCodeTextNode(child)) {
      if (typeof childOffset === 'number') {
        child.select(childOffset, childOffset);
      }
    }
  }

  return true;
}
