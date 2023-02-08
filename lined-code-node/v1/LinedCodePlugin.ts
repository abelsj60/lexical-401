import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import * as React from 'react';

import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  MOVE_TO_END,
  MOVE_TO_START,
  COMMAND_PRIORITY_EDITOR,
  KEY_TAB_COMMAND,
  PASTE_COMMAND,
  $getNodeByKey,
} from 'lexical';
import type {
  LexicalEditor,
} from 'lexical';
import {
  CHANGE_THEME_NAME_COMMAND,
  CODE_TO_PLAIN_TEXT_COMMAND,
  TOGGLE_BLOCK_LOCK_COMMAND,
  TOGGLE_LINE_NUMBERS_COMMAND,
  TOGGLE_TABS_COMMAND,
} from './Commands';
import {
  handleBorders,
  handleDents,
  handleMoveTo,
  handleShiftingLines,
} from './Handlers';
import {$isLinedCodeTextNode, LinedCodeTextNode} from './LinedCodeTextNode';
import {$isLinedCodeLineNode, LinedCodeLineNode} from './LinedCodeLineNode';
import {$isLinedCodeNode, LinedCodeNode} from './LinedCodeNode';
import {$getLinedCodeNode, $getLinesFromSelection} from './utils';

function removeHighlightsWithNoTextAfterImportJSON(
  highlightNode: LinedCodeTextNode,
) {
  // needed because exportJSON may export an empty highlight node when
  // it has a length of one. exportDOM has been fixed via PR. But...
  // exportJSON seems harder to fix, so i'm handling it here. also
  // note, i can't fix it in a 'created' mutation because this
  // seems to kill history (it dies after .remove runs).
  const isBlankString = highlightNode.getTextContent() === '';

  if (isBlankString) {
    highlightNode.remove();
  }
}

function updateHighlightsWhenTyping(highlightNode: LinedCodeTextNode) {
  const selection = $getSelection();

  if ($isRangeSelection(selection)) {
    const line = highlightNode.getParent();

    if ($isLinedCodeLineNode(line)) {
      const codeNode = line.getParent();

      if ($isLinedCodeNode(codeNode)) {
        if (!codeNode.isLineCurrent(line)) {
          const {topPoint} = $getLinesFromSelection(selection);
          // Get lineOffset before update. It may change...
          const lineOffset = line.getLineOffset(topPoint);
          
          if (codeNode.updateLineCode(line)) {
            const nextSelection = $getSelection();
            
            if ($isRangeSelection(nextSelection)) {
              const anchorNode = nextSelection.anchor.getNode();
              // New same-line text nodes are assigned a temporary
              // CodeNode parent here. Apparently, Lines will be
              // parent here if added via Enter key.

              if ($isLinedCodeNode(anchorNode.getParent())) {
                // Selection gets lost when an existing toke/highlight node
                // changes due to character insertion. Figuring out why
                // it doesn't track properly is a rigamarole. This is
                // the alternative — manual update.

                line.selectNext(lineOffset);
              }
            }
          }
        }
      }
    }
  }
}

export function registerLinedCodeListeners(editor: LexicalEditor) {
  if (!editor.hasNodes([LinedCodeNode, LinedCodeLineNode, LinedCodeTextNode])) {
    throw new Error(
      'CodeHighlightPlugin: LinedCodeNode, LinedCodeLineNode, or LinedCodeTextNode not registered on editor',
    );
  }

  return mergeRegister(
    editor.registerNodeTransform(LinedCodeTextNode, (node) => {
      const codeNode = $getLinedCodeNode();

      if ($isLinedCodeNode(codeNode)) {
        // Unlike the official CodeNode, this version's uses an
        // updateLineCode method that rejects if the calling
        // line is up-to-date, i.e., it's self-managing.

        // Thus, we don't need to pass skipTransforms via a
        // nested editor update here.

        updateHighlightsWhenTyping(node);
        removeHighlightsWithNoTextAfterImportJSON(node);
      }
    }),
    editor.registerMutationListener(LinedCodeNode, (mutations) => {
      editor.update(() => {
        // We should never select a LinedCodeNode if it has a line
        // in it, which it always should! 
        
        // An example of this bug can be seen in @lexical/markdown. 
        // It will select the LinedCodeNode when passed triple 
        // ticks with a space. This wards the bug off.
        
        for (const [key, type] of mutations) {
          const selection = $getSelection();

          if ($isRangeSelection(selection)) {
            // not currently testing focus or !isCollapsed()
            const anchorKey = selection.anchor.key;
            
            if (anchorKey === key) {
              if (type === 'created') {
                const node = $getNodeByKey(key);
      
                if ($isLinedCodeNode(node)) {
                  const startingLine = node.getFirstChild();
                  
                  if ($isLinedCodeLineNode(startingLine)) {
                    startingLine.selectNext(0);
                  }
                }
              }
            }
          }
        }
      });
    }),
    editor.registerMutationListener(LinedCodeLineNode, (mutations) => {
      editor.update(() => {
        for (const [key, type] of mutations) {
          // Resolves inability to select the end of an indent 
          // when creating a new line via .insertNewAfter().
          if (type === 'created') {
            const node = $getNodeByKey(key);
  
            if ($isLinedCodeLineNode(node)) {
              const firstChild = node.getFirstChild();
              
              if ($isLinedCodeTextNode(firstChild)) {
                const line = firstChild.getParent() as LinedCodeLineNode;
                const firstCharacterIndex = line.getFirstCharacterIndex();
                
                if (firstCharacterIndex > 0) {
                  firstChild.select(firstCharacterIndex, firstCharacterIndex);
                }
              }
            }
          }
        }
      });
    }),
    editor.registerCommand(
      CHANGE_THEME_NAME_COMMAND,
      (payload) => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          codeNode.changeThemeName(payload);
        }

        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      CODE_TO_PLAIN_TEXT_COMMAND,
      (payload) => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          codeNode.convertToPlainText(payload);
        }

        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      TOGGLE_BLOCK_LOCK_COMMAND,
      () => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          codeNode.toggleBlockLock();
        }

        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      TOGGLE_LINE_NUMBERS_COMMAND,
      () => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          const lines = codeNode.getChildren<LinedCodeLineNode>();
          lines.forEach((line) => line.toggleLineNumbers());
          codeNode.toggleLineNumbers();
        }

        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      TOGGLE_TABS_COMMAND,
      () => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          codeNode.toggleTabs();
        }

        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      PASTE_COMMAND,
      (payload) => {
        const clipboardData =
          payload instanceof InputEvent || payload instanceof KeyboardEvent
            ? null
            : payload.clipboardData;
        const codeNode = $getLinedCodeNode();
        const isPasteInternal =
          $isLinedCodeNode(codeNode) && clipboardData !== null;

        if (isPasteInternal) {
          // overrides pasting inside an active code node ("internal pasting")
          return codeNode.insertClipboardData_INTERNAL(clipboardData, editor);
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_TAB_COMMAND,
      (payload) => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          if (codeNode.getSettings().activateTabs) {
            const selection = $getSelection();

            if ($isRangeSelection(selection)) {
              payload.preventDefault();

              return handleDents(
                payload.shiftKey
                  ? 'OUTDENT_CONTENT_COMMAND'
                  : 'INDENT_CONTENT_COMMAND',
              );
            }
          }
        }

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (payload) => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          if (!payload.altKey) {
            return handleBorders('KEY_ARROW_UP_COMMAND', payload);
          } else {
            return handleShiftingLines('KEY_ARROW_UP_COMMAND', payload);
          }
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (payload) => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          if (!payload.altKey) {
            return handleBorders('KEY_ARROW_DOWN_COMMAND', payload);
          } else {
            return handleShiftingLines('KEY_ARROW_DOWN_COMMAND', payload);
          }
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      MOVE_TO_END,
      (payload) => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          return handleMoveTo('MOVE_TO_END', payload);
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      MOVE_TO_START,
      (payload) => {
        const codeNode = $getLinedCodeNode();

        if ($isLinedCodeNode(codeNode)) {
          return handleMoveTo('MOVE_TO_START', payload);
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
  );
}

export default function LinedCodePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    return registerLinedCodeListeners(editor);
  }, [editor]);

  return null;
}

type Func = () => void;
export function mergeRegister(...func: Array<Func>): () => void {
  return () => {
    func.forEach((f) => f());
  };
}
