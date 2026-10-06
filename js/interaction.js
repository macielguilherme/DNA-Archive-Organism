/* ============================================================
   DNA — EXPERIMENTAL ARCHIVE ORGANISM
   interaction.js
   ------------------------------------------------------------
   INTERACTION ENGINE

   Responsabilidades:
   - Mouse tracking
   - Proximidade do cursor
   - Hover sobre nós
   - Seleção de nós
   - Clique no organismo
   - Wheel / zoom lógico
   - Teclado
   - Tooltip
   - Comunicação com DNADocuments
   - Comunicação com DNAConnections
   - Eventos globais

   NÃO RESPONSÁVEL POR:
   - Layout
   - CSS
   - HUD
   - Animações CSS
   - Persistência dos documentos
   ============================================================ */

"use strict";


/* ============================================================
   01. CONFIGURATION
   ============================================================ */

const INTERACTION_CONFIG = {

    enabled: true,

    mouseRadius: 180,

    hoverRadius: 28,

    clickRadius: 34,

    zoomMin: 0.65,

    zoomMax: 1.75,

    zoomStep: 0.08,

    zoomDefault: 1,

    wheelEnabled: true,

    keyboardEnabled: true,

    tooltipEnabled: true,

    selectionEnabled: true,

    proximityEnabled: true,

    preventContextMenu:
        false,

    doubleClickDelay:
        280,

    debug:
        false
};


/* ============================================================
   02. STATE
   ============================================================ */

const INTERACTION_STATE = {

    initialized:
        false,

    pointer: {

        x: 0,

        y: 0,

        clientX: 0,

        clientY: 0,

        normalizedX: 0,

        normalizedY: 0,

        inside:
            false,

        moved:
            false,

        down:
            false
    },

    previousPointer: {

        x: 0,

        y: 0
    },

    velocity: {

        x: 0,

        y: 0,

        magnitude: 0
    },

    proximity: {

        active:
            false,

        distance:
            Infinity,

        intensity:
            0,

        angle:
            0
    },

    hover: {

        node:
            null,

        document:
            null,

        distance:
            Infinity
    },

    selection: {

        node:
            null,

        document:
            null
    },

    camera: {

        zoom:
            INTERACTION_CONFIG.zoomDefault
    },

    click: {

        lastTime:
            0,

        lastNode:
            null
    },

    keyboard: {

        shift:
            false,

        ctrl:
            false,

        alt:
            false,

        space:
            false
    }
};


/* ============================================================
   03. DOM
   ============================================================ */

const INTERACTION_DOM = {

    stage:
        null,

    canvas:
        null,

    tooltip:
        null
};


/* ============================================================
   04. NODE REGISTRY
   ============================================================ */

const INTERACTION_NODES = new Map();


/* ============================================================
   05. INITIALIZE
   ============================================================ */

function initializeInteractions(
    options = {}
) {

    if (
        INTERACTION_STATE.initialized
    ) {

        return INTERACTION_STATE;
    }

    if (
        options &&
        typeof options === "object"
    ) {

        Object.assign(
            INTERACTION_CONFIG,
            options
        );
    }

    resolveInteractionDOM();

    bindInteractionEvents();

    INTERACTION_STATE.initialized =
        true;

    dispatchInteractionEvent(
        "dna:interaction-ready"
    );

    interactionLog(
        "Interaction engine initialized."
    );

    return INTERACTION_STATE;
}


/* ============================================================
   06. RESOLVE DOM
   ============================================================ */

function resolveInteractionDOM() {

    INTERACTION_DOM.stage =
        document.querySelector(
            ".organism-stage"
        );

    INTERACTION_DOM.canvas =
        document.querySelector(
            ".organism-canvas"
        );

    INTERACTION_DOM.tooltip =
        document.querySelector(
            ".node-tooltip"
        );
}


/* ============================================================
   07. BIND EVENTS
   ============================================================ */

function bindInteractionEvents() {

    const target =
        INTERACTION_DOM.stage ||
        INTERACTION_DOM.canvas ||
        document;

    target.addEventListener(
        "pointermove",
        handlePointerMove,
        {
            passive: true
        }
    );

    target.addEventListener(
        "pointerenter",
        handlePointerEnter,
        {
            passive: true
        }
    );

    target.addEventListener(
        "pointerleave",
        handlePointerLeave,
        {
            passive: true
        }
    );

    target.addEventListener(
        "pointerdown",
        handlePointerDown,
        {
            passive: true
        }
    );

    target.addEventListener(
        "pointerup",
        handlePointerUp,
        {
            passive: true
        }
    );

    target.addEventListener(
        "click",
        handleClick
    );

    target.addEventListener(
        "dblclick",
        handleDoubleClick
    );

    if (
        INTERACTION_CONFIG.wheelEnabled
    ) {

        target.addEventListener(
            "wheel",
            handleWheel,
            {
                passive: false
            }
        );
    }

    if (
        INTERACTION_CONFIG.keyboardEnabled
    ) {

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        document.addEventListener(
            "keyup",
            handleKeyUp
        );
    }

    if (
        INTERACTION_CONFIG.preventContextMenu
    ) {

        target.addEventListener(
            "contextmenu",
            event => {
                event.preventDefault();
            }
        );
    }
}


/* ============================================================
   08. POINTER ENTER
   ============================================================ */

function handlePointerEnter(
    event
) {

    INTERACTION_STATE.pointer.inside =
        true;

    updatePointerPosition(
        event
    );

    dispatchInteractionEvent(
        "dna:pointer-enter",
        {
            pointer:
                getPointerSnapshot()
        }
    );
}


/* ============================================================
   09. POINTER LEAVE
   ============================================================ */

function handlePointerLeave(
    event
) {

    INTERACTION_STATE.pointer.inside =
        false;

    INTERACTION_STATE.proximity.active =
        false;

    INTERACTION_STATE.proximity.distance =
        Infinity;

    INTERACTION_STATE.proximity.intensity =
        0;

    clearHover();

    hideTooltip();

    dispatchInteractionEvent(
        "dna:pointer-leave",
        {
            pointer:
                getPointerSnapshot()
        }
    );
}


/* ============================================================
   10. POINTER MOVE
   ============================================================ */

function handlePointerMove(
    event
) {

    if (
        !INTERACTION_CONFIG.enabled
    ) {

        return;
    }

    updatePointerPosition(
        event
    );

    updatePointerVelocity();

    updateProximity();

    updateHover();

    updateTooltip();

    dispatchInteractionEvent(
        "dna:pointer-move",
        {
            pointer:
                getPointerSnapshot(),

            velocity:
                {
                    ...INTERACTION_STATE.velocity
                },

            proximity:
                {
                    ...INTERACTION_STATE.proximity
                }
        }
    );
}


/* ============================================================
   11. UPDATE POINTER
   ============================================================ */

function updatePointerPosition(
    event
) {

    const rect =
        getStageRect();

    if (!rect) {
        return;
    }

    const x =
        event.clientX -
        rect.left;

    const y =
        event.clientY -
        rect.top;

    INTERACTION_STATE.previousPointer.x =
        INTERACTION_STATE.pointer.x;

    INTERACTION_STATE.previousPointer.y =
        INTERACTION_STATE.pointer.y;

    INTERACTION_STATE.pointer.x =
        x;

    INTERACTION_STATE.pointer.y =
        y;

    INTERACTION_STATE.pointer.clientX =
        event.clientX;

    INTERACTION_STATE.pointer.clientY =
        event.clientY;

    INTERACTION_STATE.pointer.normalizedX =
        rect.width
            ? x / rect.width
            : 0.5;

    INTERACTION_STATE.pointer.normalizedY =
        rect.height
            ? y / rect.height
            : 0.5;

    INTERACTION_STATE.pointer.moved =
        true;
}


/* ============================================================
   12. POINTER VELOCITY
   ============================================================ */

function updatePointerVelocity() {

    const dx =
        INTERACTION_STATE.pointer.x -
        INTERACTION_STATE.previousPointer.x;

    const dy =
        INTERACTION_STATE.pointer.y -
        INTERACTION_STATE.previousPointer.y;

    const magnitude =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    INTERACTION_STATE.velocity.x =
        dx;

    INTERACTION_STATE.velocity.y =
        dy;

    INTERACTION_STATE.velocity.magnitude =
        magnitude;
}


/* ============================================================
   13. PROXIMITY
   ============================================================ */

function updateProximity() {

    if (
        !INTERACTION_CONFIG.proximityEnabled
    ) {

        return;
    }

    const center =
        getOrganismCenter();

    if (!center) {
        return;
    }

    const dx =
        INTERACTION_STATE.pointer.x -
        center.x;

    const dy =
        INTERACTION_STATE.pointer.y -
        center.y;

    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    const radius =
        INTERACTION_CONFIG.mouseRadius;

    const intensity =
        Math.max(
            0,
            Math.min(
                1,
                1 -
                distance / radius
            )
        );

    INTERACTION_STATE.proximity.distance =
        distance;

    INTERACTION_STATE.proximity.intensity =
        intensity;

    INTERACTION_STATE.proximity.active =
        intensity > 0;

    INTERACTION_STATE.proximity.angle =
        Math.atan2(
            dy,
            dx
        );

    dispatchInteractionEvent(
        "dna:proximity-change",
        {
            proximity:
                {
                    ...INTERACTION_STATE.proximity
                }
        }
    );
}


/* ============================================================
   14. ORGANISM CENTER
   ============================================================ */

function getOrganismCenter() {

    const canvas =
        INTERACTION_DOM.canvas;

    if (!canvas) {

        const rect =
            getStageRect();

        if (!rect) {
            return null;
        }

        return {

            x:
                rect.width / 2,

            y:
                rect.height / 2
        };
    }

    return {

        x:
            canvas.clientWidth / 2,

        y:
            canvas.clientHeight / 2
    };
}


/* ============================================================
   15. REGISTER NODE
   ============================================================ */

function registerNode(
    node
) {

    if (
        !node
    ) {

        return null;
    }

    const id =
        getNodeId(
            node
        );

    if (!id) {

        return null;
    }

    const normalized = {

        ...node,

        id,

        x:
            Number(
                node.x
            ) || 0,

        y:
            Number(
                node.y
            ) || 0,

        radius:
            Number(
                node.radius
            ) || 8,

        documentId:
            node.documentId ||
            node.id ||
            null
    };

    INTERACTION_NODES.set(
        id,
        normalized
    );

    return normalized;
}


/* ============================================================
   16. REGISTER NODES
   ============================================================ */

function registerNodes(
    nodes = []
) {

    INTERACTION_NODES.clear();

    if (
        !Array.isArray(
            nodes
        )
    ) {

        return [];
    }

    return nodes
        .map(
            registerNode
        )
        .filter(
            Boolean
        );
}


/* ============================================================
   17. UPDATE NODE
   ============================================================ */

function updateNode(
    id,
    changes = {}
) {

    const node =
        INTERACTION_NODES.get(
            String(id)
        );

    if (!node) {

        return null;
    }

    Object.assign(
        node,
        changes
    );

    return node;
}


/* ============================================================
   18. REMOVE NODE
   ============================================================ */

function removeNode(
    id
) {

    return INTERACTION_NODES.delete(
        String(id)
    );
}


/* ============================================================
   19. CLEAR NODES
   ============================================================ */

function clearNodes() {

    INTERACTION_NODES.clear();

    clearHover();

    clearNodeSelection();
}


/* ============================================================
   20. GET NODE
   ============================================================ */

function getNode(
    id
) {

    return (
        INTERACTION_NODES.get(
            String(id)
        ) ||
        null
    );
}


/* ============================================================
   21. GET NODES
   ============================================================ */

function getNodes() {

    return [
        ...INTERACTION_NODES.values()
    ];
}


/* ============================================================
   22. FIND NODE AT POINTER
   ============================================================ */

function findNodeAtPointer(
    radiusMultiplier = 1
) {

    const pointer =
        INTERACTION_STATE.pointer;

    let closest =
        null;

    let closestDistance =
        Infinity;

    for (
        const node of
        INTERACTION_NODES.values()
    ) {

        const dx =
            pointer.x -
            node.x;

        const dy =
            pointer.y -
            node.y;

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        const hitRadius =
            Math.max(
                INTERACTION_CONFIG.hoverRadius,
                node.radius ||
                0
            ) *
            radiusMultiplier;

        if (
            distance <= hitRadius &&
            distance <
            closestDistance
        ) {

            closest =
                node;

            closestDistance =
                distance;
        }
    }

    return {

        node:
            closest,

        distance:
            closestDistance
    };
}


/* ============================================================
   23. UPDATE HOVER
   ============================================================ */

function updateHover() {

    const result =
        findNodeAtPointer();

    const previous =
        INTERACTION_STATE.hover.node;

    if (
        result.node
    ) {

        INTERACTION_STATE.hover.node =
            result.node;

        INTERACTION_STATE.hover.distance =
            result.distance;

        const documentData =
            resolveNodeDocument(
                result.node
            );

        INTERACTION_STATE.hover.document =
            documentData;

        if (
            previous?.id !==
            result.node.id
        ) {

            dispatchInteractionEvent(
                "dna:node-enter",
                {
                    node:
                        result.node,

                    document:
                        documentData,

                    distance:
                        result.distance
                }
            );
        }

        return;
    }

    if (
        previous
    ) {

        dispatchInteractionEvent(
            "dna:node-leave",
            {
                node:
                    previous
            }
        );
    }

    clearHover();
}


/* ============================================================
   24. CLEAR HOVER
   ============================================================ */

function clearHover() {

    INTERACTION_STATE.hover.node =
        null;

    INTERACTION_STATE.hover.document =
        null;

    INTERACTION_STATE.hover.distance =
        Infinity;
}


/* ============================================================
   25. RESOLVE NODE DOCUMENT
   ============================================================ */

function resolveNodeDocument(
    node
) {

    if (
        !node
    ) {

        return null;
    }

    const documentEngine =
        window.DNADocuments;

    if (
        !documentEngine
    ) {

        return null;
    }

    if (
        node.documentId
    ) {

        return documentEngine.getById(
            node.documentId
        );
    }

    if (
        node.id
    ) {

        return documentEngine.getById(
            node.id
        );
    }

    return null;
}


/* ============================================================
   26. UPDATE TOOLTIP
   ============================================================ */

function updateTooltip() {

    if (
        !INTERACTION_CONFIG.tooltipEnabled
    ) {

        return;
    }

    const node =
        INTERACTION_STATE.hover.node;

    if (!node) {

        hideTooltip();

        return;
    }

    const tooltip =
        getTooltip();

    if (!tooltip) {
        return;
    }

    const documentData =
        INTERACTION_STATE.hover.document;

    tooltip.innerHTML =
        buildTooltipHTML(
            node,
            documentData
        );

    tooltip.style.left =
        `${INTERACTION_STATE.pointer.clientX + 16}px`;

    tooltip.style.top =
        `${INTERACTION_STATE.pointer.clientY + 16}px`;

    tooltip.classList.add(
        "is-visible"
    );
}


/* ============================================================
   27. BUILD TOOLTIP
   ============================================================ */

function buildTooltipHTML(
    node,
    documentData
) {

    if (
        documentData
    ) {

        return `
            <div class="node-tooltip__id">
                DOCUMENT NODE #${escapeHTML(
                    documentData.id
                )}
            </div>

            <div class="node-tooltip__type">
                ${escapeHTML(
                    documentData.type || documentData.detectedType
                )}
            </div>

            <div class="node-tooltip__meta">
                ${escapeHTML(
                    documentData.classification || "UNKNOWN"
                )}
                ·
                ${escapeHTML(
                    String(
                        documentData.analysis?.years?.join(", ") || "UNKNOWN"
                    )
                )}
            </div>

            <div class="node-tooltip__status">
                ${escapeHTML(
                    documentData.retention || "UNKNOWN"
                )}
            </div>
        `;
    }

    return `
        <div class="node-tooltip__id">
            NODE ${escapeHTML(
                node.id
            )}
        </div>

        <div class="node-tooltip__type">
            ORGANISM STRUCTURE
        </div>
    `;
}


/* ============================================================
   28. GET TOOLTIP
   ============================================================ */

function getTooltip() {

    if (
        INTERACTION_DOM.tooltip
    ) {

        return INTERACTION_DOM.tooltip;
    }

    const tooltip =
        document.createElement(
            "div"
        );

    tooltip.className =
        "node-tooltip";

    document.body.appendChild(
        tooltip
    );

    INTERACTION_DOM.tooltip =
        tooltip;

    return tooltip;
}


/* ============================================================
   29. HIDE TOOLTIP
   ============================================================ */

function hideTooltip() {

    if (
        INTERACTION_DOM.tooltip
    ) {

        INTERACTION_DOM.tooltip.classList
            .remove(
                "is-visible"
            );
    }
}


/* ============================================================
   30. CLICK
   ============================================================ */

function handleClick(
    event
) {

    const canvas = INTERACTION_DOM.canvas;
    if (canvas?.dataset.dragged === "true") {
        delete canvas.dataset.dragged;
        return;
    }

    if (
        !INTERACTION_CONFIG.enabled
    ) {

        return;
    }

    updatePointerPosition(
        event
    );

    const result =
        findNodeAtPointer(
            1.15
        );

    if (
        !result.node
    ) {

        clearNodeSelection();

        dispatchInteractionEvent(
            "dna:organism-click",
            {
                empty:
                    true,

                pointer:
                    getPointerSnapshot()
            }
        );

        return;
    }

    selectNode(
        result.node
    );
}


/* ============================================================
   31. DOUBLE CLICK
   ============================================================ */

function handleDoubleClick(
    event
) {

    updatePointerPosition(
        event
    );

    const result =
        findNodeAtPointer(
            1.25
        );

    if (
        !result.node
    ) {

        return;
    }

    const documentData =
        resolveNodeDocument(
            result.node
        );

    dispatchInteractionEvent(
        "dna:node-double-click",
        {
            node:
                result.node,

            document:
                documentData
        }
    );

    openDocument(
        documentData
    );
}


/* ============================================================
   32. POINTER DOWN
   ============================================================ */

function handlePointerDown(
    event
) {

    INTERACTION_STATE.pointer.down =
        true;

    updatePointerPosition(
        event
    );

    dispatchInteractionEvent(
        "dna:pointer-down",
        {
            pointer:
                getPointerSnapshot()
        }
    );
}


/* ============================================================
   33. POINTER UP
   ============================================================ */

function handlePointerUp(
    event
) {

    INTERACTION_STATE.pointer.down =
        false;

    updatePointerPosition(
        event
    );

    dispatchInteractionEvent(
        "dna:pointer-up",
        {
            pointer:
                getPointerSnapshot()
        }
    );
}


/* ============================================================
   34. SELECT NODE
   ============================================================ */

function selectNode(
    node
) {

    if (
        !node
    ) {

        return null;
    }

    const documentData =
        resolveNodeDocument(
            node
        );

    INTERACTION_STATE.selection.node =
        node;

    INTERACTION_STATE.selection.document =
        documentData;

    if (
        documentData &&
        window.DNADocuments
    ) {

        window.DNADocuments.select(
            documentData.id
        );
    }

    if (
        documentData
    ) {

        openDocument(
            documentData
        );
    }

    dispatchInteractionEvent(
        "dna:node-selected",
        {
            node,

            document:
                documentData
        }
    );

    return node;
}


/* ============================================================
   35. CLEAR NODE SELECTION
   ============================================================ */

function clearNodeSelection() {

    const previous =
        INTERACTION_STATE.selection;

    INTERACTION_STATE.selection.node =
        null;

    INTERACTION_STATE.selection.document =
        null;

    if (
        window.DNADocuments
    ) {

        window.DNADocuments.clearSelection();
    }

    if (
        previous.node ||
        previous.document
    ) {

        dispatchInteractionEvent(
            "dna:node-selection-cleared",
            {
                previous
            }
        );
    }
}


/* ============================================================
   36. OPEN DOCUMENT
   ============================================================ */

function openDocument(
    documentData
) {

    if (window.DNADocuments?.select && documentData.id) {
        window.DNADocuments.select(documentData.id);
        return;
    }

    if (
        !documentData
    ) {

        return;
    }

    if (
        window.DNA &&
        typeof window.DNA.selectDocument ===
        "function"
    ) {

        window.DNA.selectDocument(
            documentData
        );

        return;
    }

    dispatchInteractionEvent(
        "dna:open-document",
        {
            document:
                documentData
        }
    );
}


/* ============================================================
   37. WHEEL
   ============================================================ */

function handleWheel(
    event
) {

    if (
        !INTERACTION_CONFIG.wheelEnabled
    ) {

        return;
    }

    event.preventDefault();

    const direction =
        event.deltaY > 0
            ? -1
            : 1;

    const amount =
        INTERACTION_CONFIG.zoomStep *
        direction;

    setZoom(
        INTERACTION_STATE.camera.zoom +
        amount
    );

    dispatchInteractionEvent(
        "dna:zoom",
        {
            zoom:
                INTERACTION_STATE.camera.zoom,

            direction
        }
    );
}


/* ============================================================
   38. SET ZOOM
   ============================================================ */

function setZoom(
    value
) {

    const zoom =
        Math.max(
            INTERACTION_CONFIG.zoomMin,
            Math.min(
                INTERACTION_CONFIG.zoomMax,
                Number(
                    value
                ) ||
                INTERACTION_CONFIG.zoomDefault
            )
        );

    INTERACTION_STATE.camera.zoom =
        zoom;

    dispatchInteractionEvent(
        "dna:camera-change",
        {
            camera:
                {
                    ...INTERACTION_STATE.camera
                }
        }
    );

    return zoom;
}


/* ============================================================
   39. RESET ZOOM
   ============================================================ */

function resetZoom() {

    return setZoom(
        INTERACTION_CONFIG.zoomDefault
    );
}


/* ============================================================
   40. KEY DOWN
   ============================================================ */

function handleKeyDown(
    event
) {

    if (
        isTypingContext(
            event.target
        )
    ) {

        return;
    }

    INTERACTION_STATE.keyboard.shift =
        event.shiftKey;

    INTERACTION_STATE.keyboard.ctrl =
        event.ctrlKey;

    INTERACTION_STATE.keyboard.alt =
        event.altKey;

    INTERACTION_STATE.keyboard.space =
        event.code ===
        "Space";

    switch (
        event.key.toLowerCase()
    ) {

        case "escape":

            clearNodeSelection();

            hideTooltip();

            break;

        case "+":

        case "=":

            setZoom(
                INTERACTION_STATE.camera.zoom +
                INTERACTION_CONFIG.zoomStep
            );

            break;

        case "-":

        case "_":

            setZoom(
                INTERACTION_STATE.camera.zoom -
                INTERACTION_CONFIG.zoomStep
            );

            break;

        case "0":

            resetZoom();

            break;

        case "enter":

            activateHoveredNode();

            break;

        case " ":

            event.preventDefault();

            activateHoveredNode();

            break;

        default:

            break;
    }

    dispatchInteractionEvent(
        "dna:key-down",
        {
            key:
                event.key
        }
    );
}


/* ============================================================
   41. KEY UP
   ============================================================ */

function handleKeyUp(
    event
) {

    INTERACTION_STATE.keyboard.shift =
        event.shiftKey;

    INTERACTION_STATE.keyboard.ctrl =
        event.ctrlKey;

    INTERACTION_STATE.keyboard.alt =
        event.altKey;

    INTERACTION_STATE.keyboard.space =
        event.code ===
        "Space";

    dispatchInteractionEvent(
        "dna:key-up",
        {
            key:
                event.key
        }
    );
}


/* ============================================================
   42. ACTIVATE HOVERED NODE
   ============================================================ */

function activateHoveredNode() {

    const node =
        INTERACTION_STATE.hover.node;

    if (!node) {
        return null;
    }

    return selectNode(
        node
    );
}


/* ============================================================
   43. GET POINTER SNAPSHOT
   ============================================================ */

function getPointerSnapshot() {

    return {

        x:
            INTERACTION_STATE.pointer.x,

        y:
            INTERACTION_STATE.pointer.y,

        clientX:
            INTERACTION_STATE.pointer.clientX,

        clientY:
            INTERACTION_STATE.pointer.clientY,

        normalizedX:
            INTERACTION_STATE.pointer
                .normalizedX,

        normalizedY:
            INTERACTION_STATE.pointer
                .normalizedY,

        inside:
            INTERACTION_STATE.pointer
                .inside,

        down:
            INTERACTION_STATE.pointer
                .down
    };
}


/* ============================================================
   44. GET PROXIMITY
   ============================================================ */

function getProximity() {

    return {
        ...INTERACTION_STATE.proximity
    };
}


/* ============================================================
   45. GET HOVER
   ============================================================ */

function getHover() {

    return {

        node:
            INTERACTION_STATE.hover.node,

        document:
            INTERACTION_STATE.hover.document,

        distance:
            INTERACTION_STATE.hover.distance
    };
}


/* ============================================================
   46. GET SELECTION
   ============================================================ */

function getSelection() {

    return {

        node:
            INTERACTION_STATE.selection.node,

        document:
            INTERACTION_STATE.selection.document
    };
}


/* ============================================================
   47. STAGE RECT
   ============================================================ */

function getStageRect() {

    const stage =
        INTERACTION_DOM.stage ||
        INTERACTION_DOM.canvas;

    if (!stage) {
        return null;
    }

    return stage.getBoundingClientRect();
}


/* ============================================================
   48. NODE ID
   ============================================================ */

function getNodeId(
    node
) {

    if (
        node.id !==
        undefined &&
        node.id !==
        null
    ) {

        return String(
            node.id
        );
    }

    if (
        node.documentId !==
        undefined &&
        node.documentId !==
        null
    ) {

        return String(
            node.documentId
        );
    }

    return null;
}


/* ============================================================
   49. TYPING CONTEXT
   ============================================================ */

function isTypingContext(
    target
) {

    if (!target) {
        return false;
    }

    const tag =
        target.tagName
            ?.toLowerCase();

    return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable
    );
}


/* ============================================================
   50. ESCAPE HTML
   ============================================================ */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* ============================================================
   51. DISPATCH EVENT
   ============================================================ */

function dispatchInteractionEvent(
    name,
    detail = {}
) {

    document.dispatchEvent(
        new CustomEvent(
            name,
            {
                detail: {

                    ...detail,

                    interaction:
                        INTERACTION_STATE
                },
                bubbles: true
            }
        )
    );
}


/* ============================================================
   52. DEBUG
   ============================================================ */

function interactionLog(
    ...messages
) {

    if (
        !INTERACTION_CONFIG.debug
    ) {

        return;
    }

    console.log(
        "[DNA Interaction]",
        ...messages
    );
}


/* ============================================================
   53. PUBLIC API
   ============================================================ */

window.DNAInteractions = {

    state:
        INTERACTION_STATE,

    config:
        INTERACTION_CONFIG,

    initialize:
        initializeInteractions,

    registerNode,

    registerNodes,

    updateNode,

    removeNode,

    clearNodes,

    getNode,

    getNodes,

    findNodeAtPointer,

    selectNode,

    clearSelection:
        clearNodeSelection,

    getPointer:
        getPointerSnapshot,

    getProximity,

    getHover,

    getSelection,

    setZoom,

    resetZoom,

    activateHoveredNode,

    hideTooltip
};


/* ============================================================
   54. AUTO INITIALIZATION
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            initializeInteractions();

        }
    );

} else {

    initializeInteractions();
}
