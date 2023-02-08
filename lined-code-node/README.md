# LinedCodeNode

## **Overview**

The `LinedCodeNode` is a code block that wraps tokens into lines via a div: 

```
Root (<div />)
  Code element (<code />)
    Line of code (<div />)
      Text/code (<span />)
```
This is in contrast to Lexical’s official code package, which mixes tokens with line breaks in a long, flat list. The result looks like lines, but it's an aesthetic effect, not a structural one:
```
Root (<div />)
  Code element (<code />)
    Text/code (<span />)
    Linebreak (<br />)
```

Some functionality is hard to achieve with the official CodeNode:

- It can be hard to conceptualize what line a user is on at any given time.

- There’s no way to style or highlight lines in order to better focus user attention.

- Long lines “wrap” onto multiple un-numbered lines at the bottom of the code node. 

The `LinedCodeNode` is not perfect, but it addresses these problems. 

## **Philosophy**

### **Internal control**

The `LinedCodeNode` controls most of what happens inside itself. 

This includes creating code lines, tokens, and highlight nodes. Want to load code into your node? Use `.append(...)` in one of two ways:

- Text node example
    ```
    linedCodeNode.append([$createTextNode('const a = 2;')]);
    ```
- Code line example
    ```
    const codeLine = $createLinedCodeLineNode();

    codeLine.append([$createTextNode('const a = 2;')]);

    linedCodeNode.append([codeLine]);
    ```

Note: Call `ADD_DISCRETE_LINE_CLASSES_COMMAND`, such as via an `onClick` listener, to add individual line classes. This allows you to direct user attention in almost any way.

### **Text handling**

No one really wants to add pictures or interactive elements to code blocks. 

This lead me to one of the `LinedCodeNodes` central tenets — most of its import, export, and update logic revolves around text. This makes life easy, as Lexical goes nuts when merging code tokens while users type. Debugging that sounded like a nightmare.

## **Guides and patterns**

### **Setup**

- Copy the `LinedCodeNode` files into your project. 
- Add the `LinedCodePlugin` as a child of your `LexicalComposer`. 
- Spread `getLinedCodeNodes()` into your `LexicalComposer’s` nodes array.
- Add default options to `getLinedCodeNodes()` as a param. Internal fallbacks exist.

```
All `LinedCodeNode` nodes are registered on the `LexicalComposer` via a helper function. You can pass it a set of default options, or pass nothing to use the built-in fallbacks:

---

nodes: [
  ...,
  ...getLinedCodeNodes({
    activateTabs: true,
    theme: linedCodeNodeTheme || defaultLinedCodeNodeTheme,
  })
]
```

### **Options v. settings**

`$createNewLinedCodeNode()` takes an options object.

You don't need to fill in every property. Lexical's Override API will merge your choices at call site with the default options that were passed when registering nodes on the `LexicalComposer`. Sensible fallbacks exist for neighter is provided.

Please see "import/export" for how this affects serialization.

### **Paragraph and text replacement**

On its own, Lexical has trouble working with bespoke text layouts. 

Fortunately, the Override API can help. 

The `LinedCodeNode` uses it to swap the `ParagraphNode` for the `LinedCodeLineNode` and the `TextNode` for the `LinedCodeTextNode`. This fixes the functionality. 

Unfortunately, TypeScript can still niggle. 

It doesn't like replacing `{ type: ‘paragraph’ }` with `{ type: ‘code-line’ }`, so I’ve placated it with [type surgery](https://stackoverflow.com/a/57211915). I've removed `.type` from the `ParagraphNode` in order to make a `TypelessParagraphNode` from which to extend the `LinedCodeLineNode`.

### **Import/export**

*External paste*

The `LinedCodeNode` handles all code-related `importDOM` logic. 

In other words, its children — `LinedCodeLineNode` and `LinedCodeTextNode` — won't use their own `importDOM` methods. `importDOM` cancels them by returning `null` from `importDOM`'s various `forChild` callbacks.

*Internal paste*

Say you copy three lines from a `LinedCodeNode` and paste them into Google Docs. 

You'll expect your pasted code to include a code element to ensure Google handles it correctly. But, you wouldn't want that same code element to appear in an existing `LinedCodeNode`, as that would create *nested* code nodes. 

This is why I created an internal paste function. 

*Serialization*

I rely on three methods to split options from settings *and* satisfy Lexical's rules.   

- `getSettings`
- `getSettingsForCloning`
- `getSettingsForExportJson`

Ex. 1: The setting-option split
```
On creation, the `initialLanguage` option is converted into a `language` setting.

This is a problem for reconciliation, as we need to pass the current node’s state forward. To do this, I pass `language` forward as an `initialLanguage` option via `getSettingsForExportJson`.
```

Ex. 2: Unserializable node properties
```
The `LinedCodeNode` holds its `tokenizer` as a property. 

This is a problem, as Lexical doesn't allow function properties. They aren't serializable. On export, `getSettingsForExportJSON` fixes the issue by replacing the `tokenizer` with `null`.
```

## **API highlights**

### *Options*

- `activateTabs` [fallback: `false`]

    Lexical turns tabs off by default, instead preferring to dedicate the tab button to navigation. This is a problem for long-form writing — and code. As a result, I’ve added an option to activate tabs within `LinedCodeNodes`. When active, tabs will work as expected when the current selection is inside a `LinedCodeNode`. They will not work outside of it unless you turn them on yourself.

- `defaultLanguage` [fallback: `javascript`]

    You’ll pretty much always want a `LinedCodeNode` to start with an initial language. You may also want to allow the block’s language to be reset via a button. The `defaultLanguage` setting makes both easy. It takes over when you don’t pass an `initialLanguage`. 

- `isLockedBlock` [fallback: `false`]

    This option is helpful when you want to dedicate your Lexical editor to code. This can’t be done by default. Users are generally able to exit the `LinedCodeNode` by: 

    1. Hitting enter three times in a row at the end of the code block.
    2. Hitting backspace when the selection is at the first offset of the code block’s first line.
    3. Hitting enter after using the up/down arrow to select the root node while at the top or bottom of the code block.

    This option disables all three behaviors. 

- `initialLanguage` [fallback: `javascript`]

    Use this option to set the `LinedCodeNode’s` first language. It os also set by `defaultLanguage`.

- `lineNumbers` [fallback: `true`]

    Sometimes you want line numbers, sometimes you don’t. Sometimes you may even want to turn them on and off on the fly. This option can help. When active, a line number is added as a data attribute to the DOM for each `LinedCodeLineNode`. It can be used to show line numbers via a CSS rule. This rule will typically use the “before” pseudoclass. 

    This isn’t perfect. Here’s what you can do today: Use a line-number class to style your numbers use another before pseudoclass on the line’s parent code block to style a “gutter” behind it, and enable horizontal scrolling on long lines with `overflow-x: auto` on the code block and `white-space: pre` on each line. What can’t you do? Position sticky and automatic line breaks. Maybe more. 

- `theme` [fallback: `{}`]

    The `LinedCodeNode` accepts a theme object on creation. 
    
    ```
    export interface LinedCodeNodeTheme {
      block?: EditorThemeClassName;
      line?: EditorThemeClassName;
      numbers?: EditorThemeClassName;
      highlight?: Record<string, EditorThemeClassName>;
    }
    ```
    While these values aren't designed to be changed, you can still modify your node's styling at any time by updating its `themeName` property (see example below) or by updating each line's `discreteLineClasses`. 

- `themeName` [fallback: `''`]

    Change your `LinedCodeNode`'s styling on the fly, for example:

    *CSS with no `themeName` applied*
    ```
    .code-line-number.PlaygroundEditorTheme__code {
      padding-left: 52px;
    }
    ```
    *CSS with `themeName` applied*
    ```
    .carl.code-line-number.PlaygroundEditorTheme__code {
      padding-left: 8px;
    }
    ```
- `tokenizer` [fallback: `Prism`]

    You should be able to use your own tokenizers with the `LinedCodeNode`. Simply pass a function that matches the Tokenizer interface when using `$createLinedCodeNode` or as a default option. 

    But note, I haven’t tested the function that normalizes the `tokenizer’s` tokens with any library other than Prism. Shout if it breaks and/or send me your function and maybe I can fix it.

    ```
    The `LinedCodeNode` tokenizes text via a multi-step process: 

    - Tokenize the text, 
    - Create a set of normalized tokens 
    - Convert the normalized tokens into `LinedCodeTextNodes`

    This makes it easy to check if a line is current, as you can always compare the normalized tokens to the current code-text without creating new text nodes. 
    ```

### *Methods*

- Please skim the code for more about individual custom methods.

### *Commands*

- `CODE_TO_PLAIN_TEXT_COMMAND`

    Use this command to convert an active `LinedCodeNode` to plain text. Each code line will be converted into a paragraph with text inside it. By contrast, when you convert the official `CodeNode` to plain text, it will place all the code and its line breaks in one paragraph. 

- `SET_LANGUAGE_COMMAND`

    Use this command to change the active programming language.

- `TOGGLE_IS_LOCKED_BLOCK_COMMAND`

    Use this command to toggle the `LinedCodeNode` between locked and unlocked. 

- `TOGGLE_LINE_NUMBERS_COMMAND`

    Use this command to toggle line numbers on and off within the `LinedCodeNode`. 

- `TOGGLE_TABS_COMMAND`

    Use this command to toggle tabs on and off within the `LinedCodeNode`.

- `UPDATE_LANGUAGE_COMMAND`

    Use this command to change the `LinedCodeNode’s` language

---
# LinedCodeLineNode

## **Overview**

You generally won't interact with this node. 

The exception is drawing people's attention to certain lines — say by adding or removing a highlight color from active lines — via its `discreteLineClass` properties and methods.

### *Methods*

- Please skim the code for more about individual custom methods.

### *Commands*

- `ADD_DISCRETE_LINE_CLASSES_COMMAND`

    Use this command to add classes to your individual lines of code. For instance, you might want to add an “active” class that highlights the line in a special color.

- `REMOVE_DISCRETE_LINE_CLASSES_COMMAND`

    Use this command to remove classes from your individual lines of code. For instance, you might want to remove an “active” class that highlights the line in a special color.
---

# LinedCodeTextNode

## **Overview**

You generally won't interact with this node directly. 

--

```
Author: James Abels
Contact: See main README

Notes: 

I've filed a PR to update `$setBlocksType_experimental` for this node. In the meantime, I've added it to lexical-401's utilities folder. I haven't debugged `$wrapNodes` for this node.
```