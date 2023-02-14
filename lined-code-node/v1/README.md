# LinedCodeNode

## Overview

The `LinedCodeNode` is very flexible. 

With it, you can create dedicated Lexical code editors, call attention to specific lines of code on the fly, and enable users to toggle color schemes, line-number visibility, and more, at the touch of a button. 

## Philosophy

### Control and structure

The `LinedCodeNode` controls most of what happens inside itself. 

This includes creating lines, tokens, and highlight nodes. This means it creates its own internal nodes:

```
Root (<div />)
  Code element (<code />)
    Line of code (<div />)
      Text/code (<span />)
```
This is unusual. The official `CodeNode` is assembled by transforms, as it has a different internal structure:

```
Root (<div />)
  Code element (<code />)
    Text/code (<span />)
    Linebreak (<br />)
```
The `LinedCodeNode`'s structure is maintained in two ways: 

- By letting it create its own nodes when necessary. 
- By having the Override API swap code-lines for paragraphs and code-text for text whenever the `selection` is inside a <code /\> element. 

_See "Inserting code" for how to insert code in the node._

### Running on text

People don't tend to put pictures or headlines in code blocks. 

The `LinedCodeNode` depends on this: import, export, and update logic works with plain text, not nodes. This makes life easier than it might be otherwise. One reason: Lexical's text-merge algorithm doesn't like multiple text tokens per line. 

## Guides and patterns

### Setup

- Copy the `LinedCodeNode` files into your project. 
- Add the `LinedCodePlugin` as a child of your `LexicalComposer`. 
- Spread `getLinedCodeNodes()` into your `LexicalComposer’s` nodes array.
- Add default options to `getLinedCodeNodes()` as a param. Internal fallbacks exist.

      nodes: [
        ...,
        ...getLinedCodeNodes({
          activateTabs: true,
          theme: {
            block: {
              base: default.block?.base,
              extension: default.block?.extension,
            },
            line: {
              base: default.line?.base,
              extension: default.line?.extension,
            },
            highlight: {
              ...default.highlight,
            },
            numbers: default?.numbers
          },
        })
      ]

### Options v. settings

`$createNewLinedCodeNode()` takes an options object.

You don't need to fill in every property. Lexical's Override API will merge your choices at call site with the default options that were passed when registering nodes on the `LexicalComposer`. Sensible fallbacks exist if neither is provided.

_See "import/export" for how this affects serialization._

### Paragraph and text replacement

On its own, Lexical can have trouble working with bespoke text layouts. 

Fortunately, the Override API can help. 

The `LinedCodeNode` uses it to swap the `ParagraphNode` for the `LinedCodeLineNode` and the `TextNode` for the `LinedCodeTextNode`. This fixes the functionality. 

Unfortunately, TypeScript can still niggle. 

It doesn't like replacing `{ type: ‘paragraph’ }` with `{ type: ‘code-line’ }`, so I’ve placated it with [type surgery](https://stackoverflow.com/a/57211915). I've removed `.type` from the `ParagraphNode` in order to make a `TypelessParagraphNode` from which to extend the `LinedCodeLineNode`.

### Inserting code

There are two ways to insert code into a `LinedCodeNode`:

- Ex. 1: `TextNode`

  ```
  const codeNode = $createLinedCodeNode();

  codeNode.append($createTextNode('const a = 2;'));
  root.append(codeNode); 
  ```

- Ex. 2: `LinedCodeLineNode`

  ```
  const codeNode = $createLinedCodeNode();
  const codeLine = $createLinedCodeLineNode();

  codeLine.append($createTextNode('const a = 2;'));
  codeNode.append(codeLine);
  ```

Note: Remember to spread arrays. _(See "[Importers](https://github.com/abelsj60/lexical-401/blob/main/lined-code-node/v1/Importers.ts)" for examples.)_

### Import/export

#### External paste

The `LinedCodeNode` handles all code-related `importDOM` logic. 

In other words, its children — `LinedCodeLineNode` and `LinedCodeTextNode` — won't use their own `importDOM` methods. `importDOM` cancels them by returning `null` from `importDOM`'s various `forChild` callbacks.

#### Internal paste

Say you copy three lines from a `LinedCodeNode` and paste them into Google Docs. 

You'll expect your pasted code to include a code element to ensure Google handles it correctly. But, you wouldn't want that same code element to appear in an existing `LinedCodeNode`, as that would create *nested* code nodes. 

This is why I created an internal paste function. 

#### Serialization

I rely on three methods to split options from settings *and* satisfy Lexical's rules.   

- `getSettings`
- `getSettingsForCloning`
- `getSettingsForExportJson`

- Ex. 1: Options v. settings

  ```
  On creation, the `initialLanguage` options is converted into the `language` setting.

  This is a problem for reconciliation, as we need to pass the current
  node’s state forward. To do this, I pass `language` forward as the 
  `initialLanguage` option via `getSettingsForExportJson`.
  ```

- Ex. 2: Unserializable properties
  ```
  Each `LinedCodeNode` holds the `tokenizer` as a property. This is very convenient. Unfortunately, Lexical bans unserializeble properties!

  No problem. On export, `getSettingsForExportJSON` fixes the problem 
  by replacing the `tokenizer` with `null`. No fuss, no muss.
  ```

### Editor insertion

It's pretty easy to insert a `LinedCodeNode` into a Lexical editor:

- Ex. Easy-peasy node insertion

  ```
  const formatCode = (customOptions: LinedCodeNodeOptions) => {
    if (blockType !== "code") {
      editor.update(() => {
        const selection = $getSelection();
        const codeNode = $createLinedCodeNode(customOptions);

        if ($isRangeSelection(selection)) {
          codeNode.insertInto(selection);
        }
      });
    }

    setBlockType('code');
  };
  ```

Note: `.insertInto` uses `setBlocksType_experimental`, which in turn uses `.replace`.  `.replace` doesn't seem to expect the `TextNodes` in an `ElementNode` to change on replacement. This generally causes Lexical to lose the `selection` when running `.replace` with the `LinedCodeNode`. 

Don't worry, though! You dont need to do anything. `.insertInto` already updates the `selection` manually. But it's just worth knowing about the problem in case you want to customize the `LinedCodeNode` package for yourself. 

### Block transforms

It's also easy to convert a `LinedCodeNode` to something else:

- Ex. 1: Paragraph transform
  ```
  const formatParagraph = () => {
    if (blockType !== "paragraph") {
      editor.update(() => {
        const nextSelection = $convertCodeToPlainText($getSelection());
        
        if ($isRangeSelection(nextSelection) || DEPRECATED_$isGridSelection(nextSelection)) {
          $setBlocksType_experimental(nextSelection, () => $createParagraphNode());
        }
      });
    }

    setBlockType('paragraph');
  };
  ```

- Ex. 2: List transform

  ```
  const formatBulletList = () => {
    if (blockType !== 'bullet') {
      editor.update(() => $convertCodeToPlainText($getSelection()));
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };
  ```

Start by normalizing the `LinedCodeNode` via `$convertCodeToPlainText(...)`.
  - This transforms the lines of code into separate paragraphs.
  - It also returns an updated `selection`. The `nextSelection` will apply the last offsets to the new node. If the `selection` is a range, and the `anchor` or `focus` is in an existing `LinedCodeNode`, the offsets will be applied to the new node's first and last lines.

Now, call `$setBlocksType_experimental` to convert your new paragraphs into any node supported by `setBlocks`. You could also call a command — or anything you want. 
  - Paragraph normalization should make it easy for your users to convert their `LinedCodeNodes` into any other format without any unexpected errors. 

### Markdown

At present, Markdown shortcuts can't be turned off inside the `LinedCodeNode`.

I am actively working on the problem. I currently have a pull request open to address the issue: https://github.com/facebook/lexical/pull/3898, but have not yet found an accord with core.

I have left the `canBeTransformed` method in the `LinedCodeNode`'s code for now (updated from `canBeMarkdown` per the PR comment). If you want, you can patch the PR's two updates into your Lexical installation in order to fix the problem right now. (Just adjust the name.)

I'll update these docs when I know more.
## API highlights

### Options

#### `activateTabs` 

- fallback: `false`

Lexical turns tabs off by default, instead preferring to dedicate the tab button to navigation. I’ve added an option to activate tabs within `LinedCodeNodes`. When active, tabs will work as normal whenever the `selection` is inside a `LinedCodeNode`. 

#### `defaultLanguage` 

- fallback: `javascript`

You’ll pretty much always want a `LinedCodeNode` to start with an initial language. You may also want to allow the block’s language to be reset by button. The `defaultLanguage` setting makes both easy. It takes over when you don’t pass an `initialLanguage`. 

#### `isLockedBlock` 

- fallback: `false`

This option is helpful when you want to dedicate your Lexical editor to code. This can’t be done by default. Users are generally able to exit the `LinedCodeNode` by: 

1. Hitting enter three times in a row at the end of the code block.
2. Hitting backspace when the selection is at the first offset of the code block’s first line.
3. Hitting enter after using the up/down arrow to select the root node while at the top or bottom of the code block.

This option disables all three behaviors. 

#### `initialLanguage` 

- fallback: `javascript`

Use this option to set the `LinedCodeNode’s` first language. It's also set by `defaultLanguage`.

#### `lineNumbers` 

- fallback: `true`

Sometimes you want line numbers, sometimes you don’t. 

Sometimes you want to turn them on and off. This option can help. 

Individual lines always track their own line number via a node property and data attribute, however, their visibility depends on your CSS. You can pass your own classname via the `LinedCodeNode`'s `theme` or use the fallback, "code-line-number."

- Ex. Line number styling via pseudoclass

  ```
  .code-line-number.PlaygroundEditorTheme__code:before { // CODE ELEMENT
    background-color: #eee;
    border-right: 1px solid #ccc;
    content: '';
    height: 100%;
    left: 0;
    min-width: 41px;
    position: absolute;
    top: 0;
  }

  .code-line-number:before { // CHILD DIVS (LINES)
    color: #777;
    content: attr(data-line-number);
    left: 0px;
    min-width: 33px;
    position: absolute;
    text-align: right;
  }
  ```

You can toggle line number visibility with the `LinedCodeNode`'s `toggleLineNumbers` method. 

When off, the line-number class will be removed from the `code` element and its child `divs`.

##### Capabilities and limitations

This isn’t 100% perfect. 

Here’s what you can do: Style line numbers and the gutter that sits behind them (_see above CSS_). You can also enable horizontal scrolling on long lines by adding `overflow-x: auto` to the `code` element and `white-space: pre` to each line. 

Here's what you can't do: `{ position sticky }`. (Maybe more.) 

#### `theme` 

- fallback: `{}`

The `LinedCodeNode` accepts a theme object on creation. 

```
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
  highlight?: Record<string, EditorThemeClassName>;
  [key: string]: any; // makes TS very happy
}
```
While these values aren't designed to be changed, you can still modify your node's styling at any time by updating its `themeName` or by updating each line's `discreteLineClasses`. 

#### `themeName` 

- fallback: `''`

Change your `LinedCodeNode`'s styling on the fly.

- *Ex. 1: CSS with no `themeName` applied*
  ```
  .code-line-number.PlaygroundEditorTheme__code {
      padding-left: 52px;
  }
  ```
- *Ex. 2: CSS with `themeName` ("tron") applied*
  ```
  .tron.code-line-number.PlaygroundEditorTheme__code {
      padding-left: 8px;
  }
  ```

#### `tokenizer` 

- fallback: `Prism`

You should be able to use your own tokenizers with the `LinedCodeNode`. Simply pass a function that matches the `Tokenizer` interface when using `$createLinedCodeNode` or as a default option. 

Do note, though, I've only tested the Prism `tokenizer` against the method that creates normalized tokens. If you try another one and it breaks, should and/or send it to me. Maybe I can fix it.

```
The `LinedCodeNode` tokenizes text via a multi-step process: 

- Tokenize the text, 
- Create a set of normalized tokens 
- Convert the normalized tokens into `LinedCodeTextNodes`

This makes it easy to check if a line is current, as you can always compare the normalized 
tokens to the current code-text without creating new text nodes. 
```

### Methods

_Please skim the code for more about individual custom methods._

### Commands

#### `CHANGE_THEME_NAME_COMMAND`

Use this command to add a theme name to a `LinedCodeNode's` `themeName` property. You can use the name in your CSS to dynamically adjust your node's styling.

#### `SET_LANGUAGE_COMMAND`

Use this command to change the active programming language.

#### `TOGGLE_BLOCK_LOCK_COMMAND`

Use this command to toggle the `LinedCodeNode` between locked and unlocked. 

#### `TOGGLE_LINE_NUMBERS_COMMAND`

Use this command to toggle line numbers on and off within the `LinedCodeNode`. 

#### `TOGGLE_TABS_COMMAND`

Use this command to toggle tabs on and off within the `LinedCodeNode`.

# LinedCodeLineNode

## Overview

You generally won't interact with this node. 

The exception is drawing people's attention to certain lines — say by adding or removing a highlight color from active lines — via its `discreteLineClass` properties and methods.

### Methods

_Please skim the code for more about individual custom methods._

Perhaps the biggest advantage of lines is being able to attention to some of them. 

- Ex. Discrete and dynamic line classes:

  ```
  Lexical core plugin:

  <NodeEventPlugin
    nodeType={LinedCodeLineNode}
    eventType="click"
    eventListener={handleLineClick}
  />
  ```
  ```
  Handler: 

  const handleLineClick = (
    _event: Event, 
    editor: LexicalEditor, 
    key: NodeKey
  ) => {
    const line = $getNodeByKey(key) as LinedCodeLineNode;
    ...
    if (isActive) {
      line.addDiscreteLineClasses(ACTIVE_LINE_CLASS);
    } else {
      line.removeDiscreteLineClasses(ACTIVE_LINE_CLASS);
    }
  }
  ```

### Commands

#### `ADD_DISCRETE_LINE_CLASSES_COMMAND`

Use this command to add classes to your individual lines of code. For instance, you might want to add an “active” class that highlights the line in a special color. You can also do this via its sibling method.

#### `REMOVE_DISCRETE_LINE_CLASSES_COMMAND`

Use this command to remove classes from your individual lines of code. For instance, you might want to remove an “active” class that highlights the line in a special color.

# LinedCodeTextNode

## Overview

You generally won't interact with this node directly. 

--

```
Author: James Abels
Contact: See main README
```