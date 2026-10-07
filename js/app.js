/* ============================================================
   DNA — ARCHIVE ORGANISM
   APP CONTROLLER

   Sem dados fictícios.
   O organismo começa vazio.
   Toda informação visual nasce dos arquivos inseridos.
   ============================================================ */

(() => {
    "use strict";

    const DNA_STATE = {
        initialized: false,
        injecting: false,
        selectedDocument: null,
        data: null
    };

    const DOM = {};

    /* ---------------------------------------------------------
       ELEMENTOS
       --------------------------------------------------------- */

    function cacheDOM() {
        DOM.fileInput =
            document.querySelector(
                "#file-input"
            );

        DOM.injectButton =
            document.querySelector(
                "#inject-data"
            );

        DOM.injectionModal = document.querySelector("#injection-modal");

        DOM.dropZone =
            document.querySelector(
                "#drop-zone"
            );

        DOM.documentPanel =
            document.querySelector(
                "#document-panel"
            );

        DOM.closeDocument =
            document.querySelector(
                "#close-document"
            );

        DOM.resetButton =
            document.querySelector(
                "#reset-data"
            );

        DOM.evolution =
            document.querySelector(
                "#evolution-slider"
            );

        DOM.injectionStage =
            document.querySelectorAll(
                "[data-injection-stage]"
            );

        DOM.notification =
            document.querySelector(
                "#notification"
            );

        DOM.emptyState =
            document.querySelector(
                ".organism-empty-state"
            );
    }

    /* ---------------------------------------------------------
       INICIALIZAÇÃO
       --------------------------------------------------------- */

    async function initialize() {
        cacheDOM();

        bindEvents();

        await loadConfiguration();
        await window.DNAStorage?.ready;

        updateUI();

        DNA_STATE.initialized = true;

        dispatch(
            "dna:application-ready"
        );
    }

    async function loadConfiguration() {
        if (location.protocol === "file:") {
            DNA_STATE.data = { archive: { totalDocuments: 0, activeDocuments: 0, permanentDocuments: 0 }, documents: [], relationships: [], events: [], evolution: [], organism: { zones: [] } };
            return;
        }
        try {
            const response =
                await fetch(
                    "data/documents.json",
                    {
                        cache: "no-store"
                    }
                );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            DNA_STATE.data =
                await response.json();
        } catch (error) {
            /*
             * O projeto não depende de dados fictícios.
             * Se documents.json não puder ser carregado,
             * iniciamos com configuração vazia.
             */

            console.warn(
                "DNA: configuração externa não carregada.",
                error
            );

            DNA_STATE.data = {
                archive: {
                    totalDocuments: 0,
                    activeDocuments: 0,
                    permanentDocuments: 0
                },
                documents: [],
                relationships: [],
                events: [],
                evolution: [],
                organism: {
                    zones: []
                }
            };
        }
    }

    /* ---------------------------------------------------------
       EVENTOS
       --------------------------------------------------------- */

    function bindEvents() {
        document.querySelectorAll('[data-action="inject"]').forEach(button => {
            button.addEventListener("click", () => window.DNAUI?.openModal("#injection-modal"));
        });

        document.querySelectorAll('[data-action="select-file"]').forEach(button => {
            button.addEventListener("click", openFilePicker);
        });

        DOM.fileInput?.addEventListener(
            "change",
            handleFileInput
        );

        DOM.closeDocument?.addEventListener(
            "click",
            closeDocumentPanel
        );

        DOM.resetButton?.addEventListener(
            "click",
            handleReset
        );

        setupDropZone();

        document.addEventListener(
            "dna:document-selected",
            event => {
                openDocument(
                    event.detail.document
                );
            }
        );

        document.addEventListener(
            "dna:document-created",
            event => {
                recordArchiveEvent("DOCUMENT ACQUIRED", event.detail?.document?.name || "Documento incorporado.");
                updateUI();
            }
        );

        document.addEventListener("dna:document-removed", event => {
            recordArchiveEvent("DOCUMENT REMOVED", event.detail?.id || "Documento removido.");
            updateUI();
        });

        document.addEventListener("dna:document-metadata-updated", event => {
            recordArchiveEvent("METADATA UPDATED", event.detail?.id || "Descrição arquivística atualizada.");
        });

        document.addEventListener(
            "dna:documents-cleared",
            () => {
                closeDocumentPanel();
                updateUI();
            }
        );

        document.addEventListener(
            "dna:connections-rebuilt",
            () => {
                updateUI();
            }
        );

        document.addEventListener("dna:documents-changed", updateUI);
        document.addEventListener("dna:reset-confirmed", clearArchive);
    }

    /* ---------------------------------------------------------
       FILE PICKER
       --------------------------------------------------------- */

    function openFilePicker() {
        if (location.protocol === "file:") {
            showNotification("Abra o endereço HTTPS publicado do site. O index.html aberto diretamente não consegue guardar documentos nem acessar a API.", "error");
            return;
        }
        if (!DOM.fileInput) return;

        DOM.fileInput.click();
    }

    async function handleFileInput(event) {
        const files =
            Array.from(
                event.target.files || []
            );

        if (!files.length) return;

        await processFiles(files);

        event.target.value = "";
    }

    /* ---------------------------------------------------------
       DRAG & DROP
       --------------------------------------------------------- */

    function setupDropZone() {
        const zone =
            DOM.dropZone ||
            document.querySelector(
                ".organism-stage"
            );

        if (!zone) return;

        [
            "dragenter",
            "dragover"
        ].forEach(type => {
            zone.addEventListener(
                type,
                event => {
                    event.preventDefault();

                    zone.classList.add(
                        "drag-active"
                    );
                }
            );
        });

        [
            "dragleave",
            "drop"
        ].forEach(type => {
            zone.addEventListener(
                type,
                event => {
                    event.preventDefault();

                    zone.classList.remove(
                        "drag-active"
                    );
                }
            );
        });

        zone.addEventListener(
            "drop",
            async event => {
                const files =
                    Array.from(
                        event.dataTransfer
                            ?.files || []
                    );

                if (!files.length) return;

                await processFiles(files);
            }
        );
    }

    /* ---------------------------------------------------------
       PROCESSAMENTO
       --------------------------------------------------------- */

    async function processFiles(files) {
        if (location.protocol === "file:") {
            showNotification("Para importar documentos, abra o endereço HTTPS da hospedagem. Não use o index.html como arquivo.", "error");
            return;
        }
        if (DNA_STATE.injecting) {
            return;
        }

        DNA_STATE.injecting = true;

        showInjection();
        dispatch("dna:injection-start", { files: files.map(file => file.name) });

        try {
            for (const file of files) {
                await processSingleFile(
                    file
                );
            }

            await rebuildSystem();

            dispatch("dna:injection-stage", { stage: "complete", progress: 100, message: "NEW MEMORY ACQUIRED" });
            dispatch("dna:injection-complete", { count: files.length });

            showNotification(
                files.length === 1
                    ? "Documento incorporado ao organismo."
                    : `${files.length} documentos incorporados ao organismo.`
            );
        } catch (error) {
            console.error(error);

            showNotification(
                "Não foi possível processar o documento.",
                "error"
            );
        } finally {
            DNA_STATE.injecting = false;

            hideInjection();
            window.setTimeout(() => window.DNAUI?.closeModal?.("#injection-modal"), 900);
        }
    }

    async function processSingleFile(file) {
        setInjectionStage(
            "injecting"
        );

        await delay(300);

        setInjectionStage(
            "analyzing"
        );

        await delay(350);

        const document =
            await window.DNADocuments
                .createFromFile(file);

        setInjectionStage(
            "relationships"
        );

        await delay(300);

        setInjectionStage(
            "memory"
        );

        await delay(300);

        setInjectionStage(
            "organism"
        );

        await delay(300);

        /*
         * A informação agora é REAL.
         */

        return document;
    }

    async function rebuildSystem() {
        window.DNATimeline?.refresh?.();

        updateUI();
    }

    /* ---------------------------------------------------------
       INJECTION UI
       --------------------------------------------------------- */

    function showInjection() {
        document.body.classList.add(
            "is-injecting"
        );
    }

    function hideInjection() {
        document.body.classList.remove(
            "is-injecting"
        );

        resetInjectionStages();
    }

    function setInjectionStage(stage) {
        const stages = {
            injecting: [15, "INJECTING DOCUMENT…"],
            analyzing: [35, "ANALYZING STRUCTURE…"],
            relationships: [60, "IDENTIFYING RELATIONSHIPS…"],
            memory: [80, "BUILDING MEMORY…"],
            organism: [95, "UPDATING ORGANISM…"]
        };
        const [progress, message] = stages[stage] || [0, "PROCESSING DOCUMENT…"];
        dispatch("dna:injection-stage", { stage, progress, message });

        DOM.injectionStage.forEach(
            element => {
                const name =
                    element.dataset
                        .injectionStage;

                element.classList.toggle(
                    "is-active",
                    name === stage
                );

                if (
                    name === stage
                ) {
                    element.classList.add(
                        "is-complete"
                    );
                }
            }
        );
    }

    function resetInjectionStages() {
        DOM.injectionStage.forEach(
            element => {
                element.classList.remove(
                    "is-active",
                    "is-complete"
                );
            }
        );
    }

    /* ---------------------------------------------------------
       DOCUMENT PANEL
       --------------------------------------------------------- */

    function openDocument(documentData) {
        if (!documentData) return;

        DNA_STATE.selectedDocument =
            documentData;

        if (!DOM.documentPanel) return;

        const set = (
            selector,
            value
        ) => {
            const element =
                DOM.documentPanel.querySelector(
                    selector
                );

            if (element) {
                element.textContent =
                    value ??
                    "NÃO IDENTIFICADO";
            }
        };

        const title = DOM.documentPanel.querySelector(".document-panel__title");
        if (title) title.textContent = documentData.name || "DOCUMENTO";

        set(
            "[data-document-name]",
            documentData.name
        );

        set(
            "[data-document-type]",
            documentData.detectedType ||
                documentData.type
        );

        set(
            "[data-document-size]",
            documentData.sizeFormatted
        );

        set(
            "[data-document-mime]",
            documentData.mimeType
        );

        set(
            "[data-document-extension]",
            documentData.extension ||
                "NÃO IDENTIFICADA"
        );

        set(
            "[data-document-classification]",
            documentData.archiveMetadata?.className || documentData.archiveMetadata?.category || documentData.classification || "Aguardando análise da IA"
        );

        set("[data-document-class]", documentData.archiveMetadata?.className || documentData.archiveMetadata?.category || documentData.classification || "Aguardando análise da IA");
        set("[data-document-year]", documentData.archiveMetadata?.createdDate || documentData.analysis?.years?.join(", ") || "Não identificada no documento");

        set(
            "[data-document-retention]",
            documentData.archiveMetadata?.retentionRule || "Não identificada no documento"
        );

        set(
            "[data-document-destination]",
            documentData.archiveMetadata?.disposition || documentData.destination || "Não identificada no documento"
        );

        set(
            "[data-document-dates]",
            documentData.analysis?.dates
                ?.join(", ") ||
                "NENHUMA"
        );

        set(
            "[data-document-years]",
            documentData.analysis?.years
                ?.join(", ") ||
                "NENHUM"
        );

        set(
            "[data-document-keywords]",
            documentData.analysis?.keywords
                ?.join(", ") ||
                "NENHUMA"
        );

        set(
            "[data-document-words]",
            documentData.analysis
                ?.wordCount || 0
        );

        const archive = documentData.archiveMetadata || {};
        const ai = archive.aiAnalysis?.result || {};
        const setArchive = (selector, value) => {
            const node = DOM.documentPanel.querySelector(selector);
            if (node) node.textContent = value || "Não identificado no documento";
        };
        setArchive("[data-document-retention-rule]", archive.retentionRule);
        setArchive("[data-document-producer]", archive.producer);
        setArchive("[data-document-access]", archive.accessLevel);
        setArchive("[data-document-class-code]", archive.classCode);
        setArchive("[data-document-tags]", Array.isArray(archive.tags) ? archive.tags.join(", ") : "");
        setArchive("[data-document-summary]", ai.resumo_completo || archive.notes || "Clique em “Realizar guarda documental via IA” para analisar.");
        setArchive("[data-document-integrity]", documentData.sha256 ? "SHA-256 registrado" : "Hash ainda não calculado");
        setArchive("[data-document-extraction]", archive.aiAnalysis ? "ANÁLISE IA CONCLUÍDA" : (documentData.extractionStatus || "Aguardando análise da IA"));
        const aiAction = DOM.documentPanel.querySelector("[data-document-ai-action]");
        if (aiAction) aiAction.dataset.documentId = documentData.id;
        DOM.documentPanel.classList.add(
            "is-open"
        );
    }

    function closeDocumentPanel() {
        DNA_STATE.selectedDocument =
            null;

        DOM.documentPanel?.classList.remove(
            "is-open"
        );
    }

    /* ---------------------------------------------------------
       UI
       --------------------------------------------------------- */

    function updateUI() {
        const documents =
            window.DNADocuments
                ? window.DNADocuments.getAll()
                : [];

        const connections =
            window.DNAConnections
                ? window.DNAConnections.getAll()
                : [];

        const events = window.DNAStorage?.restoreEvents?.() || [];
        window.DNAUI?.update?.({ documents, connections, events });

        updateEmptyState(
            documents.length === 0
        );
    }

    function recordArchiveEvent(title, description) {
        const events = window.DNAStorage?.restoreEvents?.() || [];
        events.push({ time: new Date().toLocaleString("pt-BR"), timestamp: new Date().toISOString(), title, description });
        window.DNAStorage?.saveEvents?.(events.slice(-100));
    }

    function updateEmptyState(empty) {
        if (DOM.emptyState) {
            DOM.emptyState.hidden =
                !empty;
        }

        document.body.classList.toggle(
            "archive-empty",
            empty
        );
    }

    /* ---------------------------------------------------------
       RESET
       --------------------------------------------------------- */

    function handleReset() {
        if (window.DNAUI?.openModal) {
            window.DNAUI.openModal(".confirm-modal");
            return;
        }
        if (window.confirm("Remover todos os documentos carregados e reconstruir o organismo vazio?")) clearArchive();
    }

    function clearArchive() {
        window.DNAStorage?.createBackup?.({ reason: "before-reset" });
        window.DNAStorage?.clear?.({ skipBackup: true });
        const cleared = window.DNADocuments?.clear?.();
        if (cleared === false) {
            showNotification("Não foi possível limpar o arquivo local.", "error");
            return;
        }
        window.DNAConnections?.clear?.();
        window.DNAInteractions?.clearNodes?.();
        window.DNATimeline?.refresh?.();
        window.DNAParticles?.clear?.();

        closeDocumentPanel();

        updateUI();

        showNotification(
            "Arquivo limpo."
        );
    }

    /* ---------------------------------------------------------
       NOTIFICAÇÃO
       --------------------------------------------------------- */

    function showNotification(
        message,
        type = "success"
    ) {
        if (window.DNAUI?.notify) {
            window.DNAUI.notify(message, type === "error" ? "error" : "success");
            return;
        }
        if (!DOM.notification) {
            console.log(message);
            return;
        }

        DOM.notification.textContent =
            message;

        DOM.notification.dataset.type =
            type;

        DOM.notification.classList.add(
            "is-visible"
        );

        window.clearTimeout(
            showNotification.timer
        );

        showNotification.timer =
            window.setTimeout(
                () => {
                    DOM.notification.classList.remove(
                        "is-visible"
                    );
                },
                3200
            );
    }

    /* ---------------------------------------------------------
       UTILIDADES
       --------------------------------------------------------- */

    function delay(ms) {
        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );
    }

    function dispatch(
        name,
        detail = {}
    ) {
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

    window.DNA = {
        state: DNA_STATE,

        selectDocument:
            openDocument,

        closeDocumentPanel,

        inject:
            () => window.DNAUI?.openModal?.("#injection-modal"),

        reset:
            handleReset,

        notify:
            showNotification,

        save:
            () =>
                window.DNADocuments?.save(),

        clearMemory:
            handleReset,

        getDocument:
            id =>
                window.DNADocuments
                    ?.getById(id),

        getDocuments:
            () =>
                window.DNADocuments
                    ?.getAll()
    };

    /* ---------------------------------------------------------
       START
       --------------------------------------------------------- */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );
    } else {
        initialize();
    }
})();
