const binsOnLoad = ['7-GG', '8-GG', '317-WD', '6-GG', '26-GG', '1972-SM', '11-GG', '33-GG', '320-WD', '318-WD', '2039-SM', '24-PB', '5-GG', '31-GG', '183-GG', '14-PB', '32-GG', '42-GG', '55-GG', '12-GG']

const canvas = document.getElementById("warehouseCanvas");
const ctx = canvas.getContext("2d");

let squares = [];
let selectedSquare = null;
let resizingCorner = null;
let isDragging = false;
let startX, startY;
let hoverCorner = null;
const DRAG_HANDLE_SIZE = 20;
let shortestPath = null;
let shortestPathLength = Infinity;
let currentBinIndex = 0;
// Add new global variables for modal
let modal = null;
let modalPreviewCanvas = null;
let modalPreviewCtx = null;

// Helper functions
const worker = new Worker(URL.createObjectURL(new Blob([`
  ${manhattanDistance.toString()}
  ${getNeighbors.toString()}
  ${aStar.toString()}
  ${reconstructPath.toString()}

  onmessage = function(e) {
    const { start, end, grid } = e.data;
    const path = aStar(start, end, grid);
    postMessage(path);
  }
`], {type: 'text/javascript'})));
function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Functions
function initializeModal() {
  modal = document.createElement("div");
  modal.classList.add("square-modal-container");
  modal.style.display = "none";

  const modalContent = document.createElement("div");
  modalContent.classList.add("square-modal");

  const previewContainer = document.createElement("div");
  previewContainer.classList.add("modal-square-preview");

  modalPreviewCanvas = document.createElement("canvas");
  modalPreviewCanvas.width = 300;
  modalPreviewCanvas.height = 300;
  modalPreviewCanvas.style.display = "flex";
  modalPreviewCanvas.style.margin = "0 auto";
  modalPreviewCtx = modalPreviewCanvas.getContext("2d");

  previewContainer.appendChild(modalPreviewCanvas);

  const inputPositions = [
    { id: "topLeft", top: "0", left: "0" },
    { id: "topRight", top: "0", right: "0" },
    { id: "bottomLeft", bottom: "0", left: "0" },
    { id: "bottomRight", bottom: "0", right: "0" },
    {
      id: "center",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    },
  ];

  inputPositions.forEach((position) => {
    const input = document.createElement("input");
    input.type = position.id === "center" ? "text" : "number";
    input.id = `modal-${position.id}`;
    input.placeholder = position.id;
    input.classList.add("square-modal-input");
    Object.assign(input.style, position);
    previewContainer.appendChild(input);
  });

  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("square-modal-button-container");

  const createButton = (text, onClick, isPrimary = false) => {
    const button = document.createElement("button");
    button.classList.add("square-modal-action-button");
    button.textContent = text;
    button.onclick = onClick;
    if (isPrimary) {
      button.id = "square-modal-confirm-button";
    } else {
      button.id = "square-modal-cancel-button";
    }
    return button;
  };

  const cancelButton = createButton("Cancel", closeModal);
  const saveButton = createButton("Save", saveModalData, true);

  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(saveButton);

  modalContent.appendChild(previewContainer);
  modalContent.appendChild(buttonContainer);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}
function openModal(square) {
  modal.style.display = "flex";
  updateModalPreview(square);
  populateModalInputs(square);
}
function closeModal() {
  modal.style.display = "none";
}
function updateModalPreview(square) {
  modalPreviewCtx.clearRect(
    0,
    0,
    modalPreviewCanvas.width,
    modalPreviewCanvas.height
  );
  const scale =
    Math.min(
      modalPreviewCanvas.width / square.width,
      modalPreviewCanvas.height / square.height
    ) * 0.8;
  const x = (modalPreviewCanvas.width - square.width * scale) / 2;
  const y = (modalPreviewCanvas.height - square.height * scale) / 2;

  modalPreviewCtx.fillStyle = "rgba(162, 162, 162, 0.32)";
  modalPreviewCtx.fillRect(x, y, square.width * scale, square.height * scale);
  modalPreviewCtx.strokeStyle = "white";
  modalPreviewCtx.strokeRect(x, y, square.width * scale, square.height * scale);

  if (square.label) {
    modalPreviewCtx.fillStyle = "black";
    modalPreviewCtx.font = "16px Arial";
    modalPreviewCtx.textAlign = "center";
    modalPreviewCtx.fillText(
      square.label,
      x + (square.width * scale) / 2,
      y + (square.height * scale) / 2
    );
  }
}
function populateModalInputs(square) {
  ["topLeft", "topRight", "bottomLeft", "bottomRight", "center"].forEach(
    (position) => {
      const input = document.getElementById(`modal-${position}`);
      if (position === "center") {
        input.value = square.label || "";
        input.setAttribute("autocomplete", "off");
      } else {
        input.value = square[position] || "";
      }
    }
  );
}
function saveModalData() {
  if (selectedSquare) {
    ["topLeft", "topRight", "bottomLeft", "bottomRight"].forEach((position) => {
      selectedSquare[position] =
        parseFloat(document.getElementById(`modal-${position}`).value) || 0;
    });
    selectedSquare.label = document.getElementById("modal-center").value;
    drawSquares();
    closeModal();
  }
}
function resizeCanvas() {
  const container = document.getElementById("warehouseContainer");
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  drawSquares();
}
function drawSquares() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  squares.forEach((square, index) => {
    ctx.fillStyle =
      square === selectedSquare
        ? "rgba(39, 176, 245, 0.37)"
        : "rgba(162, 162, 162, 0.32)";
    ctx.fillRect(square.x, square.y, square.width, square.height);
    ctx.strokeStyle = "white";
    ctx.strokeRect(square.x, square.y, square.width, square.height);

    if (square.label) {
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        square.label,
        square.x + square.width / 2,
        square.y + square.height / 2
      );
    }

    if (square === selectedSquare) {
      drawResizeHandles(square);
    }
  });
}
function drawResizeHandles(square) {
  const corners = [
    { x: square.x, y: square.y, type: "topLeft" },
    { x: square.x + square.width, y: square.y, type: "topRight" },
    { x: square.x, y: square.y + square.height, type: "bottomLeft" },
    {
      x: square.x + square.width,
      y: square.y + square.height,
      type: "bottomRight",
    },
  ];

  corners.forEach((corner) => {
    if (hoverCorner && hoverCorner.type === corner.type) {
      const distance = Math.sqrt(
        Math.pow(hoverCorner.mouseX - corner.x, 2) +
          Math.pow(hoverCorner.mouseY - corner.y, 2)
      );
      const size = Math.max(5, 5 - distance);
      ctx.fillStyle = "white";
      ctx.fillRect(corner.x - size / 2, corner.y - size / 2, size, size);
    }
  });
}
function addSquare() {
  const newSquare = findAvailableSpace();
  if (newSquare) {
    newSquare.topLeft = 0;
    newSquare.topRight = 0;
    newSquare.bottomLeft = 0;
    newSquare.bottomRight = 0;
    newSquare.label = "";
    squares.push(newSquare);
    selectedSquare = newSquare;
    drawSquares();
  } else {
    alert("No available space to add a new square.");
  }
}
function findAvailableSpace() {
  const squareSize = 40;
  for (let y = 0; y <= canvas.height - squareSize; y += squareSize) {
    for (let x = 0; x <= canvas.width - squareSize; x += squareSize) {
      if (!isColliding({ x, y, width: squareSize, height: squareSize })) {
        return { x, y, width: squareSize, height: squareSize };
      }
    }
  }
  return null;
}
function isColliding(square) {
  return squares.some(
    (s) =>
      square.x < s.x + s.width &&
      square.x + square.width > s.x &&
      square.y < s.y + s.height &&
      square.y + square.height > s.y
  );
}
function deleteSelectedSquare() {
  if (selectedSquare) {
    squares = squares.filter((s) => s !== selectedSquare);
    selectedSquare = null;
    drawSquares();
  }
}
function handleMouseDown(e) {
  const mousePos = getMousePos(canvas, e);

  selectedSquare = squares.find((square) => isPointInSquare(mousePos, square));

  if (selectedSquare) {
    resizingCorner = getResizingCorner(mousePos, selectedSquare);

    if (resizingCorner) {
      isDragging = false;
    } else {
      isDragging = true;
      startX = mousePos.x - selectedSquare.x;
      startY = mousePos.y - selectedSquare.y;
    }
  } else {
    selectedSquare = null;
    isDragging = false;
    resizingCorner = null;
  }

  drawSquares();
}
function handleDoubleClick(e) {
  const mousePos = getMousePos(canvas, e);
  const clickedSquare = squares.find((square) =>
    isPointInSquare(mousePos, square)
  );

  if (clickedSquare) {
    selectedSquare = clickedSquare;
    openModal(clickedSquare);
  }
}
function handleMouseMove(e) {
  const mousePos = getMousePos(canvas, e);

  if (isDragging && selectedSquare) {
    let newX = mousePos.x - startX;
    let newY = mousePos.y - startY;

    const horizontalMove = { ...selectedSquare, x: newX };
    if (
      !isCollidingWithOthers(horizontalMove) &&
      isWithinCanvas(horizontalMove)
    ) {
      selectedSquare.x = newX;
    }

    const verticalMove = { ...selectedSquare, y: newY };
    if (!isCollidingWithOthers(verticalMove) && isWithinCanvas(verticalMove)) {
      selectedSquare.y = newY;
    }

    drawSquares();
  } else if (resizingCorner && selectedSquare) {
    resizeSquare(mousePos);
    drawSquares();
  } else if (selectedSquare) {
    hoverCorner = getResizingCorner(mousePos, selectedSquare);
    drawSquares();
  }
}
function handleMouseUp() {
  isDragging = false;
  resizingCorner = null;
}
function isInDragArea(point, square) {
  // Check if the point is within the square but not in the resize handle areas
  return (
    point.x >= square.x + DRAG_HANDLE_SIZE &&
    point.x <= square.x + square.width - DRAG_HANDLE_SIZE &&
    point.y >= square.y + DRAG_HANDLE_SIZE &&
    point.y <= square.y + square.height - DRAG_HANDLE_SIZE
  );
}
function getResizingCorner(mousePos, square) {
  const corners = [
    { x: square.x, y: square.y, type: "topLeft" },
    { x: square.x + square.width, y: square.y, type: "topRight" },
    { x: square.x, y: square.y + square.height, type: "bottomLeft" },
    {
      x: square.x + square.width,
      y: square.y + square.height,
      type: "bottomRight",
    },
  ];

  for (let corner of corners) {
    const distance = Math.sqrt(
      Math.pow(mousePos.x - corner.x, 2) + Math.pow(mousePos.y - corner.y, 2)
    );
    if (distance <= DRAG_HANDLE_SIZE) {
      return { ...corner, mouseX: mousePos.x, mouseY: mousePos.y };
    }
  }
  return null;
}
function resizeSquare(mousePos) {
  const minSize = 20;
  let newX = selectedSquare.x;
  let newY = selectedSquare.y;
  let newWidth = selectedSquare.width;
  let newHeight = selectedSquare.height;

  switch (resizingCorner.type) {
    case "topLeft":
      newX = Math.min(
        mousePos.x,
        selectedSquare.x + selectedSquare.width - minSize
      );
      newY = Math.min(
        mousePos.y,
        selectedSquare.y + selectedSquare.height - minSize
      );
      newWidth = selectedSquare.x + selectedSquare.width - newX;
      newHeight = selectedSquare.y + selectedSquare.height - newY;
      break;
    case "topRight":
      newY = Math.min(
        mousePos.y,
        selectedSquare.y + selectedSquare.height - minSize
      );
      newWidth = Math.max(mousePos.x - selectedSquare.x, minSize);
      newHeight = selectedSquare.y + selectedSquare.height - newY;
      break;
    case "bottomLeft":
      newX = Math.min(
        mousePos.x,
        selectedSquare.x + selectedSquare.width - minSize
      );
      newWidth = selectedSquare.x + selectedSquare.width - newX;
      newHeight = Math.max(mousePos.y - selectedSquare.y, minSize);
      break;
    case "bottomRight":
      newWidth = Math.max(mousePos.x - selectedSquare.x, minSize);
      newHeight = Math.max(mousePos.y - selectedSquare.y, minSize);
      break;
  }

  const tempSquare = { x: newX, y: newY, width: newWidth, height: newHeight };
  if (!isCollidingWithOthers(tempSquare) && isWithinCanvas(tempSquare)) {
    Object.assign(selectedSquare, tempSquare);
  }
}
function isCollidingWithOthers(square) {
  return squares.some(
    (s) =>
      s !== selectedSquare &&
      square.x < s.x + s.width &&
      square.x + square.width > s.x &&
      square.y < s.y + s.height &&
      square.y + square.height > s.y
  );
}
function isWithinCanvas(square) {
  return (
    square.x >= 0 &&
    square.y >= 0 &&
    square.x + square.width <= canvas.width &&
    square.y + square.height <= canvas.height
  );
}
function isPointInSquare(point, square) {
  return (
    point.x >= square.x &&
    point.x <= square.x + square.width &&
    point.y >= square.y &&
    point.y <= square.y + square.height
  );
}
function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top,
  };
}
function finalizeLayout() {
  // Check if all squares have data
  const incompleteSquare = squares.find(
    (square) =>
      !square.label ||
      square.topLeft === undefined ||
      square.topRight === undefined ||
      square.bottomLeft === undefined ||
      square.bottomRight === undefined
  );

  if (incompleteSquare) {
    // Highlight the first incomplete square
    selectedSquare = incompleteSquare;
    drawSquares();
    alert("Please complete data for all squares before finalizing the layout.");
    return;
  }

  // Generate the data export
  const exportData = {
    canvas: {
      width: canvas.width,
      height: canvas.height,
    },
    rectangles: squares.map((square, index) => ({
      id: `rect${index + 1}`,
      corners: {
        top_left: { x: square.x, y: square.y },
        top_right: { x: square.x + square.width, y: square.y },
        bottom_left: { x: square.x, y: square.y + square.height },
        bottom_right: {
          x: square.x + square.width,
          y: square.y + square.height,
        },
      },
      corner_values: {
        top_left: square.topLeft,
        top_right: square.topRight,
        bottom_left: square.bottomLeft,
        bottom_right: square.bottomRight,
      },
      label: square.label,
    })),
  };

  // Convert the data to a JSON string
  const jsonOutput = JSON.stringify(exportData, null, 2);

  // Create a Blob with the JSON data
  const blob = new Blob([jsonOutput], { type: "application/json" });

  // Create a temporary URL for the Blob
  const url = URL.createObjectURL(blob);

  // Create a link element and trigger the download
  const link = document.createElement("a");
  link.href = url;
  link.download = "warehouse_layout.json";
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log("Layout saved successfully");
}
function loadLayout() {
  // Create a file input element
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";

  fileInput.onchange = function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const jsonData = JSON.parse(e.target.result);
          applyLayout(jsonData);
        } catch (error) {
          console.error("Error parsing JSON:", error);
          alert("Invalid JSON file. Please try again.");
        }
      };
      reader.readAsText(file);
    }
  };

  fileInput.click();
}
function applyLayout(layoutData) {
  // Resize canvas
  canvas.width = layoutData.canvas.width;
  canvas.height = layoutData.canvas.height;

  // Clear existing squares
  squares = [];

  // Recreate squares from the layout data
  layoutData.rectangles.forEach((rect) => {
    const newSquare = {
      x: rect.corners.top_left.x,
      y: rect.corners.top_left.y,
      width: rect.corners.top_right.x - rect.corners.top_left.x,
      height: rect.corners.bottom_left.y - rect.corners.top_left.y,
      topLeft: rect.corner_values.top_left,
      topRight: rect.corner_values.top_right,
      bottomLeft: rect.corner_values.bottom_left,
      bottomRight: rect.corner_values.bottom_right,
      label: rect.label,
    };
    squares.push(newSquare);
  });

  // Redraw the canvas
  drawSquares();

  // Update the container size if necessary
  const container = document.getElementById("warehouseContainer");
  if (container) {
    container.style.width = `${canvas.width}px`;
    container.style.height = `${canvas.height}px`;
  }

  console.log("Layout loaded successfully");
}
function generateDataStructure() {
  return {
    canvas: {
      width: canvas.width,
      height: canvas.height,
    },
    rectangles: squares.map((square, index) => ({
      id: `rect${index + 1}`,
      corners: {
        top_left: { x: square.x, y: square.y },
        top_right: { x: square.x + square.width, y: square.y },
        bottom_left: { x: square.x, y: square.y + square.height },
        bottom_right: {
          x: square.x + square.width,
          y: square.y + square.height,
        },
      },
      corner_values: {
        top_left: square.topLeft,
        top_right: square.topRight,
        bottom_left: square.bottomLeft,
        bottom_right: square.bottomRight,
      },
      label: square.label,
    })),
  };
}
function findClosestBin() {
  const input = document.getElementById("find-bin").value;
  console.log("Input value:", input);

  const [binNumber, label] = input.split("-");
  const binValue = parseInt(binNumber);
  console.log("Parsed bin value:", binValue, "Label:", label);

  if (isNaN(binValue) || !label) {
    console.log("Invalid input detected");
    alert('Invalid input. Please use the format "number-label".');
    return;
  }

  // Generate the current data structure
  const currentData = generateDataStructure();
  console.log("Current data structure:", currentData);

  // Find rectangles with matching label
  const matchingRectangles = currentData.rectangles.filter(
    (rect) => rect.label === label
  );
  console.log("Matching rectangles:", matchingRectangles);

  if (matchingRectangles.length === 0) {
    console.log("No matching rectangles found");
    alert(`No rectangles found with label "${label}".`);
    return;
  }

  // Find the closest rectangle
  let closestRect = null;
  let minTotalDistance = Infinity;

  matchingRectangles.forEach((rect) => {
    const totalDistance = Object.values(rect.corner_values).reduce(
      (sum, value) => sum + Math.abs(value - binValue),
      0
    );
    if (totalDistance < minTotalDistance) {
      minTotalDistance = totalDistance;
      closestRect = rect;
    }
  });

  console.log("Closest rectangle:", closestRect);

  if (!closestRect) {
    console.log("No close match found");
    alert("Unable to find a close match for the given bin number.");
    return;
  }

  // Calculate weights for each corner
  const weights = {
    top_left: 1 / Math.abs(closestRect.corner_values.top_left - binValue),
    top_right: 1 / Math.abs(closestRect.corner_values.top_right - binValue),
    bottom_left: 1 / Math.abs(closestRect.corner_values.bottom_left - binValue),
    bottom_right:
      1 / Math.abs(closestRect.corner_values.bottom_right - binValue),
  };

  const totalWeight = Object.values(weights).reduce(
    (sum, weight) => sum + weight,
    0
  );

  // Normalize weights
  Object.keys(weights).forEach((key) => {
    weights[key] /= totalWeight;
  });

  console.log("Normalized weights:", weights);

  // Calculate weighted average position
  const x =
    weights.top_left * closestRect.corners.top_left.x +
    weights.top_right * closestRect.corners.top_right.x +
    weights.bottom_left * closestRect.corners.bottom_left.x +
    weights.bottom_right * closestRect.corners.bottom_right.x;

  const y =
    weights.top_left * closestRect.corners.top_left.y +
    weights.top_right * closestRect.corners.top_right.y +
    weights.bottom_left * closestRect.corners.bottom_left.y +
    weights.bottom_right * closestRect.corners.bottom_right.y;

  console.log("Calculated position for red dot: x =", x, "y =", y);

  // Draw the red dot
  drawRedDot(x, y);

  // Redraw the squares to ensure the dot is visible
  drawSquares();
  drawRedDot(x, y);
}
function interpolatePosition(value, min, max, minPos, maxPos) {
  console.log("Interpolating position:");
  console.log("  value:", value, "min:", min, "max:", max);
  console.log("  minPos:", minPos, "maxPos:", maxPos);

  if (min === max) {
    console.log("  min equals max, returning minPos:", minPos);
    return minPos;
  }
  const ratio = (value - min) / (max - min);
  const result = minPos + ratio * (maxPos - minPos);
  console.log("  Calculated ratio:", ratio);
  console.log("  Interpolated result:", result);
  return result;
}
function drawRedDot(x, y) {
  console.log("Drawing red dot at x:", x, "y:", y);

  // Ensure the dot is within the canvas boundaries
  x = Math.max(0, Math.min(x, canvas.width));
  y = Math.max(0, Math.min(y, canvas.height));

  console.log("Adjusted position: x:", x, "y:", y);

  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI); // Increased size for visibility
  ctx.fillStyle = "red";
  ctx.fill();
  ctx.strokeStyle = "white"; // Add a white border for contrast
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.closePath();

  console.log("Red dot drawn");
}
// New Draw Functionality
function getClosestBinCoordinates(input) {
  const [binNumber, label] = input.split("-");
  const binValue = parseInt(binNumber);

  if (isNaN(binValue) || !label) {
    console.error('Invalid input. Please use the format "number-label".');
    return null;
  }

  const currentData = generateDataStructure();
  const matchingRectangles = currentData.rectangles.filter(
    (rect) => rect.label === label
  );

  if (matchingRectangles.length === 0) {
    console.error(`No rectangles found with label "${label}".`);
    return null;
  }

  let closestRect = null;
  let minTotalDistance = Infinity;

  matchingRectangles.forEach((rect) => {
    const totalDistance = Object.values(rect.corner_values).reduce(
      (sum, value) => sum + Math.abs(value - binValue),
      0
    );
    if (totalDistance < minTotalDistance) {
      minTotalDistance = totalDistance;
      closestRect = rect;
    }
  });

  if (!closestRect) {
    console.error("Unable to find a close match for the given bin number.");
    return null;
  }

  const weights = {
    top_left: 1 / Math.abs(closestRect.corner_values.top_left - binValue),
    top_right: 1 / Math.abs(closestRect.corner_values.top_right - binValue),
    bottom_left: 1 / Math.abs(closestRect.corner_values.bottom_left - binValue),
    bottom_right:
      1 / Math.abs(closestRect.corner_values.bottom_right - binValue),
  };

  const totalWeight = Object.values(weights).reduce(
    (sum, weight) => sum + weight,
    0
  );

  Object.keys(weights).forEach((key) => {
    weights[key] /= totalWeight;
  });

  const x =
    weights.top_left * closestRect.corners.top_left.x +
    weights.top_right * closestRect.corners.top_right.x +
    weights.bottom_left * closestRect.corners.bottom_left.x +
    weights.bottom_right * closestRect.corners.bottom_right.x;

  const y =
    weights.top_left * closestRect.corners.top_left.y +
    weights.top_right * closestRect.corners.top_right.y +
    weights.bottom_left * closestRect.corners.bottom_left.y +
    weights.bottom_right * closestRect.corners.bottom_right.y;

  return { x, y };
}
function createGrid(width, height, rectangles) {
  const grid = Array(height)
    .fill()
    .map(() => Array(width).fill(0));

  rectangles.forEach((rect) => {
    const minY = Math.max(0, Math.floor(rect.corners.top_left.y));
    const maxY = Math.min(height - 1, Math.floor(rect.corners.bottom_left.y));
    const minX = Math.max(0, Math.floor(rect.corners.top_left.x));
    const maxX = Math.min(width - 1, Math.floor(rect.corners.top_right.x));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        grid[y][x] = 1;
      }
    }
  });

  return grid;
}

function getNeighbors(node, grid) {
  const neighbors = [];
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  for (const dir of directions) {
    const newX = Math.floor(node.x + dir.dx);
    const newY = Math.floor(node.y + dir.dy);

    if (
      newX >= 0 &&
      newX < grid[0].length &&
      newY >= 0 &&
      newY < grid.length &&
      grid[newY][newX] === 0
    ) {
      neighbors.push({ x: newX, y: newY });
    }
  }

  return neighbors;
}

function aStar(start, goal, grid) {
  const openSet = [start];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(`${start.x},${start.y}`, 0);
  fScore.set(`${start.x},${start.y}`, manhattanDistance(start, goal));

  while (openSet.length > 0) {
    let current = openSet.reduce((a, b) =>
      fScore.get(`${a.x},${a.y}`) < fScore.get(`${b.x},${b.y}`) ? a : b
    );

    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(cameFrom, current);
    }

    openSet.splice(openSet.indexOf(current), 1);

    for (const neighbor of getNeighbors(current, grid)) {
      const tentativeGScore =
        gScore.get(`${current.x},${current.y}`) + 1;

      if (
        !gScore.has(`${neighbor.x},${neighbor.y}`) ||
        tentativeGScore < gScore.get(`${neighbor.x},${neighbor.y}`)
      ) {
        cameFrom.set(`${neighbor.x},${neighbor.y}`, current);
        gScore.set(`${neighbor.x},${neighbor.y}`, tentativeGScore);
        fScore.set(
          `${neighbor.x},${neighbor.y}`,
          tentativeGScore + manhattanDistance(neighbor, goal)
        );

        if (!openSet.some((node) => node.x === neighbor.x && node.y === neighbor.y)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return null; // No path found
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  while (cameFrom.has(`${current.x},${current.y}`)) {
    current = cameFrom.get(`${current.x},${current.y}`);
    path.unshift(current);
  }
  return path;
}

function drawPath(path, color) {
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  path.forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}
function findNearestFreeSpace(point, grid) {
  const maxDistance = 10; // Maximum search distance

  for (let d = 0; d <= maxDistance; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.abs(dx) + Math.abs(dy) === d) {
          const x = Math.floor(point.x + dx);
          const y = Math.floor(point.y + dy);
          if (
            x >= 0 &&
            x < grid[0].length &&
            y >= 0 &&
            y < grid.length &&
            grid[y][x] === 0
          ) {
            return { x, y };
          }
        }
      }
    }
  }

  return null; // No free space found within the search radius
}
function findClosestFreePoint(point, grid) {
  const maxDistance = Math.max(grid.length, grid[0].length); // Search up to the maximum dimension of the grid
  const visited = new Set();

  for (let d = 0; d <= maxDistance; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.abs(dx) + Math.abs(dy) === d) {
          const x = Math.floor(point.x + dx);
          const y = Math.floor(point.y + dy);
          const key = `${x},${y}`;

          if (!visited.has(key)) {
            visited.add(key);
            if (
              x >= 0 &&
              x < grid[0].length &&
              y >= 0 &&
              y < grid.length &&
              grid[y][x] === 0
            ) {
              return { x, y };
            }
          }
        }
      }
    }
  }

  return null; // No free space found within the entire grid
}

function drawPoint(x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.closePath();
}

function mapRoutes() {
  const startBinInput = document.getElementById("start-bin").value;
  const start = getClosestBinCoordinates(startBinInput);

  if (!start) {
    alert("Invalid start bin input.");
    return;
  }

  const currentData = generateDataStructure();
  const grid = createGrid(canvas.width, canvas.height, currentData.rectangles);

  // Find the nearest free space for start point
  const startFree = findClosestFreePoint({ x: Math.floor(start.x), y: Math.floor(start.y) }, grid);

  if (!startFree) {
    alert("Unable to find a valid starting point. Start point is blocked and no free space is available nearby.");
    return;
  }

  // Clear previous drawings
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSquares(); // Redraw the existing squares

  // Draw start point
  drawPoint(start.x, start.y, "blue");

  // Reset global variables
  shortestPath = null;
  shortestPathLength = Infinity;
  currentBinIndex = 0;

  // Start the incremental path calculation
  calculateNextPath(startFree, grid);
}

function calculateNextPath(startFree, grid) {
  if (currentBinIndex >= binsOnLoad.length) {
    // All paths have been calculated
    if (shortestPath) {
      drawPath(shortestPath, "green");
    }
    return;
  }

  const binInput = binsOnLoad[currentBinIndex];
  const end = getClosestBinCoordinates(binInput);

  if (end) {
    const endFree = findClosestFreePoint({ x: Math.floor(end.x), y: Math.floor(end.y) }, grid);
    if (endFree) {
      worker.postMessage({ start: startFree, end: endFree, grid });
      worker.onmessage = function(e) {
        const path = e.data;
        if (path) {
          // Draw the path in light gray
          drawPath(path, "rgba(200, 200, 200, 0.5)");

          // Check if this is the shortest path
          if (path.length < shortestPathLength) {
            shortestPath = path;
            shortestPathLength = path.length;
          }

          // Draw end point
          drawPoint(end.x, end.y, `hsl(${(currentBinIndex * 360) / binsOnLoad.length}, 100%, 50%)`);
        }

        // Move to the next bin
        currentBinIndex++;
        // Schedule the next path calculation
        setTimeout(() => calculateNextPath(startFree, grid), 0);
      };
    } else {
      // If endFree is not found, move to the next bin
      currentBinIndex++;
      setTimeout(() => calculateNextPath(startFree, grid), 0);
    }
  } else {
    // If end is not found, move to the next bin
    currentBinIndex++;
    setTimeout(() => calculateNextPath(startFree, grid), 0);
  }
}

// Global assignments
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
initializeModal();

// Expose functions to be called from HTML
window.drawPath = drawPath;
window.addSquare = addSquare;
window.finalizeLayout = finalizeLayout;
window.deleteSelectedSquare = deleteSelectedSquare;
window.loadLayout = loadLayout;
window.findClosestBin = findClosestBin;
window.mapRoutes = mapRoutes;


canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseup", handleMouseUp);
canvas.addEventListener("dblclick", handleDoubleClick);
