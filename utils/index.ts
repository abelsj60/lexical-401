interface SetBlocksTypeOptions_experimental {
  createParentBlock?: (
    childBlocks: ElementNode[] | LexicalNode[],
    selectionNodes: ElementNode[] | LexicalNode[],
  ) => ElementNode | LexicalNode;
  handleShadowRoot?: (node: ElementNode | LexicalNode) => void;
  collapseShadowRootNodes?: boolean;
}

/**
 * Converts all nodes in the selection that are of one block type to another specified by parameter
 *
 * @param selection
 * @param createElement
 * @returns
 */
export function $setBlocksType_experimental(
  selection: RangeSelection | GridSelection,
  createElement: (
    blockNode?: ElementNode | LexicalNode,
    selectionNodes?: ElementNode[] | LexicalNode[],
  ) => ElementNode | LexicalNode,
  options?: SetBlocksTypeOptions_experimental,
) {
  // 1. special handling for root

  if (selection.anchor.key === 'root') {
    const element = createElement();
    const root = $getRoot();
    const firstChild = root.getFirstChild();
    if (firstChild) firstChild.replace(element, true);
    else root.append(element);
    return [element];
  }

  // 2. standard setup

  let nodes = selection.getNodes();
  const createElementTarget = (
    blockNode: ElementNode | LexicalNode,
    selectionNodes: ElementNode[] | LexicalNode[],
  ) => {
    if (!isBlock(blockNode)) return null;
    const targetElement = createElement(blockNode, selectionNodes);
    targetElement.setFormat(blockNode.getFormatType());
    targetElement.setIndent(blockNode.getIndent());
    return targetElement;
  };

  // 3. special handling for anchor type text

  if (selection.anchor.type === 'text') {
    let firstBlock = selection.anchor.getNode().getParent() as LexicalNode;
    firstBlock = (
      firstBlock.isInline() ? firstBlock.getParent() : firstBlock
    ) as LexicalNode;
    if (nodes.indexOf(firstBlock) === -1) nodes.push(firstBlock);
  }

  // 4. optionally collapse shadowRoot nodes

  const handleShadowRoot =
    options && (options.collapseShadowRootNodes || options.handleShadowRoot);

  if (handleShadowRoot) {
    const nodesAfterShadowRootCollapse = collapseShadowRoots(nodes, options);

    if (nodesAfterShadowRootCollapse.length > 0) {
      nodes = nodesAfterShadowRootCollapse;
    }
  }

  // 5. standard node conversion path

  if (!options || !options.createParentBlock) {
    const targetElements = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const targetElement = createElementTarget(node, nodes);
      if (!targetElement) continue;
      targetElements.push(targetElement);
      node.replace(targetElement, true);
    }

    return targetElements;
  }

  // 6. advanced path for nested node creation

  if (options && options.createParentBlock) {
    const childBlocks = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const targetElement = createElementTarget(node, nodes);
      if (targetElement === null) continue;
      childBlocks.push(targetElement);
    }

    const shadowRootIdx = nodes.findIndex((node) => isBlock(node));
    const parentBlock = options.createParentBlock(childBlocks, nodes);

    ((node) => node && node.replace(parentBlock))(nodes[shadowRootIdx]);
    nodes.forEach((node, idx) =>
      idx !== shadowRootIdx ? node.remove() : undefined,
    );

    return [parentBlock];
  }

  return [];
}

function collapseShadowRoots(
  nodes: ElementNode[] | LexicalNode[],
  options: SetBlocksTypeOptions_experimental,
) {
  const shadows = [];
  const shadowRootKeys = new Set<string>();
  const nodesAndShadows: (ElementNode | LexicalNode | string)[] = [...nodes];
  const dirtyNodeSets: Record<string, Set<string>> = {};

  const getShadowKey = (key: string) => `shadowRoot-${key}`;
  const isShadow = (key: string, maybeKey: LexicalNode | string) => {
    return getShadowKey(key) === maybeKey;
  };

  // 1. collect shadowRoot and dirty node keys

  nodes.forEach((node) => {
    node.getParents().forEach((parent) => {
      const nodeKey = node.getKey();
      const parentKey = parent.getKey();

      if (parentKey !== 'root' && parent.isShadowRoot()) {
        const dirtyNodeSet = dirtyNodeSets[parentKey];

        // mark each selected node as dirty if it is a child of
        // shadowRoot. note: we assume selection.getNodes()
        // returns a stable sequence of shadow nodes

        if (!dirtyNodeSet) {
          dirtyNodeSets[parentKey] = new Set();
          dirtyNodeSets[parentKey].add(nodeKey);
        } else if (!dirtyNodeSet.has(nodeKey)) {
          dirtyNodeSet.add(nodeKey);
        }

        if (!shadowRootKeys.has(parentKey)) {
          shadowRootKeys.add(parentKey);
        }
      }
    });
  });

  // 2. handle the shadows in a consistent manner. default is to
  // collapseAtStart, but custom handling is possible

  for (const shadowRootKey of shadowRootKeys) {
    const shadowRootNode = $getNodeByKey(shadowRootKey);

    if (shadowRootNode !== null) {
      const shadowRootIndex = shadowRootNode.getIndexWithinParent();
      const shadowRootLength = shadowRootNode.getChildrenSize();

      // shadow the shadow for slicing and splicing
      shadows.push([shadowRootKey, shadowRootIndex, shadowRootLength]);

      // make the shadow something else
      if (options.handleShadowRoot !== undefined) {
        options.handleShadowRoot(shadowRootNode);
      } else {
        shadowRootNode.collapseAtStart();
      }
    }
  }

  // 3. mark shadowRoot children for replacement

  Object.entries(dirtyNodeSets).forEach((keyAndSet) => {
    const [shadowKey, dirtyNodeSet] = keyAndSet;

    for (const nodeKey of dirtyNodeSet) {
      const nodeIndex = nodesAndShadows.findIndex((maybeNode) => {
        return typeof maybeNode !== 'string' && maybeNode.getKey() === nodeKey;
      });

      if (nodeIndex > -1) {
        nodesAndShadows[nodeIndex] = getShadowKey(shadowKey);
      }
    }
  });

  // 4. finally, replace the shadowRoot children

  shadows.forEach((shadow) => {
    const [shadowKey, shadowStart] = shadow;
    const shadowEnd = shadowStart + shadow[2];
    const allChildren = $getRoot().getChildren();
    const newChildren = allChildren.slice(shadowStart, shadowEnd);

    const spliceStart = nodesAndShadows.findIndex((maybeKey) => {
      return isShadow(shadowKey, maybeKey);
    });
    const deleteCount = nodesAndShadows.filter((maybeKey) => {
      return isShadow(shadowKey, maybeKey);
    }).length;

    nodesAndShadows.splice(spliceStart, deleteCount, ...newChildren);
  });

  return nodesAndShadows as (ElementNode | LexicalNode)[];
}

function isBlock(node: LexicalNode) {
  return $isElementNode(node) && !$isRootOrShadowRoot(node) && !node.isInline();
}
