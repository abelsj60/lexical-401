# CodeActionMenu

I know, the Playground has a nifty code-action menu. Last I checked, it'll work with two minor updates.

_Note: The `CodeActionMenu` should work in production, even if it doesn't in development. Something funny may be going on with React 18's double strict render. You can test the production version for yourself the main ReadMe._

1. [CodeActionMenu.tsx](https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/CodeActionMenuPlugin/index.tsx)

    a. Update the mutation listener

    ```ts
    <!-- HERE! 👇 UPDATE THE NODE FROM CODE_NODE TO LINED_CODE_NODE -->

    editor.registerMutationListener(LinedCodeNode, (mutations) => {
      editor.getEditorState().read(() => {
        for (const [key, type] of mutations) {
          switch (type) {
            case "created":
              codeSetRef.current.add(key);
              setShouldListenMouseMove(codeSetRef.current.size > 0);
              break;

            case "destroyed":
              codeSetRef.current.delete(key);
              setShouldListenMouseMove(codeSetRef.current.size > 0);
              break;

            default:
              break;
          }
        }
      });
    });
    ```

    b. Update the mouse utility

    ```ts
    function getMouseInfo(event: MouseEvent): {
      codeDOMNode: HTMLElement | null;
      isOutside: boolean;
    } {
      const target = event.target;

      if (target && target instanceof HTMLElement) {
        const codeDOMNode = target.closest<HTMLElement>(

          <!-- HERE! 👇 UPDATE THIS CLASS NAME TO MATCH YOURS -->

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

2. [PrettierButton.tsx](https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/CodeActionMenuPlugin/components/PrettierButton/index.tsx):

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

            <!-- HERE! 👇 UPDATE THIS IF BLOCK TO WORK WITH INDIVIDUAL LINES! -->

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

