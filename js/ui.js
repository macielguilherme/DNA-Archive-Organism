/**
 * DNA — Experimental Archive Organism
 * UI Controller
 *
 * Responsabilidade:
 * - Controlar elementos visuais da interface.
 * - Atualizar métricas e informações do arquivo.
 * - Abrir/fechar painéis e modais.
 * - Exibir notificações.
 * - Sincronizar a interface com o estado global.
 *
 * Não é responsável por:
 * - Física
 * - Renderização do Canvas
 * - Partículas
 * - Conexões
 * - Timeline
 * - Posicionamento estrutural
 * - Animações de layout
 */

(function () {
    'use strict';

    const UI = {

        initialized: false,

        elements: {},

        state: {
            notificationTimer: null,
            currentDocument: null,
            currentNotification: null
        },

        selectors: {
            app: '.app',

            /* Topbar */
            systemStatus: '.system-status',
            systemStatusLabel: '.system-status__label',

            /* Archive */
            archiveTotal: '.archive-total__value',
            activeDocuments: '[data-metric="active"]',
            permanentDocuments: '[data-metric="permanent"]',
            connections: '[data-metric="connections"]',
            cells: '[data-metric="cells"]',
            density: '[data-metric="density"]',
            activity: '[data-metric="activity"]',

            /* Health */
            healthScore: '[data-health-score]',
            healthLabel: '[data-health-label]',
            healthProgress: '[data-health-progress]',

            /* Risk */
            riskExposure: '[data-risk-exposure]',
            riskLevel: '[data-risk-level]',

            /* Events */
            eventList: '.event-list',

            /* Document */
            documentPanel: '.document-panel',
            documentTitle: '.document-panel__title',
            documentClose: '.document-panel__close',
            documentId: '[data-document-id]',
            documentType: '[data-document-type]',
            documentSize: '[data-document-size]',
            documentMime: '[data-document-mime]',
            documentExtraction: '[data-document-extraction]',
            documentClass: '[data-document-class]',
            documentYear: '[data-document-year]',
            documentRetention: '[data-document-retention]',
            documentIntegrity: '[data-document-integrity]',
            documentRelationships: '[data-document-relationships]',

            /* Notification */
            notification: '.notification',
            notificationMessage: '.notification__message',

            /* Modal */
            modal: '.modal',
            modalClose: '.modal__close',

            /* Injection */
            injectionStatus: '.injection-status',
            injectionProgress: '.injection-status__progress',
            injectionPercentage: '.injection-status__percentage',

            /* Actions */
            injectButton: '[data-action="inject"]',
            resetButton: '[data-action="reset"]'
        }
    };


    /* ============================================================
       UTILIDADES
    ============================================================ */

    function query(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function queryAll(selector, parent = document) {
        return Array.from(
            parent.querySelectorAll(selector)
        );
    }

    function formatNumber(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return '0';
        }

        return new Intl.NumberFormat(
            'pt-BR'
        ).format(number);
    }

    function formatDecimal(value, decimals = 1) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return '0';
        }

        return number.toFixed(decimals);
    }

    function formatPercent(value, decimals = 1) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return '0%';
        }

        return `${number.toFixed(decimals)}%`;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function setText(element, value) {
        if (!element) {
            return;
        }

        element.textContent =
            String(value ?? '');
    }

    function setAttribute(
        element,
        attribute,
        value
    ) {
        if (!element) {
            return;
        }

        element.setAttribute(
            attribute,
            String(value)
        );
    }

    function dispatch(name, detail = {}) {
        document.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    }


    /* ============================================================
       CACHE DOS ELEMENTOS
    ============================================================ */

    function cacheElements() {

        Object.entries(
            UI.selectors
        ).forEach(([key, selector]) => {

            if (
                selector.includes(
                    '[data-'
                )
            ) {

                const elements =
                    queryAll(selector);

                UI.elements[key] =
                    elements.length === 1
                        ? elements[0]
                        : elements;

            } else {

                UI.elements[key] =
                    query(selector);
            }
        });

        return UI.elements;
    }


    /* ============================================================
       MÉTRICAS
    ============================================================ */

    function updateMetric(
        selector,
        value,
        formatter = formatNumber
    ) {

        const elements =
            Array.isArray(
                UI.elements[selector]
            )
                ? UI.elements[selector]
                : [UI.elements[selector]];

        elements.forEach(element => {

            if (!element) {
                return;
            }

            setText(
                element,
                formatter(value)
            );
        });
    }


    function updateArchiveMetrics(data) {

        if (!data) {
            return;
        }

        if (Array.isArray(data.documents)) {
            const docs = data.documents;
            const links = Array.isArray(data.connections) ? data.connections : [];
            const active = docs.filter(item => item.active === true || String(item.status || '').toUpperCase() === 'ACTIVE').length;
            const permanent = docs.filter(item => String(item.retention || '').toUpperCase() === 'PERMANENT').length;
            const possible = docs.length * (docs.length - 1) / 2;
            setText(UI.elements.archiveTotal, formatNumber(docs.length));
            const first = key => Array.isArray(UI.elements[key]) ? UI.elements[key][0] : UI.elements[key];
            setText(first('activeDocuments'), formatNumber(active));
            setText(first('permanentDocuments'), formatNumber(permanent));
            setText(first('connections'), formatNumber(links.length));
            setText(first('cells'), formatNumber(docs.length));
            setText(first('density'), possible ? formatPercent(links.length / possible * 100, 0) : 'N/A');
            setText(first('activity'), formatNumber(data.events?.length ?? docs.length));
            return;
        }

        if (!data.archive && data.totalDocuments === undefined) return;

        const archive =
            data.archive ||
            data;

        updateMetric(
            'archiveTotal',
            archive.totalDocuments
        );

        updateMetric(
            'activeDocuments',
            archive.activeDocuments
        );

        updateMetric(
            'permanentDocuments',
            archive.permanentDocuments
        );

        updateMetric(
            'connections',
            archive.structure?.connections
        );

        updateMetric(
            'cells',
            archive.structure?.cells
        );

        updateMetric(
            'density',
            archive.structure?.density,
            value =>
                formatPercent(value)
        );

        updateMetric(
            'activity',
            archive.structure?.activity,
            value =>
                formatPercent(value)
        );
    }


    /* ============================================================
       SAÚDE DO ORGANISMO
    ============================================================ */

    function updateHealth(data) {

        if (!data) {
            return;
        }

        const health =
            data.archive?.health ||
            data.health ||
            {};

        const score =
            Number(health.score);

        if (!Number.isFinite(score)) {
            setText(UI.elements.healthScore, 'N/A');
            setText(UI.elements.healthLabel, 'NO DATA');
            if (UI.elements.healthProgress) {
                UI.elements.healthProgress.style.width = '0%';
                UI.elements.healthProgress.setAttribute('aria-valuenow', '0');
            }
            UI.elements.app?.removeAttribute('data-health');
            return;
        }

        const normalizedScore =
            Number.isFinite(score)
                ? Math.max(
                    0,
                    Math.min(100, score)
                )
                : 0;

        setText(
            UI.elements.healthScore,
            `${normalizedScore}`
        );

        setText(
            UI.elements.healthLabel,
            health.status ||
            getHealthLabel(
                normalizedScore
            )
        );

        if (
            UI.elements.healthProgress
        ) {

            UI.elements.healthProgress
                .style.width =
                    `${normalizedScore}%`;

            UI.elements.healthProgress
                .setAttribute(
                    'aria-valuenow',
                    normalizedScore
                );
        }

        updateHealthState(
            normalizedScore
        );
    }


    function getHealthLabel(score) {

        if (score >= 90) {
            return 'SYSTEM STABLE';
        }

        if (score >= 75) {
            return 'SYSTEM HEALTHY';
        }

        if (score >= 50) {
            return 'SYSTEM DEGRADED';
        }

        if (score >= 25) {
            return 'SYSTEM UNSTABLE';
        }

        return 'SYSTEM CRITICAL';
    }


    function updateHealthState(score) {

        const app =
            UI.elements.app;

        if (!app) {
            return;
        }

        let state = 'critical';

        if (score >= 90) {
            state = 'stable';
        } else if (score >= 75) {
            state = 'healthy';
        } else if (score >= 50) {
            state = 'degraded';
        } else if (score >= 25) {
            state = 'unstable';
        }

        app.dataset.health =
            state;
    }


    /* ============================================================
       RISCO
    ============================================================ */

    function updateRisk(data) {

        if (!data) {
            return;
        }

        const risk =
            data.archive?.risk ||
            data.risk ||
            {};

        if (risk.exposure === undefined || risk.exposure === null || !Number.isFinite(Number(risk.exposure))) {
            setText(UI.elements.riskExposure, 'N/A');
            setText(UI.elements.riskLevel, 'NO DATA');
            UI.elements.app?.removeAttribute('data-risk');
            return;
        }

        const exposure =
            Number(risk.exposure);

        setText(
            UI.elements.riskExposure,
            Number.isFinite(exposure)
                ? `${exposure.toFixed(1)}%`
                : '0%'
        );

        setText(
            UI.elements.riskLevel,
            risk.label ||
            risk.level ||
            'LOW EXPOSURE'
        );

        const app =
            UI.elements.app;

        if (app) {
            app.dataset.risk =
                String(
                    risk.level ||
                    'LOW'
                ).toLowerCase();
        }
    }


    /* ============================================================
       STATUS DO SISTEMA
    ============================================================ */

    function setSystemStatus(
        status,
        label
    ) {

        const element =
            UI.elements.systemStatus;

        if (!element) {
            return;
        }

        element.dataset.status =
            String(
                status || 'stable'
            ).toLowerCase();

        const text =
            label ||
            status ||
            'SYSTEM STABLE';

        setText(
            UI.elements.systemStatusLabel,
            text
        );

        if (
            !UI.elements.systemStatusLabel
        ) {
            setText(
                element,
                text
            );
        }
    }


    /* ============================================================
       EVENTOS DO ARQUIVO
    ============================================================ */

    function renderEvents(events) {

        const container =
            UI.elements.eventList;

        if (!container) {
            return;
        }

        if (!Array.isArray(events)) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = '';

        if (!events.length) {
            const empty = document.createElement('div');
            empty.className = 'event-list__item';
            empty.textContent = 'NO DOCUMENT EVENTS';
            container.appendChild(empty);
            return;
        }

        events
            .slice()
            .reverse()
            .forEach(event => {

                const item =
                    document.createElement(
                        'div'
                    );

                item.className =
                    'event-list__item';

                const time =
                    event.time ||
                    event.date ||
                    event.timestamp ||
                    '';

                const title =
                    event.title ||
                    event.name ||
                    event.type ||
                    'SYSTEM EVENT';

                const description =
                    event.description ||
                    event.message ||
                    '';

                item.innerHTML = `
                    <div class="event-list__marker"></div>

                    <div class="event-list__content">
                        <div class="event-list__time">
                            ${escapeHTML(time)}
                        </div>

                        <div class="event-list__title">
                            ${escapeHTML(title)}
                        </div>

                        ${
                            description
                                ? `
                                <div class="event-list__description">
                                    ${escapeHTML(description)}
                                </div>
                                `
                                : ''
                        }
                    </div>
                `;

                container.appendChild(item);
            });
    }


    /* ============================================================
       DOCUMENTO
    ============================================================ */

    function openDocument(documentData) {

        if (!documentData) {
            return false;
        }

        UI.state.currentDocument =
            documentData;

        const panel =
            UI.elements.documentPanel;

        if (!panel) {
            return false;
        }

        setText(UI.elements.documentTitle, documentData.name || 'DOCUMENTO');

        setText(
            UI.elements.documentId,
            documentData.id ||
            documentData.documentId ||
            'UNKNOWN'
        );

        setText(
            UI.elements.documentType,
            documentData.type || documentData.detectedType ||
            documentData.documentType ||
            'DOCUMENT'
        );

        setText(UI.elements.documentSize, documentData.sizeFormatted || 'UNKNOWN');
        setText(UI.elements.documentMime, documentData.mimeType || 'UNKNOWN');
        setText(UI.elements.documentExtraction, documentData.extractionStatus || 'UNKNOWN');

        setText(
            UI.elements.documentClass,
            documentData.class ||
            documentData.classification ||
            documentData.classCode ||
            'UNKNOWN'
        );

        setText(
            UI.elements.documentYear,
            documentData.analysis?.years?.join(', ') ||
            documentData.year ||
            documentData.date ||
            '—'
        );

        setText(
            UI.elements.documentRetention,
            documentData.retention ||
            documentData.retentionType ||
            'UNKNOWN'
        );

        const integrity =
            documentData.integrity;

        setText(
            UI.elements.documentIntegrity,
            integrity !== undefined
                ? formatPercent(
                    integrity,
                    1
                )
                : '—'
        );

        const relationships = window.DNAConnections?.getForDocument?.(documentData.id) || documentData.relationships || documentData.relatedDocuments || [];

        setText(
            UI.elements.documentRelationships,
            Array.isArray(relationships)
                ? formatNumber(
                    relationships.length
                )
                : formatNumber(
                    relationships
                )
        );

        panel.classList.add(
            'is-open'
        );

        panel.setAttribute(
            'aria-hidden',
            'false'
        );

        dispatch(
            'dna:ui-document-open',
            {
                document:
                    documentData
            }
        );

        return true;
    }


    function closeDocument() {

        const panel =
            UI.elements.documentPanel;

        if (!panel) {
            return;
        }

        panel.classList.remove(
            'is-open'
        );

        panel.setAttribute(
            'aria-hidden',
            'true'
        );

        UI.state.currentDocument =
            null;

        dispatch(
            'dna:ui-document-close'
        );
    }


    /* ============================================================
       MODAIS
    ============================================================ */

    function openModal(modal) {

        const element =
            typeof modal === 'string'
                ? query(modal)
                : modal;

        if (!element) {
            return false;
        }

        element.classList.add(
            'is-open'
        );

        element.setAttribute(
            'aria-hidden',
            'false'
        );

        document.body.classList.add(
            'modal-open'
        );

        return true;
    }


    function closeModal(modal) {

        const element =
            typeof modal === 'string'
                ? query(modal)
                : modal;

        if (!element) {
            return false;
        }

        element.classList.remove(
            'is-open'
        );

        element.setAttribute(
            'aria-hidden',
            'true'
        );

        const openModals =
            queryAll(
                '.modal.is-open, .confirm-modal.is-open, .info-modal.is-open'
            );

        if (!openModals.length) {
            document.body.classList.remove(
                'modal-open'
            );
        }

        return true;
    }


    function closeAllModals() {

        queryAll(
            '.modal.is-open, .confirm-modal.is-open, .info-modal.is-open'
        ).forEach(modal => {
            closeModal(modal);
        });

        document.body.classList.remove(
            'modal-open'
        );
    }


    /* ============================================================
       NOTIFICAÇÕES
    ============================================================ */

    function notify(
        message,
        type = 'info',
        duration = 3500
    ) {

        const notification =
            UI.elements.notification;

        if (!notification) {
            return false;
        }

        if (
            UI.state.notificationTimer
        ) {
            clearTimeout(
                UI.state.notificationTimer
            );
        }

        UI.state.currentNotification = {
            message,
            type
        };

        notification.className =
            'notification';

        notification.classList.add(
            `notification--${type}`
        );

        notification.classList.add(
            'is-visible'
        );

        setText(
            UI.elements.notificationMessage,
            message
        );

        notification.setAttribute(
            'role',
            'status'
        );

        UI.state.notificationTimer =
            setTimeout(() => {

                notification.classList.remove(
                    'is-visible'
                );

            }, duration);

        return true;
    }


    function hideNotification() {

        const notification =
            UI.elements.notification;

        if (!notification) {
            return;
        }

        notification.classList.remove(
            'is-visible'
        );

        if (
            UI.state.notificationTimer
        ) {
            clearTimeout(
                UI.state.notificationTimer
            );

            UI.state.notificationTimer =
                null;
        }
    }


    /* ============================================================
       INJEÇÃO DE DADOS
    ============================================================ */

    function updateInjectionStatus(
        stage,
        progress,
        message
    ) {

        const container =
            UI.elements.injectionStatus;

        if (!container) {
            return;
        }

        if (stage !== undefined) {
            container.dataset.stage =
                String(stage);
        }

        if (message) {
            const messageElement =
                query(
                    '.injection-status__message',
                    container
                );

            setText(
                messageElement,
                message
            );
        }

        if (
            progress !== undefined &&
            UI.elements.injectionProgress
        ) {

            const value =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Number(progress) || 0
                    )
                );

            UI.elements.injectionProgress
                .style.width =
                    `${value}%`;

            UI.elements.injectionProgress
                .setAttribute(
                    'aria-valuenow',
                    value
                );

            setText(UI.elements.injectionPercentage, value);
        }
    }


    /* ============================================================
       ESTADO DOS BOTÕES
    ============================================================ */

    function setActionEnabled(
        action,
        enabled
    ) {

        const buttons =
            queryAll(
                `[data-action="${action}"]`
            );

        buttons.forEach(button => {

            button.disabled =
                !enabled;

            button.setAttribute(
                'aria-disabled',
                String(!enabled)
            );
        });
    }


    /* ============================================================
       SINCRONIZAÇÃO COMPLETA
    ============================================================ */

    function updateFromState(state) {

        if (!state) {
            return;
        }

        const data = state.data || state;

        updateArchiveMetrics(data);
        updateHealth(data);
        updateRisk(data);

        const events = data.archive?.events || data.events || (data.documents || []).map(item => ({
            time: item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '',
            title: 'DOCUMENTO INCORPORADO',
            description: item.name || item.id
        }));

        if (events) {
            renderEvents(events);
        }

        if (
            data.archive?.health?.status
        ) {
            setSystemStatus(
                data.archive.health.status,
                data.archive.health.status
            );
        }
    }


    /* ============================================================
       EVENTOS DA APLICAÇÃO
    ============================================================ */

    function bindEvents() {

        if (
            UI.elements.documentClose
        ) {
            UI.elements.documentClose
                .addEventListener(
                    'click',
                    closeDocument
                );
        }

        queryAll(
            '.modal__close'
        ).forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    const modal =
                        button.closest(
                            '.modal'
                        );

                    closeModal(modal);
                }
            );
        });


        queryAll(
            '.modal'
        ).forEach(modal => {

            modal.addEventListener(
                'click',
                event => {

                    if (
                        event.target ===
                        modal
                    ) {
                        closeModal(
                            modal
                        );
                    }
                }
            );
        });

        queryAll('[data-confirm="cancel"]').forEach(button => button.addEventListener('click', () => closeModal('.confirm-modal')));
        queryAll('[data-confirm="accept"]').forEach(button => button.addEventListener('click', () => {
            closeModal('.confirm-modal');
            document.dispatchEvent(new CustomEvent('dna:reset-confirmed', { bubbles: true }));
        }));
        queryAll('.info-modal__close').forEach(button => button.addEventListener('click', () => closeModal('.info-modal')));
        queryAll('.confirm-modal, .info-modal').forEach(modal => modal.addEventListener('click', event => {
            if (event.target === modal) closeModal(modal);
        }));


        document.addEventListener(
            'keydown',
            event => {

                if (
                    event.key !== 'Escape'
                ) {
                    return;
                }

                closeDocument();
                closeAllModals();
                hideNotification();
            }
        );


        document.addEventListener(
            'dna:document-selected',
            event => {

                if (
                    event.detail?.document
                ) {
                    openDocument(
                        event.detail.document
                    );
                }
            }
        );


        document.addEventListener(
            'dna:open-document',
            event => {

                if (
                    event.detail?.document
                ) {
                    openDocument(
                        event.detail.document
                    );
                }
            }
        );


        document.addEventListener(
            'dna:notification',
            event => {

                const detail =
                    event.detail || {};

                if (detail.message) {
                    notify(
                        detail.message,
                        detail.type ||
                            'info',
                        detail.duration ||
                            3500
                    );
                }
            }
        );


        document.addEventListener(
            'dna:injection-stage',
            event => {

                const detail =
                    event.detail || {};

                updateInjectionStatus(
                    detail.stage,
                    detail.progress,
                    detail.message
                );
            }
        );


        document.addEventListener(
            'dna:data-updated',
            event => {

                const state =
                    event.detail?.state ||
                    event.detail?.data;

                if (state) {
                    updateFromState(
                        state
                    );
                }
            }
        );


        document.addEventListener(
            'dna:state-restored',
            event => {

                const state =
                    event.detail?.state ||
                    event.detail;

                if (state) {
                    updateFromState(
                        state
                    );
                }
            }
        );
    }


    /* ============================================================
       INICIALIZAÇÃO
    ============================================================ */

    function initializeUI(
        state = null
    ) {

        if (UI.initialized) {
            if (state) {
                updateFromState(state);
            }

            return UI;
        }

        cacheElements();
        bindEvents();

        const initialState =
            state ||
            window.DNA?.state ||
            null;

        if (initialState) {
            updateFromState(
                initialState
            );
        }

        UI.initialized = true;

        document.dispatchEvent(
            new CustomEvent(
                'dna:ui-ready'
            )
        );

        return UI;
    }


    /* ============================================================
       API PÚBLICA
    ============================================================ */

    window.DNAUI = {

        initialize:
            initializeUI,

        update:
            updateFromState,

        updateMetrics:
            updateArchiveMetrics,

        updateHealth,

        updateRisk,

        updateEvents:
            renderEvents,

        setSystemStatus,

        openDocument,

        closeDocument,

        openModal,

        closeModal,

        closeAllModals,

        notify,

        hideNotification,

        updateInjectionStatus,

        setActionEnabled,

        getCurrentDocument:
            () =>
                UI.state.currentDocument,

        getElements:
            () =>
                UI.elements
    };


    /* Compatibilidade */

    window.initializeUI =
        initializeUI;

    window.showNotification =
        notify;

    window.openDocumentPanel =
        openDocument;

    window.closeDocumentPanel =
        closeDocument;


    /* ============================================================
       AUTO BOOT
    ============================================================ */

    function boot() {

        if (
            document.readyState ===
            'loading'
        ) {
            return;
        }

        initializeUI(
            window.DNA?.state ||
            null
        );
    }


    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            boot,
            {
                once: true
            }
        );

    } else {

        boot();

    }

})();
