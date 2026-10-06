/* ============================================================
   DNA — ORGANISM ENGINE
   O organismo nasce dos documentos reais
   ============================================================ */

(() => {
    "use strict";

    const state = {
        initialized: false,
        canvas: null,
        ctx: null,

        nodes: [],
        particles: [],

        evolution: 2026,

        mouse: {
            x: 0,
            y: 0,
            active: false
        },

        camera: {
            x: 0, y: 0, zoom: 1,
            dragging: false, moved: false,
            lastX: 0, lastY: 0
        },

        animationFrame: null
    };

    const CONFIG = {
        background: "#03070d",

        colors: {
            permanent: "#36a3ff",
            temporary: "#a66cff",
            warning: "#ff9d42",
            sick: "#ff4d5a",
            neutral: "#6d8299",
            core: "#8fd3ff"
        }
    };

    /* ---------------------------------------------------------
       CANVAS
       --------------------------------------------------------- */

    function initializeOrganism() {
        if (state.initialized) return;
        state.canvas =
            document.querySelector(
                ".organism-canvas"
            );

        if (!state.canvas) return;

        state.ctx =
            state.canvas.getContext("2d");

        if (!state.ctx) return;
        state.initialized = true;

        resize();

        window.addEventListener("resize", () => {
            resize();
            rebuild();
        });

        state.canvas.addEventListener(
            "pointermove",
            event => {
                const rect =
                    state.canvas.getBoundingClientRect();

                state.mouse.x =
                    event.clientX - rect.left;

                state.mouse.y =
                    event.clientY - rect.top;

                state.mouse.active = true;
                const coordinateX = document.querySelector("[data-coordinate-x]");
                const coordinateY = document.querySelector("[data-coordinate-y]");
                if (coordinateX) coordinateX.textContent = String(Math.round(state.mouse.x)).padStart(4, "0");
                if (coordinateY) coordinateY.textContent = String(Math.round(state.mouse.y)).padStart(4, "0");

                const camera = state.camera;
                if (camera.dragging) {
                    const dx = event.clientX - camera.lastX;
                    const dy = event.clientY - camera.lastY;
                    if (Math.abs(dx) + Math.abs(dy) > 2) camera.moved = true;
                    camera.x += dx;
                    camera.y += dy;
                    camera.lastX = event.clientX;
                    camera.lastY = event.clientY;
                    draw();
                }
            }
        );

        state.canvas.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            const camera = state.camera;
            camera.dragging = true;
            camera.moved = false;
            camera.lastX = event.clientX;
            camera.lastY = event.clientY;
            state.canvas.setPointerCapture?.(event.pointerId);
            state.canvas.style.cursor = "grabbing";
            event.preventDefault();
        });
        const finishPointer = () => {
            const camera = state.camera;
            if (camera.dragging && camera.moved) state.canvas.dataset.dragged = "true";
            camera.dragging = false;
            state.canvas.style.cursor = "crosshair";
        };
        state.canvas.addEventListener("pointerup", finishPointer);
        state.canvas.addEventListener("pointercancel", finishPointer);
        document.addEventListener("dna:camera-change", event => {
            const zoom = Number(event.detail?.camera?.zoom);
            if (Number.isFinite(zoom)) state.camera.zoom = Math.max(0.55, Math.min(2.2, zoom));
            draw();
        });

        state.canvas.addEventListener(
            "pointerleave",
            () => {
                state.mouse.active = false;
            }
        );

        render();

        rebuild();
    }

    function resize() {
        if (!state.canvas) return;

        const rect =
            state.canvas.getBoundingClientRect();

        const ratio =
            window.devicePixelRatio || 1;

        state.canvas.width =
            Math.max(1, rect.width * ratio);

        state.canvas.height =
            Math.max(1, rect.height * ratio);

        state.ctx.setTransform(
            ratio,
            0,
            0,
            ratio,
            0,
            0
        );
    }

    /* ---------------------------------------------------------
       DOCUMENTOS
       --------------------------------------------------------- */

    function getDocuments() {
        const documents = window.DNADocuments
            ? window.DNADocuments.getAll()
            : [];
        const year = Number(state.evolution);
        if (!Number.isFinite(year) || year < 1950 || year > 2026) return documents;
        return documents.filter(item => {
            const years = item.analysis?.years || [];
            return !years.length || years.some(value => Number(value) <= year);
        });
    }

    function getConnections() {
        return window.DNAConnections
            ? window.DNAConnections.getAll()
            : [];
    }

    /* ---------------------------------------------------------
       ESTADO VISUAL
       --------------------------------------------------------- */

    function documentColor(document) {
        if (!document) {
            return CONFIG.colors.neutral;
        }

        if (document.retention === "PERMANENT") {
            return CONFIG.colors.permanent;
        }

        if (document.destination) {
            return CONFIG.colors.warning;
        }

        if (document.classification) {
            return CONFIG.colors.temporary;
        }

        return CONFIG.colors.neutral;
    }

    function createNode(document, index, total) {
        const rect = state.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const columnsAvailable = Math.max(1, Math.floor((width - 72) / 142));
        const columns = Math.max(1, Math.min(total, columnsAvailable));
        const rows = Math.max(1, Math.ceil(total / columns));
        const cellWidth = width / (columns + 1);
        const cellHeight = height / (rows + 1);
        const cardWidth = Math.max(52, Math.min(138, cellWidth * 0.82, cellHeight * 1.62));
        const cardHeight = Math.max(36, Math.min(88, cardWidth * 0.66));
        const seed = String(document.id).split("").reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
        const variation = (seed % 1000) / 1000;
        const column = index % columns;
        const row = Math.floor(index / columns);
        const shelfCurve = Math.sin((column / Math.max(columns - 1, 1)) * Math.PI) * Math.min(13, cellHeight * 0.12);
        const jitter = (variation - 0.5) * Math.min(7, cardWidth * 0.055);
        return {
            id: document.id,
            x: cellWidth * (column + 1) + jitter,
            y: cellHeight * (row + 1) - shelfCurve + jitter,
            row,
            column,
            cardWidth,
            cardHeight,
            radius: Math.max(cardWidth * 0.52, cardHeight * 0.62, 24),
            color: documentColor(document),
            document,
            phase: variation * Math.PI * 2
        };
    }

    function rebuild() {
        if (!state.canvas) return;

        const documents = getDocuments();

        /*
         * SEM DOCUMENTOS = ORGANISMO VAZIO
         */

        if (!documents.length) {
            state.nodes = [];
            window.DNAInteractions?.registerNodes?.([]);
            updateEmptyState(true);
            draw();
            return;
        }

        updateEmptyState(false);

        state.nodes = documents.map(
            (document, index) =>
                createNode(
                    document,
                    index,
                    documents.length
                )
        );

        window.DNAInteractions?.registerNodes?.(
            state.nodes.map(node => ({
                id: node.id,
                documentId: node.id,
                ...projectPoint(node),
                radius: node.radius,
                document: node.document
            }))
        );

        dispatch("dna:organism-rebuilt", {
            nodes: state.nodes.length
        });

        draw();
    }

    /* ---------------------------------------------------------
       DESENHO
       --------------------------------------------------------- */

    function clear() {
        const rect =
            state.canvas.getBoundingClientRect();

        state.ctx.clearRect(
            0,
            0,
            rect.width,
            rect.height
        );
    }

    function drawCore() {
        const rect =
            state.canvas.getBoundingClientRect();

        const x = rect.width / 2;
        const y = rect.height / 2;

        const documents = getDocuments();

        if (!documents.length) {
            return;
        }

        const radius =
            Math.min(
                rect.width,
                rect.height
            ) * 0.075;

        const gradient =
            state.ctx.createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                radius * 2
            );

        gradient.addColorStop(
            0,
            "rgba(143,211,255,.45)"
        );

        gradient.addColorStop(
            1,
            "rgba(143,211,255,0)"
        );

        state.ctx.fillStyle = gradient;

        state.ctx.beginPath();

        state.ctx.arc(
            x,
            y,
            radius * 2,
            0,
            Math.PI * 2
        );

        state.ctx.fill();

        state.ctx.fillStyle =
            CONFIG.colors.core;

        state.ctx.globalAlpha = 0.9;

        state.ctx.beginPath();

        state.ctx.arc(
            x,
            y,
            radius * 0.45,
            0,
            Math.PI * 2
        );

        state.ctx.fill();

        state.ctx.globalAlpha = 1;
    }

    function projectPoint(point) {
        const rect = state.canvas.getBoundingClientRect();
        const camera = state.camera;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        return {
            x: centerX + camera.x + (point.x - centerX) * camera.zoom,
            y: centerY + camera.y + (point.y - centerY) * camera.zoom,
            scale: camera.zoom
        };
    }

    function drawShelfGuides() {
        if (!state.nodes.length) return;
        const rect = state.canvas.getBoundingClientRect();
        const shelves = new Map();
        for (const node of state.nodes) {
            const group = shelves.get(node.row) || [];
            group.push(node);
            shelves.set(node.row, group);
        }
        state.ctx.save();
        state.ctx.lineWidth = 1;
        state.ctx.setLineDash([2, 8]);
        for (const [row, nodes] of shelves) {
            const y = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length;
            state.ctx.beginPath();
            state.ctx.moveTo(Math.max(24, nodes[0].x - nodes[0].cardWidth * 0.68), y + nodes[0].cardHeight * 0.56);
            state.ctx.bezierCurveTo(rect.width * 0.32, y + nodes[0].cardHeight * 0.72, rect.width * 0.68, y + nodes[0].cardHeight * 0.72, Math.min(rect.width - 24, nodes[nodes.length - 1].x + nodes[nodes.length - 1].cardWidth * 0.68), y + nodes[nodes.length - 1].cardHeight * 0.56);
            state.ctx.strokeStyle = "rgba(128, 174, 156, .12)";
            state.ctx.stroke();
            state.ctx.setLineDash([]);
            state.ctx.font = "7px ui-monospace, monospace";
            state.ctx.fillStyle = "rgba(164, 205, 186, .34)";
            state.ctx.fillText(`ESTANTE ${String(row + 1).padStart(2, "0")}`, 18, y + nodes[0].cardHeight * 0.86);
            state.ctx.setLineDash([2, 8]);
        }
        state.ctx.restore();
    }

    function drawConnections() {
        const connectionList = getConnections();
        if (!connectionList.length) return;
        state.ctx.save();
        for (let index = 0; index < connectionList.length; index++) {
            const connection = connectionList[index];
            const source = state.nodes.find(node => node.id === connection.source);
            const target = state.nodes.find(node => node.id === connection.target);
            if (!source || !target) continue;
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const length = Math.max(1, Math.hypot(dx, dy));
            const ux = dx / length, uy = dy / length;
            const nx = -uy, ny = ux;
            const bend = Math.min(82, Math.max(20, length * 0.2)) * (index % 2 ? -1 : 1);
            const startX = source.x + ux * source.cardWidth * 0.43;
            const startY = source.y + uy * source.cardHeight * 0.36;
            const endX = target.x - ux * target.cardWidth * 0.43;
            const endY = target.y - uy * target.cardHeight * 0.36;
            state.ctx.beginPath();
            state.ctx.moveTo(startX, startY);
            state.ctx.bezierCurveTo(startX + dx * 0.28 + nx * bend, startY + dy * 0.28 + ny * bend, endX - dx * 0.28 + nx * bend, endY - dy * 0.28 + ny * bend, endX, endY);
            state.ctx.strokeStyle = "rgba(112, 203, 180, .10)";
            state.ctx.lineWidth = 5 + connection.strength * 5;
            state.ctx.stroke();
            state.ctx.beginPath();
            state.ctx.moveTo(startX, startY);
            state.ctx.bezierCurveTo(startX + dx * 0.28 + nx * bend, startY + dy * 0.28 + ny * bend, endX - dx * 0.28 + nx * bend, endY - dy * 0.28 + ny * bend, endX, endY);
            state.ctx.strokeStyle = `rgba(129, 224, 196, ${0.22 + connection.strength * 0.34})`;
            state.ctx.lineWidth = 0.7 + connection.strength * 1.15;
            state.ctx.setLineDash([3, 6]);
            state.ctx.stroke();
            state.ctx.setLineDash([]);
        }
        state.ctx.restore();
    }

    function drawNodes() {
        const rect = state.canvas.getBoundingClientRect();
        const worldMouseX = (state.mouse.x - rect.width / 2 - state.camera.x) / state.camera.zoom + rect.width / 2;
        const worldMouseY = (state.mouse.y - rect.height / 2 - state.camera.y) / state.camera.zoom + rect.height / 2;
        const selectedId = window.DNADocuments?.state?.selectedId;
        state.ctx.save();
        for (let index = 0; index < state.nodes.length; index++) {
            const node = state.nodes[index];
            const x = node.x - node.cardWidth / 2;
            const y = node.y - node.cardHeight / 2;
            const width = node.cardWidth;
            const height = node.cardHeight;
            const hovered = state.mouse.active && Math.hypot(node.x - worldMouseX, node.y - worldMouseY) <= node.radius;
            const selected = node.id === selectedId;
            const accent = hovered ? "#d3fff0" : node.color;
            const radius = Math.min(8, width * 0.12);
            const ctx = state.ctx;
            ctx.save();
            ctx.shadowColor = hovered || selected ? accent : "rgba(40, 116, 96, .16)";
            ctx.shadowBlur = hovered || selected ? 18 : 7;
            ctx.beginPath();
            ctx.roundRect(x, y, width, height, radius);
            const paper = ctx.createLinearGradient(x, y, x + width, y + height);
            paper.addColorStop(0, hovered ? "rgba(23, 56, 50, .98)" : "rgba(12, 27, 27, .96)");
            paper.addColorStop(1, "rgba(7, 17, 20, .98)");
            ctx.fillStyle = paper;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = hovered || selected ? accent : hexToRGBA(node.color, 0.4);
            ctx.lineWidth = hovered || selected ? 1.25 : 0.8;
            ctx.stroke();
            ctx.fillStyle = accent;
            ctx.globalAlpha = 0.78;
            ctx.beginPath();
            ctx.roundRect(x + 1.5, y + 7, 2.5, height - 14, 1.2);
            ctx.fill();
            ctx.globalAlpha = 1;

            const doc = node.document;
            const title = String(doc.name || "Documento sem título");
            const category = String(doc.archiveMetadata?.category || doc.type || "A organizar").toLocaleUpperCase("pt-BR");
            const serial = `FÓLIO ${String(index + 1).padStart(2, "0")}`;
            ctx.textBaseline = "middle";
            ctx.font = `600 ${Math.max(6, Math.min(8, width * 0.064))}px ui-monospace, monospace`;
            ctx.fillStyle = hovered ? "rgba(216,255,241,.95)" : "rgba(169,207,192,.64)";
            ctx.fillText(serial, x + 10, y + height * 0.2, width - 25);
            ctx.font = `500 ${Math.max(7, Math.min(11, width * 0.085))}px Inter, ui-sans-serif, sans-serif`;
            ctx.fillStyle = hovered ? "#f1fff9" : "#d8e7df";
            ctx.fillText(title, x + 10, y + height * 0.49, width - 19);
            ctx.beginPath();
            ctx.moveTo(x + 10, y + height * 0.68);
            ctx.lineTo(x + width - 10, y + height * 0.68);
            ctx.strokeStyle = "rgba(180, 218, 200, .15)";
            ctx.lineWidth = 0.7;
            ctx.stroke();
            ctx.font = `600 ${Math.max(5.5, Math.min(7, width * 0.058))}px ui-monospace, monospace`;
            ctx.fillStyle = hovered ? accent : "rgba(143, 196, 176, .72)";
            ctx.fillText(category, x + 10, y + height * 0.84, width - 20);

            // Marca de dobra: o documento vira o próprio elemento do mapa.
            ctx.beginPath();
            ctx.moveTo(x + width - 14, y + 1);
            ctx.lineTo(x + width - 1, y + 14);
            ctx.lineTo(x + width - 14, y + 14);
            ctx.closePath();
            ctx.fillStyle = hovered ? "rgba(211,255,240,.28)" : hexToRGBA(node.color, 0.22);
            ctx.fill();
            ctx.restore();
            node.renderX = node.x;
            node.renderY = node.y;
            node.renderRadius = node.radius;
        }
        state.ctx.restore();
    }

    function draw() {
        clear();
        const rect = state.canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        state.ctx.save();
        state.ctx.translate(cx + state.camera.x, cy + state.camera.y);
        state.ctx.scale(state.camera.zoom, state.camera.zoom);
        state.ctx.translate(-cx, -cy);
        drawShelfGuides();
        drawConnections();
        drawNodes();
        for (const node of state.nodes) {
            const projected = projectPoint(node);
            node.renderX = projected.x;
            node.renderY = projected.y;
            node.renderRadius = node.radius * state.camera.zoom;
            window.DNAInteractions?.updateNode?.(node.id, {
                x: node.renderX,
                y: node.renderY,
                radius: node.renderRadius
            });
        }
        state.ctx.restore();
    }

    function render() {
        draw();

        state.animationFrame =
            requestAnimationFrame(
                render
            );
    }

    /* ---------------------------------------------------------
       EMPTY STATE
       --------------------------------------------------------- */

    function updateEmptyState(empty) {
        const element =
            document.querySelector(
                ".organism-empty-state"
            );

        if (element) {
            element.hidden = !empty;
        }

        const stage =
            document.querySelector(
                ".organism-stage"
            );

        if (stage) {
            stage.classList.toggle(
                "is-empty",
                empty
            );
        }
    }

    /* ---------------------------------------------------------
       EVOLUTION
       --------------------------------------------------------- */

    function setEvolution(value) {
        const year = Number(value);
        state.evolution = Number.isFinite(year) ? Math.max(1950, Math.min(2026, year)) : 2026;

        rebuild();

        dispatch("dna:evolution-changed", {
            value: state.evolution
        });
    }

    function growOrganism(document) {
        if (!document) {
            rebuild();
            return;
        }

        rebuild();

        dispatch(
            "dna:organism-grown",
            {
                document
            }
        );
    }

    /* ---------------------------------------------------------
       UTILIDADES
       --------------------------------------------------------- */

    function hexToRGBA(hex, alpha) {
        const value =
            String(hex)
                .replace("#", "");

        if (value.length !== 6) {
            return `rgba(255,255,255,${alpha})`;
        }

        const r =
            parseInt(
                value.slice(0, 2),
                16
            );

        const g =
            parseInt(
                value.slice(2, 4),
                16
            );

        const b =
            parseInt(
                value.slice(4, 6),
                16
            );

        return `rgba(${r},${g},${b},${alpha})`;
    }

    function dispatch(name, detail = {}) {
        document.dispatchEvent(
            new CustomEvent(name, {
                detail,
                bubbles: true
            })
        );
    }

    /* ---------------------------------------------------------
       API
       --------------------------------------------------------- */

    window.DNAOrganism = {
        state,

        initialize: initializeOrganism,
        rebuild,
        grow: growOrganism,
        setEvolution
    };

    window.initializeOrganism =
        initializeOrganism;

    window.growOrganism =
        growOrganism;

    window.setEvolution =
        setEvolution;

    document.addEventListener(
        "dna:connections-rebuilt",
        rebuild
    );

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initializeOrganism
        );
    } else {
        initializeOrganism();
    }
})();
