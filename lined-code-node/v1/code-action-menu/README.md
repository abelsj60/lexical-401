# CodeActionMenu

I know, the Playground has a nifty code-action menu. 

Last I checked, I only needed to make a minor update to the following function [(original file)](https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/CodeActionMenuPlugin/components/PrettierButton/index.tsx): 

```
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
        if (parsed !== '') {
          const parsedTextByLine = parsed.split(/\n/);

          // HERE! 👇 UPDATE THIS STATEMENT! 🤞 THAT SHOULD BE IT...

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