# CodeActionMenu

I know, the Playground has a nifty code-action menu.

Last I checked, it'll work with two minor updates.

1. [(original file)] (https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/CodeActionMenuPlugin/index.tsx)

```ts
function getMouseInfo(event: MouseEvent): {
  codeDOMNode: HTMLElement | null;
  isOutside: boolean;
} {
  const target = event.target;

  if (target && target instanceof HTMLElement) {
    const codeDOMNode = target.closest<HTMLElement>(
      // HERE 👇 MATCH YOUR LINED-CODE-NODE CLASS NAME
      // (THIS IS THE DEFAULT CLASS)

      'code.lined-code-node',
    );
    const isOutside = !(
      codeDOMNode ||
      target.closest<HTMLElement>('div.code-action-menu-container')
    );

    return {codeDOMNode, isOutside};
  } else {
    return {codeDOMNode: null, isOutside: true};
  }
}
```

2. [(original file)](https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/CodeActionMenuPlugin/components/PrettierButton/index.tsx):

```ts
export function PrettierButton({lang, editor, getCodeDOMNode}: Props) {
  const [syntaxError, setSyntaxError] = useState<string>('');
  const [tipsVisible, setTipsVisible] = useState<boolean>(false);

  async function handleClick(): Promise<void> {
    const codeDOMNode = getCodeDOMNode();

    if (!codeDOMNode) {
      return;
    }

    editor.update(() => {
      const codeNode = $getNearestNodeFromDOMNode(codeDOMNode);

      if ($isLinedCodeNode(codeNode)) {
        const content = codeNode.getTextContent();
        const options = getPrettierOptions(lang);

        let parsed = '';

        try {
          parsed = format(content, options);
        } catch (error: unknown) {
          if (error instanceof Error) {
            setSyntaxError(error.message);
            setTipsVisible(true);
          } else {
            console.error('Unexpected error: ', error);
          }
        }

        // HERE! 👇 UPDATE THIS IF BLOCK! 🤞 THAT SHOULD BE IT...
        // LEXICAL SHOULD SEE LINED_CODE_NODE AS CODE_NODE...

        if (parsed !== '') {
          const parsedTextByLine = parsed.split(/\n/);
          codeNode.getChildren<LinedCodeLineNode>().forEach((line, index) => {
            if (line.getTextContent() !== parsedTextByLine[index]) {
              codeNode.replaceLineCode(parsedTextByLine[index], line);
            }
          });

          setSyntaxError('');
          setTipsVisible(false);
        }
      }
    });
  }

  function handleMouseEnter() {
    if (syntaxError !== '') {
      setTipsVisible(true);
    }
  }

  function handleMouseLeave() {
    if (syntaxError !== '') {
      setTipsVisible(false);
    }
  }

  return (
    <div className="prettier-wrapper">
      <button
        className="menu-item"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="prettier">
        {syntaxError ? (
          <i className="format prettier-error" />
        ) : (
          <i className="format prettier" />
        )}
      </button>
      {tipsVisible ? (
        <pre className="code-error-tips">{syntaxError}</pre>
      ) : null}
    </div>
  );
}
```

Let me know if that doesn't do the trick.
