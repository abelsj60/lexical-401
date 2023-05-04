/* eslint-disable header/header */
import type {
  LinedCodeLineNode,
} from './LinedCodeLineNode';
import type {LinedCodeTextNode} from './LinedCodeTextNode';
import type {NormalizedToken, Token, Tokenizer} from './Prism';
import type {SerializedCodeNode} from '@lexical/code';
import type {
  DOMConversionMap,
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  ParagraphNode,
  RangeSelection,
  Spread,
  TextNode as LexicalTextNode,
} from 'lexical';

import { $generateNodesFromSerializedNodes } from '@lexical/clipboard';
import {CodeNode} from '@lexical/code';
import { $generateNodesFromDOM } from '@lexical/html';
import { $setBlocksType } from '@lexical/selection';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  $isTextNode} from 'lexical';
import { EditorThemeClassName } from 'packages/lexical/src/LexicalEditor';

import {
  convertDivElement,
  convertPreElement,
  convertTableElement,
  isCodeElement,
  isGitHubCodeTable,
} from './Importers';
import {
  $createLinedCodeLineNode,
  $isLinedCodeLineNode,
} from './LinedCodeLineNode';
import {$createLinedCodeTextNode} from './LinedCodeTextNode';
import {getCodeLanguage} from './Prism';
import {
  $transferSelection,
  addClassNamesToElement,
  addOptionOrNull,
  getCodeNodeFromEntries,
  getLineCarefully,
  getLinedCodeNodesFromSelection,
  getLinesFromSelection,
  getNormalizedTokens,
  getParamsToSetSelection,
  normalizePoints,
  removeClassNamesFromElement,
} from './utils';

export interface LinedCodeNodeOptions {
  activateTabs?: boolean | null;
  defaultLanguage?: string | null;
  initialLanguage?: string | null;
  isBlockLocked?: boolean | null;
  lineNumbers?: boolean | null;
  theme?: LinedCodeNodeTheme | null;
  themeName?: string | null;
  tokenizer?: Tokenizer | null;
}

export interface LinedCodeNodeTheme {
  block?: {
    base?: EditorThemeClassName;
    extension?: EditorThemeClassName;
  };
  line?: {
    base?: EditorThemeClassName;
    extension?: EditorThemeClassName;
  };
  numbers?: EditorThemeClassName;
  highlights?: Record<string, EditorThemeClassName>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // makes TS very happy
}

export interface LinedCodeNodeOptions_Serializable extends LinedCodeNodeOptions {
  tokenizer: null;
}

type SerializedLinedCodeNode = Spread<
  {
    options: LinedCodeNodeOptions_Serializable;
    type: 'code-node';
    version: 1;
  },
  SerializedCodeNode
>;

const LANGUAGE_DATA_ATTRIBUTE = 'data-highlight-language';

// TS will kick an error about the SerializedCodeNode not having
// the options property. Let's give it a judicious helping
// hand: https://stackoverflow.com/a/57211915

const TypelessCodeNode: (new (key?: NodeKey) => CodeNode) &
  Omit<CodeNode, 'type'> = CodeNode;

export class LinedCodeNode extends TypelessCodeNode {
  /** @internal */
  __activateTabs: boolean | null;
  /** @internal */
  __defaultLanguage: string | null;
  /** @internal */
  __isLockedBlock: boolean | null;
  /** @internal */
  __language: string | null;
  /** @internal */
  __lineNumbers: boolean | null;
  /** @internal */
  __theme: LinedCodeNodeTheme | null;
  /** @internal */
  __themeName: string | null;
  /** @internal */
  __tokenizer: Tokenizer | null;

  static getType() {
    return 'code-node';
  }

  static clone(node: LinedCodeNode): LinedCodeNode {
    return new LinedCodeNode(node.getSettingsForCloning(), node.__key);
  }

  constructor(options?: LinedCodeNodeOptions, key?: NodeKey) {
    const {
      activateTabs,
      defaultLanguage,
      isBlockLocked,
      initialLanguage,
      lineNumbers,
      theme,
      themeName,
      tokenizer,
    } = options || {};

    super(key);

    // LINED-CODE-NODE SETTINGS
    //  First invocation: Temporary w/null for falsies
    //  Second invocation: Final values (set by override)

    //  Override API priority order:
    //    1. initial values from the node's first invocation
    //    2. values passed to override API, AKA defaultValues
    //    3. fallback values baked directly into the override

    this.__activateTabs = addOptionOrNull(activateTabs);
    this.__defaultLanguage = addOptionOrNull(
      getCodeLanguage(defaultLanguage),
    );
    this.__isLockedBlock = addOptionOrNull(isBlockLocked);
    this.__language = addOptionOrNull(
      getCodeLanguage(initialLanguage),
    );
    this.__lineNumbers = addOptionOrNull(lineNumbers);
    this.__theme = addOptionOrNull(theme);
    this.__themeName = addOptionOrNull(themeName);
    this.__tokenizer = addOptionOrNull(tokenizer);
  }

  getTag() {
    return 'code';
  }

  createDOM(): HTMLElement {
    const self = this.getLatest();
    const dom = document.createElement('code');
    const {language, lineNumbers, theme: codeNodeTheme, themeName} = self.getSettings();

    if (codeNodeTheme) {
      const { block: blockClasses, numbers: numberClass } = codeNodeTheme;
      const { base: blockBase, extension: blockExtension } = blockClasses || {};
      const codeNodeClasses = [];

      if (blockBase || blockExtension) {
        if (blockBase) {
          codeNodeClasses.push(blockBase);
        }

        if (blockExtension) {
          codeNodeClasses.push(blockExtension);
        }
      }

      if (lineNumbers && numberClass) {
        codeNodeClasses.push(numberClass);
      }

      if (themeName) {
        codeNodeClasses.push(themeName);
      }

      if (codeNodeClasses.length > 0) {
        addClassNamesToElement(dom, codeNodeClasses.join(' '));
      }
    }

    if (language) {
      dom.setAttribute(LANGUAGE_DATA_ATTRIBUTE, language);
    }

    dom.setAttribute('spellcheck', 'false');

    return dom;
  }

  updateDOM(
    prevNode: CodeNode | LinedCodeNode,
    dom: HTMLElement,
  ): boolean {
    const self = this.getLatest();
    const language = self.getLanguage();
    const prevLanguage = prevNode.getLanguage();

    // Why not use the getter? Well, because the getter uses .getLatest(),
    // which in this case, gets us the current value. So? We cheat!

    const prevThemeName = prevNode.__themeName;
    const prevLineNumbers = prevNode.__lineNumbers;
    const {lineNumbers, theme: codeNodeTheme, themeName} = self.getSettings();
    const { numbers: numberClass } = codeNodeTheme || {};

    if (lineNumbers !== prevLineNumbers) {
      if (!lineNumbers) {
        removeClassNamesFromElement(dom, numberClass);
      }

      if (lineNumbers) {
        addClassNamesToElement(dom, numberClass);
      }
    }

    if (prevThemeName !== themeName) {
      if (prevThemeName) {
        removeClassNamesFromElement(dom, prevThemeName);
      }

      addClassNamesToElement(dom, themeName);
    }

    if (language !== null && language !== prevLanguage) {
      dom.setAttribute(LANGUAGE_DATA_ATTRIBUTE, language);
    }

    return false;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const {element} = super.exportDOM(editor);

    return {
      element,
    };
  }

  static importDOM(): DOMConversionMap {
    // When dealing with code, we'll let the top-level conversion
    // function handle text. To make this work, we'll also use
    // the 'forChild' callbacks to remove child text nodes.

    return {
      // Typically <pre> is used for code blocks, and <code> for inline code styles
      // but if it's a multi line <code> we'll create a block. Pass through to
      // inline format handled by TextNode otherwise.

      code: (node: Node) => {
        const hasPreElementParent =
          node.parentElement instanceof HTMLPreElement; // let the pre property deal with it below!
        const isMultiLineCodeElement =
          node.textContent != null && /\r?\n/.test(node.textContent);

        if (!hasPreElementParent && isMultiLineCodeElement) {
          return {
            conversion: convertPreElement,
            priority: 2,
          };
        }

        return null;
      },
      div: (node: Node) => {
        const isCode = isCodeElement(node as HTMLDivElement); // domNode is a <div> since we matched it by nodeName

        if (isCode) {
          return {
            conversion: convertDivElement,
            priority: 2,
          };
        }

        return null;
      },
      pre: (node: Node) => {
        const isPreElement = node instanceof HTMLPreElement; // domNode is a <pre> element since we matched it by nodeName

        if (isPreElement) {
          return {
            conversion: convertPreElement,
            priority: 1,
          };
        }

        return null;
      },
      table: (node: Node) => {
        const table = node; // domNode is a <table> since we matched it by nodeName

        if (isGitHubCodeTable(table as HTMLTableElement)) {
          return {
            conversion: convertTableElement,
            priority: 4,
          };
        }

        return null;
      },
    };
  }

  static importJSON(serializedNode: SerializedLinedCodeNode): LinedCodeNode {
    const node = $createLinedCodeNode(serializedNode.options);
    node.setFormat(serializedNode.format); // ??
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      options: this.getLatest().getSettingsForExportJSON(),
      type: 'code-node' as 'code', // not cool, but TS says necessary!
      version: 1 as const, // ridiculous, but TS also says necessary!
    };
  }

  insertNewAfter(): ParagraphNode {
    const writableCodeNode = this.getWritable();
    const lastLine = writableCodeNode.getLastChild() as LinedCodeLineNode;
    const prevLine = lastLine.getPreviousSibling() as LinedCodeLineNode;
    const paragraph = $createParagraphNode();

    paragraph.setDirection(writableCodeNode.getDirection());
    prevLine.remove();

    // leave at least one line
    if (writableCodeNode.getChildrenSize() > 1) {
      lastLine.remove();
    }

    writableCodeNode.insertAfter(paragraph);
    paragraph.selectStart();

    return paragraph;
  }

  append(...nodesToAppend: LexicalNode[]): this {
    const writableCodeNode = this.getWritable();
    let readyToAppend = nodesToAppend.reduce((ready, node) => {
      if ($isTextNode(node)) {
        const rawText = writableCodeNode.getRawText([node]);
        ready.push(...writableCodeNode.createCodeLines(rawText));
      } else if ($isLinedCodeLineNode(node)) {
        ready.push(node);
      }

      return ready;
    }, [] as LinedCodeLineNode[]);

    if (writableCodeNode.getChildrenSize() === 1) {
      if (readyToAppend.length > 0) {
        const startingLine = writableCodeNode.getFirstChild();

        if ($isLinedCodeLineNode(startingLine)) {
          if (startingLine.isEmpty()) {
            const newText = readyToAppend[0].getTextContent();

            // While .replace seems to lose the text here,
            // .replaceLineCode doesn't. I'll take it.

            writableCodeNode.replaceLineCode(newText, startingLine);
            readyToAppend = readyToAppend.slice(1);
          }
        }
      }
    }

    return super.append(...readyToAppend);
  }

  replaceLineCode(text: string, line: LinedCodeLineNode): LinedCodeLineNode {
    const self = this.getLatest();
    const code = self.getHighlightNodes(text);
    const writableLine = line.getWritable();

    writableLine.splice(0, writableLine.getChildrenSize(), code);

    return writableLine;
  }

  updateLineCode(line: LinedCodeLineNode): boolean {
    // call .isCurrent() first!
    const self = this.getLatest();
    const writableLine = line.getWritable();
    const text = writableLine.getTextContent();

    if (text.length > 0) {
      // Lines are short, we'll just replace our
      // nodes for now. Can optimize later.

      self.replaceLineCode(text, writableLine);
      return true;
    }

    return false;
  }

  createCodeLines(rawText: string): LinedCodeLineNode[] {
    return rawText.split(/\r?\n/g).reduce((lines, line) => {
      const newLine = $createLinedCodeLineNode();
      const code = this.getLatest().getHighlightNodes(line);

      newLine.append(...code);
      lines.push(newLine);

      return lines;
    }, [] as LinedCodeLineNode[]);
  }

  convertToPlainText(updateSelection?: boolean): boolean {
    // Could ditch updateSelection toggle...?
    const writableRoot = $getRoot().getWritable();

    if ($isRootNode(writableRoot)) {
      const writableCodeNode = this.getWritable();
      const children = writableCodeNode.getChildren();
      const index = writableCodeNode.getIndexWithinParent();
      const rawText = writableCodeNode.getRawText(children);

      let topLineIndex = -1;
      let topLineOffset = -1;

      let bottomLineIndex = -1;
      let bottomLineOffset = -1;

      // 1. Save the last node/selection data so we can update it later.

      if (updateSelection) {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          const { anchor, focus } = selection;
          const isBackward = selection.isBackward();

          const {topPoint, bottomPoint} = normalizePoints(anchor, focus, isBackward);
          const topNode = topPoint.getNode();
          const bottomNode = bottomPoint.getNode();

          const codeNodes = getLinedCodeNodesFromSelection($getSelection());
          const topCodeNode = getCodeNodeFromEntries(topNode, codeNodes);
          const bottomCodeNode = getCodeNodeFromEntries(bottomNode, codeNodes);

          if (topCodeNode) {
            const topLine = getLineCarefully(topNode);

            if ($isLinedCodeLineNode(topLine)) {
              topLineOffset = topLine.getLineOffset(topPoint);
              topLineIndex = topLine.getIndexWithinParent();

              if (!bottomCodeNode && topCodeNode === bottomCodeNode) {
                bottomLineOffset = topLineOffset;
                bottomLineIndex = topLineIndex;
              }
            }
          }

          if (bottomCodeNode) {
            const bottomLine = getLineCarefully(bottomNode);

            if ($isLinedCodeLineNode(bottomLine)) {
              bottomLineOffset = bottomLine.getLineOffset(bottomPoint);
              bottomLineIndex = bottomLine.getIndexWithinParent();
            }
          }
        }
      }

      // 2. Remove the old CodeNode, build new paragraphs, and splice into place.

      writableCodeNode.remove();

      const paragraphs = rawText.split('\n').reduce((lines, line) => {
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode(line || '');

        paragraph.append(textNode);
        lines.push(paragraph);

        return lines;
      }, [] as ParagraphNode[]);

      writableRoot.splice(index, 0, paragraphs);

      // 3. When called upon, we can now restore the selection!

      if (updateSelection) {
        const nextSelection = $getSelection();

        if ($isRangeSelection(nextSelection)) {
          // Get a new selection. It's stale after .remove and the Root
          // had a different state when we got the last one...

          const { anchor, focus } = nextSelection;
          const isNextSelectionBackward = nextSelection.isBackward();
          const {
            topPoint: nextTopPoint,
            bottomPoint: nextBottomPoint
          } = normalizePoints(anchor, focus, isNextSelectionBackward);

          if (topLineOffset > -1) {
            const paragraph = paragraphs[topLineIndex];
            const textNode = paragraph.getFirstChild<LexicalTextNode>();
            nextTopPoint.set(...getParamsToSetSelection(paragraph, textNode, topLineOffset));
          }

          if (bottomLineOffset > -1) {
            const paragraph = paragraphs[bottomLineIndex];
            const textNode = paragraph.getFirstChild<LexicalTextNode>();
            nextBottomPoint.set(...getParamsToSetSelection(paragraph, textNode, bottomLineOffset));
          }
        }
      }

      return true;
    }

    return false;
  }

  collapseAtStart() {
    const writableCodeNode = this.getWritable();

    if (!writableCodeNode.getSettings().isBlockLocked) {
      writableCodeNode.convertToPlainText(true);
    }

    return true;
  }

  insertClipboardData_INTERNAL(
    dataTransfer: DataTransfer,
    editor: LexicalEditor,
  ): boolean {
    const writableCodeNode = this.getWritable();
    const htmlString = dataTransfer.getData('text/html');
    const lexicalString = dataTransfer.getData('application/x-lexical-editor');
    const plainString = dataTransfer.getData('text/plain');

    if (htmlString || lexicalString || plainString) {
      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        const {
          topLine: line,
          lineRange: linesForUpdate,
          splitText,
        } = getLinesFromSelection(selection);

        if ($isLinedCodeLineNode(line)) {
          const lexicalNodes: LexicalNode[] = [];

          if (lexicalString) {
            const {nodes} = JSON.parse(lexicalString);
            lexicalNodes.push(...$generateNodesFromSerializedNodes(nodes));
          } else if (htmlString) {
            const parser = new DOMParser();
            const dom = parser.parseFromString(htmlString, 'text/html');
            lexicalNodes.push(...$generateNodesFromDOM(editor, dom));
          } else {
            lexicalNodes.push($createTextNode(plainString));
          }

          const originalLineIndex = line.getIndexWithinParent();
          const [textBeforeSplit, textAfterSplit] = splitText as string[];

          // Use LexicalNodes here to avoid double linebreaks (\n\n).
          // (CodeNode.getTextContent() inserts double breaks...)

          const normalizedNodesFromPaste = $isLinedCodeNode(lexicalNodes[0])
            ? lexicalNodes[0].getChildren()
            : lexicalNodes;

          const rawText = writableCodeNode.getRawText(
            normalizedNodesFromPaste,
            textBeforeSplit,
            textAfterSplit,
          );
          const startIndex = originalLineIndex;
          const deleteCount = (linesForUpdate as LinedCodeLineNode[]).length;
          const codeLines = writableCodeNode.createCodeLines(rawText);

          writableCodeNode.splice(startIndex, deleteCount, codeLines);

          const lastLine = codeLines.slice(-1)[0];
          const nextLineOffset =
            lastLine.getTextContent().length - textAfterSplit.length;

          lastLine.selectNext(nextLineOffset);

          return true;
        }
      }
    }

    return false;
  }

  insertInto(selection?: RangeSelection) {
    const writableSelf = this.getWritable();

    if ($isRangeSelection(selection)) {
      const { anchor, focus } = selection;
      const isBackward = selection.isBackward();

      const {topPoint, bottomPoint} = normalizePoints(anchor, focus, isBackward);
      const topNode = topPoint.getNode();
      const bottomNode = bottomPoint.getNode();

      const lineSet = new Set<LinedCodeLineNode>();

      const codeNodes = getLinedCodeNodesFromSelection($getSelection());
      const topCodeNode = getCodeNodeFromEntries(topNode, codeNodes);
      const bottomCodeNode = getCodeNodeFromEntries(bottomNode, codeNodes);

      let topLineIndex = -1;
      let topLineOffset = topPoint.offset;

      let bottomLineIndex = -1;
      let bottomLineOffset = bottomPoint.offset;

      let topLinesToMerge: LinedCodeLineNode[] = [];
      let bottomLinesToMerge: LinedCodeLineNode[] = [];

      if (topCodeNode) {
        const topLine = getLineCarefully(topNode);
        const codeNodeLength = topCodeNode.getChildrenSize();

        if ($isLinedCodeLineNode(topLine)) {
          topLineIndex = topLine.getIndexWithinParent();
          topLineOffset = topLine.getLineOffset(topPoint);
        }

        if (codeNodeLength > topLineIndex) {
          const currentLines = topCodeNode.getChildren<LinedCodeLineNode>();
          topLinesToMerge = currentLines.slice(0, topLineIndex);
        }
      }

      if (bottomCodeNode) {
        const bottomLine = getLineCarefully(bottomNode);
        const codeNodeLength = bottomCodeNode.getChildrenSize();

        if ($isLinedCodeLineNode(bottomLine)) {
          bottomLineIndex = bottomLine.getIndexWithinParent();
          bottomLineOffset = bottomLine.getLineOffset(bottomPoint);
        }

        if (codeNodeLength > bottomLineIndex) {
          const startingIndex = bottomLineIndex + 1;
          const currentLines = bottomCodeNode.getChildren<LinedCodeLineNode>();
          const lastCurrentLine = currentLines[currentLines.length - 1];
          const lastLineTextLength = lastCurrentLine.getTextContentSize();

          // Edge case: Adjust offset if last line is too short. selections...
          if (lastLineTextLength < bottomLineOffset) bottomLineOffset = lastLineTextLength;

          bottomLinesToMerge = currentLines.slice(startingIndex, codeNodeLength);
        }
      }

      $setBlocksType(selection, () => {
        const line = $createLinedCodeLineNode();
        lineSet.add(line)
        return line;
      });

      const newLines = Array.from(lineSet);
      const firstNewLine = newLines[0];
      const nodeToReplace = $isLinedCodeNode(topCodeNode)
        ? firstNewLine.getParent() as LinedCodeNode
        : firstNewLine;

      writableSelf.append(...topLinesToMerge, ...newLines, ...bottomLinesToMerge);

      // FYI: .replace burns selection. Restore it with a new one..!
      nodeToReplace.replace(writableSelf);

      // Note: Currently, I don't perfectly transfer uncollapsed selection
      // points when the anchor or focus is in a CodeNode (topCodeLine or
      // bottomCodeLine). It's decent enough to work and feels fairly
      // natural, but it's not 100%. What happens is that selectNext
      // will move the current offsets to the first and last lines.
      // Doing better was nightmarish. I gave up! Apologies...

      const nextTopLine = writableSelf.getFirstChild() as LinedCodeLineNode;
      const nextBottomLine = writableSelf.getLastChild() as LinedCodeLineNode;
      $transferSelection(topLineOffset, bottomLineOffset, nextTopLine, nextBottomLine);

      // gc: setBlocks needs help processing shadowRoot
      codeNodes.forEach((codeNode) => codeNode.remove());
    }
  }

  changeThemeName(name: string) {
    // cmd: CHANGE_THEME_NAME_COMMAND
    this.getWritable().__themeName = name;
  }

  setLanguage(language: string): boolean {
    // cmd: SET_LANGUAGE_COMMAND
    const self = this.getLatest();
    const writableCodeNode = this.getWritable();
    const currentLanguage = self.getLanguage();
    const nextLanguage = getCodeLanguage(language);
    const isNewLanguage = nextLanguage !== currentLanguage;

    if (isNewLanguage) {
      writableCodeNode.__language = nextLanguage;
      self.updateEveryLine(); // apply change

      return true;
    }

    return false;
  }

  toggleBlockLock() {
    // cmd: TOGGLE_BLOCK_LOCK_COMMAND
    const writableCodeNode = this.getWritable();

    writableCodeNode.__isLockedBlock = !this.getLatest().__isLockedBlock;

    return writableCodeNode.__isLockedBlock;
  }

  toggleLineNumbers() {
    // cmd: TOGGLE_LINE_NUMBERS_COMMAND
    const writableCodeNode = this.getWritable();

    writableCodeNode.__lineNumbers = !writableCodeNode.__lineNumbers;

    return writableCodeNode.__lineNumbers;
  }

  toggleTabs() {
    // cmd: TOGGLE_TABS_COMMAND
    const writableCodeNode = this.getWritable();

    writableCodeNode.__activateTabs = !writableCodeNode.__activateTabs;

    return writableCodeNode.__activateTabs;
  }

  updateEveryLine() {
    const writableCodeNode = this.getWritable();

    writableCodeNode.getChildren<LinedCodeLineNode>().forEach((line) => {
      if ($isLinedCodeLineNode(line)) {
        writableCodeNode.updateLineCode(line);
      }
    });
  }

  exitOnReturn(): boolean {
    const self = this.getLatest();

    if (!self.getSettings().isBlockLocked) {
      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const lastLine = self.getLastChild<LinedCodeLineNode>();
        const isLastLineSelected =
          lastLine !== null && anchorNode.getKey() === lastLine.getKey();
        const isSelectedLastLineEmpty =
          isLastLineSelected && lastLine.isEmpty();

        if (isSelectedLastLineEmpty) {
          const previousLine = lastLine.getPreviousSibling<LinedCodeLineNode>();
          return previousLine !== null && previousLine.isEmpty();
        }
      }
    }

    return false;
  }

  splitLineText(lineOffset: number, line: LinedCodeLineNode) {
    const lineText = line.getLatest().getTextContent();

    const textBeforeSplit = lineText.slice(0, lineOffset);
    const textAfterSplit = lineText.slice(lineOffset, lineText.length);

    return [textBeforeSplit, textAfterSplit];
  }

  tokenizePlainText(plainText: string): (string | Token)[] {
    const self = this.getLatest();
    const {language, tokenizer} = self.getSettings();
    const tokenize = (tokenizer as Tokenizer).tokenize;

    return tokenize(plainText, language as string);
  }

  getNormalizedTokens(plainText: string): NormalizedToken[] {
    // This allows for diffing w/o wasting node keys.
    if (plainText.length === 0) return [];

    const self = this.getLatest();
    const tokens = self.tokenizePlainText(plainText);

    return getNormalizedTokens(tokens);
  }

  getHighlightNodes(text: string): LinedCodeTextNode[] {
    if (text.length === 0) return [];

    const self = this.getLatest();
    const normalizedTokens = self.getNormalizedTokens(text);

    return normalizedTokens.map((token) => {
      return $createLinedCodeTextNode(token.content, token.type);
    });
  }

  isLineCurrent(line: LinedCodeLineNode): boolean {
    const self = this.getLatest();
    const latestLine = line.getLatest()
    const text = latestLine.getTextContent();
    const normalizedTokens = self.getNormalizedTokens(text);
    const children = latestLine.getChildren() as LinedCodeTextNode[];

    // Why? Empty text strings can cause lengths to mismatch on paste.
    if (children.length !== normalizedTokens.length) return false;

    return children.every((child, idx) => {
      const expected = normalizedTokens[idx];

      return (
        child.__highlightType === expected.type &&
        child.__text === expected.content
      );
    });
  }

  getLanguage() {
    // Note: highly specific method included for parity with
    // official CodeNode
    return this.getLatest().getSettings().language;
  }

  getSettings(): Omit<LinedCodeNodeOptions, 'initialLanguage'> & {
    language: string | null;
  } {
    const self = this.getLatest();

    return {
      activateTabs: self.__activateTabs,
      defaultLanguage: self.__defaultLanguage,
      isBlockLocked: self.__isLockedBlock,
      language: self.__language,
      lineNumbers: self.__lineNumbers,
      theme: self.__theme,
      themeName: self.__themeName,
      tokenizer: self.__tokenizer,
    };
  }

  getSettingsForCloning(): LinedCodeNodeOptions {
    const self = this.getLatest();
    const {language, ...rest} = self.getSettings();

    return {
      ...rest,
      initialLanguage: language,
    };
  }

  getSettingsForExportJSON(): LinedCodeNodeOptions_Serializable {
    const self = this.getLatest();
    const settings = self.getSettingsForCloning();

    return {
      ...settings,
      tokenizer: null,
    };
  }

  getRawText(
    nodes:
      | LexicalNode[]
      | NodeListOf<ChildNode>
      | HTMLCollectionOf<HTMLTableRowElement>,
    leadingText?: string,
    trailingText?: string,
  ) {
    const leading = leadingText || '';
    const trailing = trailingText || '';
    const rawText =
      [...nodes].reduce((linesText, node, idx, arr) => {
        let text = '';

        // Lexical nodes get text from getTextContent
        // DOM nodes use textContent, matching Lexical

        if ('getTextContent' in node) {
          text = node.getTextContent();
        } else if (node.textContent !== null) {
          text = node.textContent;
        }

        if (text.length > 0) {
          linesText += text;
        }

        if (!text.includes('\n')) {
          if (idx < arr.length - 1) {
            linesText += '\n';
          }
        }

        return linesText;
      }, leading) + trailing;

    return rawText;
  }

  isShadowRoot(): boolean {
    return true;
  }

  extractWithChild(): boolean {
    return true;
  }
}

export function $createLinedCodeNode(
  options?: LinedCodeNodeOptions,
): LinedCodeNode {
  return $applyNodeReplacement(new LinedCodeNode(options));
}

export function $isLinedCodeNode(
  node: LexicalNode | null | undefined,
): node is LinedCodeNode {
  return node instanceof LinedCodeNode;
}
