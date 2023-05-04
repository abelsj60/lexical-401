# LinedCodeNode

## Overview

Lexical's can't place code in lines by default.

The `LinedCodeNode` can. This is useful when creating code editors, calling attention to specific lines, or toggling color schemes, line-number visibility, and more, at the touch of a button.

https://user-images.githubusercontent.com/30417590/219041359-3064c2cc-160c-48d1-aa83-6b6154988cab.mp4

_Note: Generally speaking, each `LinedCodeNode` works on its own. To modify all of them at once, you should follow the usual practice of traversing the Lexical node map._

---

CODE SANDBOX

https://codesandbox.io/embed/muddy-feather-52r2k2?fontsize=14&hidenavigation=1&theme=dark

_Note: Testing the CodeActionMenu's copy button? You may need to open the sandbox in its own page._

---

## Philosophy

### Control and structure

Most LexicalNodes are controlled by the editor instance.

By contrast, each `LinedCodeNode` controls its own settings and internal nodes, including its `code-line` and `code-text` nodes.

Internally, it looks like this:

```jsx
Root (<div />)
  LinedCodeNode (<code />)
    LinedCodeLineNode (<div />)
      LinedCodeTextNode (<span />)
```
By contrast, the official `CodeNode` looks like this:

```jsx
Root (<div />)
  Code element (<code />)
    Text/code (<span />)
    Linebreak (<br />)
```
The `LinedCodeNode` has an unusual internal structure because it uses the Override API to swap code-lines for paragraphs and code-text for text whenever the `selection` is inside a <code /\> element.

### Running on text

Internally, the `LinedCodeNode` works with plain text.

It's constantly converting highlighted text into plain text, performing whatever calculations the user wants, and re-highlighting line text for display on screen. Over time, I learned this is the easiest way to handle lined code in Lexical.

## Guides and patterns

### Quick start

You can get the `LinedCodeNode` up and running in three easy steps:

1. Install `getLinedCodeNodes` in the `LexicalComposer’s` nodes array.
2. Install the `LinedCodeNodePlugin` as a child of the `LexicalComposer`.

    ```jsx
    // Start by installing the LinedCodeNodes and the LinedCodePlugin.

      <LexicalComposer
        initialConfig={{
          ...
          nodes: [
            ...,
            ...getLinedCodeNodes({...})
          ],
          ...
        }}
      >
        <LinedCodePlugin />
        ...
      </LexicalComposer>
      ```


3. Update your style sheet with `LinedCodeNode` styles. Here’s the theme shape:

    ```ts
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
    }
    ```

    The `LinedCodeNode` will automatically add the following default class names:

    - `block: { base: ‘lined-code-node’ }`
    - `line: { base: ‘code-line’ }`
    - `numbers: ‘line-number’`

    You can override these values with your own custom class names by passing a default theme object to `getLinedCodeNodes: { theme: defaultThemeValues }`. You can also override the defaults by passing a theme object to each call to `$createLinedCodeNode( { theme })`.

    Here’s a sample of how you might structure your css:

    ```css
    .lined-code-node {
      background-color: rgb(240, 242, 245);
      font-family: Menlo, Consolas, Monaco, monospace;
      display: block;
      padding: 8px;
      line-height: 1.53;
      font-size: 13px;
      margin: 0;
      margin-top: 8px;
      margin-bottom: 8px;
      tab-size: 2;
      overflow-x: auto;
      position: relative;
    }

    .lined-code-node.line-number {
      padding-left: 52px;
    }

    /* This selector creates a styled gutter for line numbers. */

    .lined-code-node.line-number:before {
      background-color: #eee;
      border-right: 1px solid #ccc;
      content: '';
      height: 100%;
      left: 0;
      min-width: 41px;
      position: absolute;
      top: 0;
    }

    /* This selector creates line numbers and places them within the above styled gutter. As a result, the gutter never breaks. */

    .line-number:before {
      color: #777;
      content: attr(data-line-number);
      left: 0px;
      min-width: 33px;
      position: absolute;
      text-align: right;
    }

    .code-line {
      white-space: pre;
    }
    .code-line:hover {
      background-color: yellow;
    }
    ```

That should do it. Great. Let's talk about what's under the hood.

### Default settings

Eagle-eyed readers will notice that `getLinedCodeNodes` takes a default settings object. You can override them at any time by passing an options object to `$createLinedCodeNode()`.

See "API highlights" for a discussion of each default.

### Inserting code

There are two ways to insert code into a `LinedCodeNode`:

- Ex. 1: `TextNode`

  ```ts
  const codeNode = $createLinedCodeNode();

  codeNode.append($createTextNode('const a = 2;'));
  root.append(codeNode);
  ```

- Ex. 2: `LinedCodeLineNode`

  ```ts
  const codeNode = $createLinedCodeNode();
  const codeLine = $createLinedCodeLineNode();

  codeLine.append($createTextNode('const a = 2;'));
  codeNode.append(codeLine);
  ```

### Import, export, and serialization

The importance of import, export, and serialization can't be understated.

- Export allows text to be copied from Lexical.
- Import allows text to be inserted into Lexical.
- Serialization helps update the DOM to match Lexical's internal state.

The `LinedCodeNode` requires a little special handling on all three fronts. Let's review them.

#### Import

The `LinedCodeNode`'s `importDOM` method handles everything inside of it. As a result, the `LinedCodeLineNode` and `LinedCodeTextNode` don't do anything on this front.

#### Export

This is best explained with an example.

Say you copy three lines from a `LinedCodeNode` and paste them into Google Docs. You'll probably want `exportDOM` to include a code element so Google will show your code as code.

But, what happens if you paste the same text inside an existing Lexical `LinedCodeNode`? You wouldn't want to create a nested code node, which is what Lexical will do with that same code element

Something's gotta give. There's no way to distinguish between these cases via `exportDOM`, so you've got to handle it via `importDOM` somehow. The easiest thing to do, I found, was add an internal paste function to the `LinedCodeNode`. It knows how to handle this situation.

#### Serialization

As you know, you can hand every `LinedCodeNode` its own settings.

They can range from a custom tokenizer to theme. This is great. Really flexible. Unfortunately, these settings can break some very important Lexical rules, such as no function properties!

The `LinedCodeNode` uses three methods to obviate this problem:

- `getSettings`

  The standard way of getting the `LinedCodeNode`'s current settings. A special `getLanguage()` method also exists for parity with the official `CodeNode`.

- `getSettingsForCloning`

  On creation, the `initialLanguage` option is converted to the `language` property. This could be a problem for reconciliation, as we need to pass the current node’s state forward. Done! This method passes `language` forward as `initialLanguage`.
- `getSettingsForExportJson`

  Each `LinedCodeNode` contains its own `tokenizer`. Sadly, Lexical bans unserializeble function properties. No problem! This method replaces it with `null` on export.

### Editor insertion

It's easy to insert a `LinedCodeNode` into a Lexical editor:

- Ex. Easy-peasy node insertion

  ```ts
  const formatCode = (options: LinedCodeNodeOptions) => {
    if (blockType !== "code") {
      editor.update(() => {
        const selection = $getSelection();
        const codeNode = $createLinedCodeNode(options);

        if ($isRangeSelection(selection)) {
          codeNode.insertInto(selection);
        }
      });
    }

    setBlockType('code');
  };
  ```

### `LinedCodeNode` transforms

It's pretty easy to convert a `LinedCodeNode` to another node.

- First, use `$convertCodeToPlainText($getSelection())` to transform each line of code into its own paragraph.
  - It returns an updated `selection`. It applies the previous selection offsets to the new nodes. You can review how ranges are handled at your leisure.

Now, call `$setBlocksType` to convert your new paragraphs into any node supported by `setBlocks`. You could also call a command. Whatever you want.

- Ex. 1: Paragraph transform
  ```ts
  const formatParagraph = () => {
    if (blockType !== "paragraph") {
      editor.update(() => {
        const nextSelection = $convertCodeToPlainText($getSelection());

        if ($isRangeSelection(nextSelection) || DEPRECATED_$isGridSelection(nextSelection)) {
          $setBlocksType(nextSelection, () => $createParagraphNode());
        }
      });
    }

    setBlockType('paragraph');
  };
  ```

- Ex. 2: List transform

  ```ts
  const formatBulletList = () => {
    if (blockType !== 'bullet') {
      editor.update(() => $convertCodeToPlainText($getSelection()));
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };
  ```

### Markdown

At present, Markdown shortcuts can't be turned off inside the `LinedCodeNode`.

I am actively working on the problem. I currently have a pull request open to address the issue: https://github.com/facebook/lexical/pull/3898.

I have left the `canBeTransformed` method — formerly `canBeMarkdown` — in the `LinedCodeNode` for now. If you want, you could follow the PR and patch its two updates into your Lexical installation in order to fix the problem on your own:

- Add `canBeTransformed` to the `LexicalNode` class, per this [PR comment](https://github.com/facebook/lexical/pull/3898#issuecomment-1429641429).
- Check `canBeTransformed` in the `MarkdownShortcuts` file, as seen in the PR.

I'll update these docs when I know more.
## API highlights

### `LinedCodeNode` Options

```ts
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
```

#### `activateTabs`

- fallback: `false`

Lexical turns tabs off by default, instead preferring to dedicate the tab button to navigation. I’ve added an option to activate tabs within `LinedCodeNodes`. When active, tabs will work as expected when the `selection` is inside a `LinedCodeNode`.

#### `defaultLanguage`

- fallback: `javascript`

You’ll pretty much always want a `LinedCodeNode` to start with an initial language. You may also want to allow the block’s language to be reset via a button. The `defaultLanguage` setting makes both easy. It takes over when you don’t pass an `initialLanguage`.

#### `isLockedBlock`

- fallback: `false`

By default, Lexical allows users to exit the `LinedCodeNode` by

1. Hitting enter three times in a row at the end of the code block.
2. Hitting backspace when the selection is at the first offset of the code block’s first line.
3. Hitting enter after using the up/down arrow to select the root node while at the top or bottom of a code block that's at the top or bottom of Lexical.

Use this option to disables all three behaviors.

#### `initialLanguage`

- fallback: `javascript`

Use this option to set the `LinedCodeNode’s` initial language.

#### `lineNumbers`

- fallback: `true`

Sometimes you want line numbers, sometimes you don’t.

Sometimes you want to be able to toggle them on and off. This option can help.

Individual lines always track their own line number via a node property and data attribute, however, their visibility depends on CSS. See "Quick start" for more.

- Ex. Line number styling via pseudoclass

  ```ts
  .line-number.PlaygroundEditorTheme__code:before { // CODE ELEMENT
    background-color: #eee;
    border-right: 1px solid #ccc;
    content: '';
    height: 100%;
    left: 0;
    min-width: 41px;
    position: absolute;
    top: 0;
  }

  .line-number:before { // CHILD DIVS (LINES)
    color: #777;
    content: attr(data-line-number);
    left: 0px;
    min-width: 33px;
    position: absolute;
    text-align: right;
  }
  ```

If you enable line numbers, toggle visibility via the `LinedCodeNode`'s `toggleLineNumbers` method. Toggling's handled by adding and removing the `line-number` class on the fly.

##### Capabilities and limitations

Here’s what works: Style line numbers and the gutter that sits behind them (_see above CSS_). You can also enable horizontal scrolling on long lines by adding `overflow-x: auto` to the `code` element and `white-space: pre` to each line.

Here's what doesn't work: `{ position sticky }`. (Maybe more.)

#### `theme`

- fallback: `{}`

The `LinedCodeNode` accepts a theme object on creation.

```ts
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
  [key: string]: any; // makes TS very happy
}
```
Only some of these values can be changed directly on the fly. The rest can varied by using the `themeName` or by using each line's `discreteLineClasses` methods.

#### `themeName`

- fallback: `''`

Change your `LinedCodeNode`'s styling on the fly.

- *Ex. 1: CSS with no `themeName` applied*
  ```css
  .lined-code-node.line-number {
      padding-left: 52px;
  }
  ```
- *Ex. 2: CSS with `themeName` ("tron") applied*
  ```css
  .tron.lined-code-node.line-number {
      padding-left: 8px;
  }
  ```

#### `tokenizer`

- fallback: `Prism`

You should be able to use your own tokenizers with the `LinedCodeNode`.

Simply use the `Tokenizer` interface to pass a function to `$createLinedCodeNode`.

Note: I've only tested the Prism `tokenizer` against the method that creates normalized tokens. If you try another one and it breaks, let me know. Maybe I can fix it.

```
The `LinedCodeNode` tokenizes text via a multi-step process:

- Tokenize  text
- Create a set of normalized tokens
- Convert the normalized tokens into `LinedCodeTextNodes`

This makes it easy to check if a line is current, as you can always compare the normalized
tokens to the current code-text without creating new text nodes.
```

### Methods

_Please skim the code for more about individual custom methods._

### Commands

#### `CHANGE_THEME_NAME_COMMAND`

Use this command to add a theme name to a `LinedCodeNode's` `themeName` property. You can use the name in your CSS to dynamically adjust node styling.

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

The exception is drawing people's attention to certain lines — say by adding or removing a highlight color from active lines — via the `discreteLineClass` properties and methods.

### Methods

#### `addDiscreteLineClasses` / `removeDiscreteLineClasses`

- Ex. Dynamically adding discrete line classes:
  ```ts
  // Handler:

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
  ```jsx
  // Event plugin (Lexical core):

  <NodeEventPlugin
    nodeType={LinedCodeLineNode}
    eventType="click"
    eventListener={handleLineClick}
  />
  ```

_Please skim the code for more about all the other custom methods._

### Commands

`ADD_DISCRETE_LINE_CLASSES_COMMAND`

Use this command to add classes to your individual lines of code on button click.

`REMOVE_DISCRETE_LINE_CLASSES_COMMAND`

Use this command to remove classes from your individual lines of code on button click.

# LinedCodeTextNode

## Overview

You generally won't interact with this node directly.

--

```
Author: James Abels
Contact: See main README
```
