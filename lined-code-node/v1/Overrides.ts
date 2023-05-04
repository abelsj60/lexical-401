/* eslint-disable header/header */
import type {
  LinedCodeNodeOptions,
} from './LinedCodeNode';

import { CodeNode } from '@lexical/code';
import {ParagraphNode, TextNode} from 'lexical';

import {$createLinedCodeLineNode, LinedCodeLineNode} from './LinedCodeLineNode';
import {
  $createLinedCodeNode,
  $isLinedCodeNode,
  LinedCodeNode,
} from './LinedCodeNode';
import {LinedCodeTextNode} from './LinedCodeTextNode';
import {getCodeLanguage, PrismTokenizer} from './Prism';
import {$getLinedCodeNode, addOptionOrDefault} from './utils';

export function swapLcnForFinalVersion(
  defaults?: LinedCodeNodeOptions,
) {
  // You may be wondering why not .replace the unconfigured CodeNode via the 'created'
  // mutation. Because the .replace() method doesn't work in this case, as the newly
  // created node has no parent yet. Also, the LineCodeLineNodes have already been
  // created, so, we'd have to swim upstream to reset their initial options.

  // By contrast, the replacement API gives us a quick-n-easy way to
  // properly set all options at once without any backtracking.

  return {
    replace: LinedCodeNode,
    with: (node: LinedCodeNode) => {
      const defaultsOptions = defaults || {};
      const settings = node.getSettings();
      const finalOptions = {
        activateTabs: addOptionOrDefault(
          settings.activateTabs,
          defaultsOptions.activateTabs ?? false,
        ),
        defaultLanguage: getCodeLanguage(
          settings.defaultLanguage
            || defaultsOptions.defaultLanguage
        ),
        initialLanguage: getCodeLanguage(
          settings.language
            || defaultsOptions.initialLanguage
        ),
        isBlockLocked: addOptionOrDefault(
          settings.isBlockLocked,
          defaultsOptions.isBlockLocked ?? false,
        ),
        lineNumbers: addOptionOrDefault(
          settings.lineNumbers,
          defaultsOptions.lineNumbers ?? true,
        ),
        theme: {
          block: {
            base: addOptionOrDefault(
              settings?.theme?.block?.base,
              defaultsOptions?.theme?.block?.base || 'lined-code-node'
            ),
            extension: addOptionOrDefault(
              settings?.theme?.block?.extension,
              defaultsOptions?.theme?.block?.extension || ''
            )
          },
          highlights: addOptionOrDefault(
            settings.theme?.highlights,
            defaultsOptions?.theme?.highlights || {}
          ),
          line: {
            base: addOptionOrDefault(
              settings?.theme?.line?.base,
              defaultsOptions?.theme?.line?.base || 'code-line'
            ),
            extension: addOptionOrDefault(
              settings?.theme?.line?.extension,
              defaultsOptions?.theme?.line?.extension || ''
            ),
          },
          numbers: addOptionOrDefault(
            settings?.theme?.numbers,
            defaultsOptions.theme?.numbers || 'line-number'
          )
        },
        themeName: addOptionOrDefault(
          settings.themeName,
          defaultsOptions.themeName || ''
        ),
        tokenizer: addOptionOrDefault(
          settings.tokenizer,
          defaultsOptions.tokenizer || PrismTokenizer,
        ),
      };

      const codeNode = new LinedCodeNode(finalOptions);
      codeNode.append($createLinedCodeLineNode());

      return codeNode;
    },
  };
}

function swapParagraphForCodeLine() {
  return {
    replace: ParagraphNode,
    with: (node: ParagraphNode) => {
      const codeNode = $getLinedCodeNode();

      if ($isLinedCodeNode(codeNode)) {
        if (!codeNode.exitOnReturn()) {
          return new LinedCodeLineNode();
        }
      }

      return node;
    },
  };
}

function swapTextForCodeText() {
  return {
    replace: TextNode,
    with: (node: TextNode) => {
      if ($isLinedCodeNode($getLinedCodeNode())) {
        return new LinedCodeTextNode(node.getTextContent());
      }

      return node;
    },
  };
}

function swapCodeNodeForLinedCodeNode() {
  return {
    replace: CodeNode,
    with: (node: CodeNode) => {
      const options = node.getLanguage()
        ? { initialLanguage: node.getLanguage() }
        : undefined;

      return $createLinedCodeNode(options);
    }
  };
}

export function getLinedCodeNodes(defaults?: LinedCodeNodeOptions) {
  return [
    CodeNode,
    LinedCodeNode,
    LinedCodeLineNode,
    LinedCodeTextNode,
    swapCodeNodeForLinedCodeNode(),
    swapLcnForFinalVersion(defaults),
    swapParagraphForCodeLine(),
    swapTextForCodeText(),
  ];
}
