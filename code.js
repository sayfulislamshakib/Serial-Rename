// Show the Figma Plugin UI window with standard 250x135 dimensions
figma.showUI(__html__, { width: 250, height: 135, themeColors: true });


// Listen for selection changes in the active Figma document
figma.on("selectionchange", () => {
  sendSelectionToUI();
});

// Listen for messages received from the HTML UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'request-selection') {
    sendSelectionToUI();
  } else if (msg.type === 'resize') {
    figma.ui.resize(250, Math.ceil(msg.height));
  } else if (msg.type === 'rename') {
    const renames = msg.renames || [];
    let renamedCount = 0;
    let alreadyNamedCount = 0;

    for (const item of renames) {
      const node = await figma.getNodeByIdAsync(item.id);
      if (node && !node.removed) {
        if (node.name === item.newName) {
          alreadyNamedCount++;
        } else {
          node.name = item.newName;
          renamedCount++;
        }
      }
    }

    if (renamedCount === 0 && alreadyNamedCount > 0) {
      const layerWord = alreadyNamedCount === 1 ? 'Layer is' : 'Layers are';
      figma.notify(`✅ ${layerWord} already renamed!`);
    } else if (renamedCount > 0 && alreadyNamedCount > 0) {
      const renameWord = renamedCount === 1 ? 'layer' : 'layers';
      figma.notify(`🎉 Successfully renamed ${renamedCount} ${renameWord}! (${alreadyNamedCount} already correct)`);
    } else {
      const renameWord = renamedCount === 1 ? 'layer' : 'layers';
      figma.notify(`🚀 Successfully renamed ${renamedCount} ${renameWord}!`);
    }

    // Refresh selection data in UI to reflect the updated names
    sendSelectionToUI();
  }
};

/**
 * Gathers the current selection in Figma and forwards the data to the UI using global absolute coordinates.
 * Uses absoluteBoundingBox for reliable absolute page positions.
 */
function sendSelectionToUI() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'selection', selection: [], singleNodeSiblings: [] });
    return;
  }

  // Helper to extract absolute coordinates from a node
  function getAbsoluteCoords(node) {
    const bb = node.absoluteBoundingBox;
    if (bb) {
      return { x: bb.x, y: bb.y, height: bb.height };
    }
    return { x: node.x, y: node.y, height: node.height || 0 };
  }

  // Map selection details using absolute bounding box coordinates
  const selectionData = selection.map(node => {
    const coords = getAbsoluteCoords(node);
    return {
      id: node.id,
      parentId: node.parent ? node.parent.id : null,
      name: node.name,
      type: node.type,
      x: coords.x,
      y: coords.y,
      height: coords.height
    };
  });

  // Gather sibling layers under the parents of all selected nodes
  const parentIds = new Set();
  const siblingsData = [];

  for (const node of selection) {
    const parent = node.parent;
    if (parent && 'children' in parent && !parentIds.has(parent.id)) {
      parentIds.add(parent.id);
      for (const child of parent.children) {
        const coords = getAbsoluteCoords(child);
        siblingsData.push({
          id: child.id,
          parentId: parent.id,
          name: child.name,
          type: child.type,
          x: coords.x,
          y: coords.y,
          height: coords.height
        });
      }
    }
  }

  figma.ui.postMessage({
    type: 'selection',
    selection: selectionData,
    singleNodeSiblings: siblingsData // Keep property name the same to minimize changes in ui.html if needed, or rename
  });
}