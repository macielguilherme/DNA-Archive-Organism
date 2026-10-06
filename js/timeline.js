/**
 * DNA — Experimental Archive Organism
 * Timeline Engine
 *
 * Responsabilidade:
 * - Controlar a linha temporal evolutiva do organismo.
 * - Renderizar eras a partir dos dados do arquivo.
 * - Sincronizar o slider com o estado do organismo.
 * - Atualizar indicadores visuais da evolução.
 *
 * Dependências opcionais:
 * - window.DNA
 * - window.DNAOrganism
 * - window.setEvolution
 *
 * Não altera posicionamento estrutural da interface.
 */

(function () {
    'use strict';

    const TIMELINE = {
        initialized: false,

        data: null,

        minYear: 1950,
        maxYear: 2026,

        currentYear: 2026,
        years: [],
        hasTemporalData: false,
        sliderBound: false,

        elements: {
            container: null,
            slider: null,
            currentYear: null,
            markers: null,
            label: null,
            progress: null
        },

        config: {
            defaultYear: 2026,
            minYear: 1950,
            maxYear: 2026
        }
    };

    /* ============================================================
       UTILIDADES
    ============================================================ */

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function normalizeYear(value) {
        const year = Number(value);

        if (!Number.isFinite(year)) {
            return TIMELINE.currentYear;
        }

        return Math.round(
            clamp(
                year,
                TIMELINE.config.minYear,
                TIMELINE.config.maxYear
            )
        );
    }

    function getEvolutionRatio(year) {
        const range =
            TIMELINE.config.maxYear -
            TIMELINE.config.minYear;

        if (range <= 0) {
            return 1;
        }

        return clamp(
            (year - TIMELINE.config.minYear) / range,
            0,
            1
        );
    }

    function getElement(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function dispatch(name, detail = {}) {
        document.dispatchEvent(
            new CustomEvent(name, {
                detail,
                bubbles: true
            })
        );
    }

    /* ============================================================
       DESCOBERTA DOS ELEMENTOS
    ============================================================ */

    function cacheElements() {
        TIMELINE.elements.container =
            getElement('.timeline');

        if (!TIMELINE.elements.container) {
            return false;
        }

        TIMELINE.elements.slider =
            getElement(
                '.timeline__slider',
                TIMELINE.elements.container
            ) ||
            getElement(
                'input[type="range"]',
                TIMELINE.elements.container
            );

        TIMELINE.elements.currentYear =
            getElement(
                '.timeline__current',
                TIMELINE.elements.container
            ) ||
            getElement(
                '[data-timeline-year]',
                TIMELINE.elements.container
            );

        TIMELINE.elements.markers =
            getElement(
                '.timeline__markers',
                TIMELINE.elements.container
            );

        TIMELINE.elements.label =
            getElement(
                '.timeline__label',
                TIMELINE.elements.container
            );

        TIMELINE.elements.progress =
            getElement(
                '.timeline__progress',
                TIMELINE.elements.container
            );

        return true;
    }

    /* ============================================================
       DADOS
    ============================================================ */

    function loadData(data) {
        if (!data) {
            return false;
        }

        TIMELINE.data = data;

        const evolution =
            data?.archive?.evolution ||
            data?.evolution ||
            [];

        if (Array.isArray(evolution) && evolution.length) {
            const years = evolution
                .map(item => Number(
                    item.year ??
                    item.startYear ??
                    item.start ??
                    item.date
                ))
                .filter(Number.isFinite);

            if (years.length) {
                TIMELINE.config.minYear =
                    Math.min(
                        TIMELINE.config.minYear,
                        ...years
                    );

                TIMELINE.config.maxYear =
                    Math.max(
                        TIMELINE.config.maxYear,
                        ...years
                    );
            }
        }

        TIMELINE.currentYear =
            normalizeYear(
                TIMELINE.config.defaultYear
            );

        return true;
    }

    function getEvolutionData() {
        return (
            TIMELINE.data?.archive?.evolution ||
            TIMELINE.data?.evolution ||
            []
        );
    }

    /* ============================================================
       CONFIGURAÇÃO DO SLIDER
    ============================================================ */

    function configureSlider() {
        const slider =
            TIMELINE.elements.slider;

        if (!slider) {
            return;
        }

        slider.min = "1950";

        slider.max = "2026";

        slider.step = '1';

        slider.value =
            String(TIMELINE.currentYear);

        slider.disabled = !TIMELINE.hasTemporalData;
        if (TIMELINE.sliderBound) return;
        TIMELINE.sliderBound = true;
        slider.addEventListener(
            'input',
            handleSliderInput
        );

        slider.addEventListener(
            'change',
            handleSliderChange
        );
    }

    /* ============================================================
       EVENTOS DO SLIDER
    ============================================================ */

    function handleSliderInput(event) {
        const year =
            normalizeYear(event.target.value);

        setYear(year, {
            source: 'slider',
            commit: false
        });
    }

    function handleSliderChange(event) {
        const year =
            normalizeYear(event.target.value);

        setYear(year, {
            source: 'slider',
            commit: true
        });
    }

    /* ============================================================
       ATUALIZAÇÃO DO ANO
    ============================================================ */

    function setYear(year, options = {}) {
        if (!TIMELINE.hasTemporalData) return null;
        const normalized =
            normalizeYear(year);

        TIMELINE.currentYear =
            normalized;

        updateSlider();
        updateYearDisplay();
        updateProgress();
        updateEraState();

        applyEvolution(normalized);

        dispatch(
            'dna:timeline-change',
            {
                year: normalized,
                ratio: getEvolutionRatio(normalized),
                source:
                    options.source ||
                    'system',
                commit:
                    options.commit !== false
            }
        );

        return normalized;
    }

    function updateSlider() {
        const slider =
            TIMELINE.elements.slider;

        if (!slider) {
            return;
        }

        slider.value =
            String(TIMELINE.currentYear);
    }

    function updateYearDisplay() {
        const year =
            TIMELINE.currentYear;

        if (!TIMELINE.hasTemporalData) {
            if (TIMELINE.elements.currentYear) TIMELINE.elements.currentYear.textContent = "—";
            if (TIMELINE.elements.label) TIMELINE.elements.label.textContent = "NO TEMPORAL DATA";
            if (TIMELINE.elements.container) TIMELINE.elements.container.dataset.noData = "true";
            return;
        }
        if (TIMELINE.elements.container) TIMELINE.elements.container.dataset.noData = "false";

        if (TIMELINE.elements.currentYear) {
            TIMELINE.elements.currentYear.textContent =
                String(year);
        }

        if (TIMELINE.elements.label) {
            TIMELINE.elements.label.textContent =
                getEraLabel(year);
        }

        if (
            TIMELINE.elements.container
        ) {
            TIMELINE.elements.container
                .dataset.year = String(year);
        }
    }

    /* ============================================================
       PROGRESSO
    ============================================================ */

    function updateProgress() {
        if (!TIMELINE.hasTemporalData) {
            if (TIMELINE.elements.progress) TIMELINE.elements.progress.style.width = "0%";
            return;
        }
        const ratio =
            getEvolutionRatio(
                TIMELINE.currentYear
            );

        const percentage =
            ratio * 100;

        if (TIMELINE.elements.progress) {
            TIMELINE.elements.progress.style.width =
                `${percentage}%`;
        }

        if (
            TIMELINE.elements.slider
        ) {
            TIMELINE.elements.slider
                .style.setProperty(
                    '--timeline-progress',
                    `${percentage}%`
                );
        }
    }

    /* ============================================================
       ERAS
    ============================================================ */

    function getEraForYear(year) {
        const evolution =
            getEvolutionData();

        if (!Array.isArray(evolution)) {
            return null;
        }

        let selected = null;

        evolution.forEach(era => {
            const start =
                Number(
                    era.startYear ??
                    era.start ??
                    era.year
                );

            const end =
                Number(
                    era.endYear ??
                    era.end ??
                    start
                );

            if (
                Number.isFinite(start) &&
                Number.isFinite(end) &&
                year >= start &&
                year <= end
            ) {
                selected = era;
            }
        });

        if (selected) {
            return selected;
        }

        let closest = null;
        let closestDistance = Infinity;

        evolution.forEach(era => {
            const start =
                Number(
                    era.startYear ??
                    era.start ??
                    era.year
                );

            if (!Number.isFinite(start)) {
                return;
            }

            const distance =
                Math.abs(year - start);

            if (distance < closestDistance) {
                closestDistance = distance;
                closest = era;
            }
        });

        return closest;
    }

    function getEraLabel(year) {
        const era =
            getEraForYear(year);

        if (!era) {
            return `EVOLUTION ${year}`;
        }

        return (
            era.label ||
            era.name ||
            era.title ||
            `EVOLUTION ${year}`
        );
    }

    /* ============================================================
       MARCADORES
    ============================================================ */

    function renderMarkers() {
        const container =
            TIMELINE.elements.markers;

        if (!container) {
            return;
        }

        const evolution = TIMELINE.years.map(year => ({ year, label: String(year) }));

        container.innerHTML = '';

        evolution.forEach((era, index) => {
            const year =
                Number(
                    era.startYear ??
                    era.start ??
                    era.year
                );

            if (!Number.isFinite(year)) {
                return;
            }

            const marker =
                document.createElement('button');

            marker.type = 'button';

            marker.className =
                'timeline__marker';

            marker.dataset.year =
                String(year);

            marker.dataset.index =
                String(index);

            const ratio =
                getEvolutionRatio(year);

            marker.style.left =
                `${ratio * 100}%`;

            const markerLabel =
                era.shortLabel ||
                era.label ||
                era.name ||
                era.title ||
                String(year);

            marker.setAttribute(
                'aria-label',
                `${markerLabel} — ${year}`
            );

            marker.innerHTML = `
                <span class="timeline__marker-dot"></span>
                <span class="timeline__marker-label">
                    ${escapeHTML(markerLabel)}
                </span>
                <span class="timeline__marker-year">
                    ${year}
                </span>
            `;

            marker.addEventListener(
                'click',
                () => {
                    setYear(year, {
                        source: 'marker',
                        commit: true
                    });
                }
            );

            container.appendChild(marker);
        });

        updateEraState();
    }

    function updateEraState() {
        const markers =
            TIMELINE.elements.markers;

        if (!markers) {
            return;
        }

        const current =
            TIMELINE.currentYear;

        markers
            .querySelectorAll(
                '.timeline__marker'
            )
            .forEach(marker => {
                const year =
                    Number(marker.dataset.year);

                const active =
                    year <= current;

                const selectedYear = TIMELINE.years.filter(year => year <= current).at(-1);

                marker.classList.toggle(
                    'is-past',
                    active
                );

                marker.classList.toggle(
                    'is-current',
                    year === selectedYear
                );
            });
    }

    /* ============================================================
       EVOLUÇÃO DO ORGANISMO
    ============================================================ */

    function applyEvolution(year) {
        const organism =
            window.DNAOrganism;

        if (
            organism &&
            typeof organism.setEvolution ===
                'function'
        ) {
            organism.setEvolution(year);
            return;
        }

        if (
            typeof window.setEvolution ===
                'function'
        ) {
            window.setEvolution(year);
        }
    }

    /* ============================================================
       CONTROLES
    ============================================================ */

    function setMinYear(year) {
        const normalized =
            Number(year);

        if (!Number.isFinite(normalized)) {
            return;
        }

        TIMELINE.config.minYear =
            normalized;

        if (
            TIMELINE.currentYear <
            normalized
        ) {
            TIMELINE.currentYear =
                normalized;
        }

        configureSlider();
        updateProgress();
        updateYearDisplay();
    }

    function setMaxYear(year) {
        const normalized =
            Number(year);

        if (!Number.isFinite(normalized)) {
            return;
        }

        TIMELINE.config.maxYear =
            normalized;

        if (
            TIMELINE.currentYear >
            normalized
        ) {
            TIMELINE.currentYear =
                normalized;
        }

        configureSlider();
        updateProgress();
        updateYearDisplay();
    }

    function goToPresent() {
        setYear(
            TIMELINE.config.maxYear,
            {
                source: 'present',
                commit: true
            }
        );
    }

    function goToOrigin() {
        setYear(
            TIMELINE.config.minYear,
            {
                source: 'origin',
                commit: true
            }
        );
    }

    /* ============================================================
       SERIALIZAÇÃO
    ============================================================ */

    function getState() {
        return {
            year:
                TIMELINE.currentYear,

            minYear:
                TIMELINE.config.minYear,

            maxYear:
                TIMELINE.config.maxYear,

            ratio:
                getEvolutionRatio(
                    TIMELINE.currentYear
                ),

            era:
                getEraLabel(
                    TIMELINE.currentYear
                )
        };
    }

    function restoreState(state) {
        if (!state) {
            return false;
        }

        if (
            Number.isFinite(
                Number(state.minYear)
            )
        ) {
            TIMELINE.config.minYear =
                Number(state.minYear);
        }

        if (
            Number.isFinite(
                Number(state.maxYear)
            )
        ) {
            TIMELINE.config.maxYear =
                Number(state.maxYear);
        }

        if (
            Number.isFinite(
                Number(state.year)
            )
        ) {
            setYear(
                Number(state.year),
                {
                    source: 'restore',
                    commit: false
                }
            );
        }

        return true;
    }

    /* ============================================================
       SEGURANÇA DE HTML
    ============================================================ */

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ============================================================
       INICIALIZAÇÃO
    ============================================================ */

    function initializeTimeline(data) {
        if (TIMELINE.initialized) {
            return TIMELINE;
        }

        if (!cacheElements()) {
            return TIMELINE;
        }

        if (data) {
            loadData(data);
        } else if (
            window.DNA &&
            window.DNA.state &&
            window.DNA.state.data
        ) {
            loadData(
                window.DNA.state.data
            );
        }

        refreshFromDocuments();
        configureSlider();
        renderMarkers();
        updateYearDisplay();
        updateProgress();
        applyEvolution(
            TIMELINE.currentYear
        );

        TIMELINE.initialized = true;

        dispatch(
            'dna:timeline-ready',
            getState()
        );

        return TIMELINE;
    }

    function refreshFromDocuments() {
        const documents = window.DNADocuments?.getAll?.() || [];
        TIMELINE.years = [...new Set(documents.flatMap(item => item.analysis?.years || []).map(Number).filter(year => Number.isInteger(year) && year >= 1950 && year <= 2026))].sort((a,b) => a-b);
        TIMELINE.hasTemporalData = TIMELINE.years.length > 0;
        if (TIMELINE.hasTemporalData) {
            TIMELINE.currentYear = Math.max(1950, Math.min(2026, TIMELINE.currentYear || TIMELINE.years[TIMELINE.years.length - 1]));
            if (!TIMELINE.years.some(year => year <= TIMELINE.currentYear)) TIMELINE.currentYear = TIMELINE.years[0];
        }
        if (TIMELINE.initialized) {
            configureSlider(); renderMarkers(); updateYearDisplay(); updateProgress(); applyEvolution(TIMELINE.currentYear);
        }
    }

    /* ============================================================
       EVENTOS GLOBAIS
    ============================================================ */

    document.addEventListener(
        'dna:data-loaded',
        event => {
            if (event.detail?.data) {
                loadData(
                    event.detail.data
                );

                if (!TIMELINE.initialized) {
                    initializeTimeline(
                        event.detail.data
                    );
                } else {
                    renderMarkers();
                    configureSlider();
                }
            }
        }
    );

    document.addEventListener(
        'dna:state-restored',
        event => {
            if (event.detail?.timeline) {
                restoreState(
                    event.detail.timeline
                );
            }
        }
    );

    document.addEventListener('dna:documents-changed', refreshFromDocuments);
    document.addEventListener('dna:documents-cleared', refreshFromDocuments);

    /* ============================================================
       API PÚBLICA
    ============================================================ */

    window.DNATimeline = {
        initialize: initializeTimeline,

        loadData,
        refresh: refreshFromDocuments,

        setYear,

        getYear: () =>
            TIMELINE.currentYear,

        getEra: () =>
            getEraForYear(
                TIMELINE.currentYear
            ),

        getEraLabel: () =>
            getEraLabel(
                TIMELINE.currentYear
            ),

        getRatio: () =>
            getEvolutionRatio(
                TIMELINE.currentYear
            ),

        getState,

        restoreState,

        setMinYear,

        setMaxYear,

        goToOrigin,

        goToPresent,

        render: renderMarkers,

        update: () => {
            updateYearDisplay();
            updateProgress();
            updateEraState();
        }
    };

    /* Compatibilidade */
    window.initializeTimeline =
        initializeTimeline;

    window.setTimelineYear =
        setYear;

    /* ============================================================
       AUTO INIT
    ============================================================ */

    function boot() {
        if (
            document.readyState ===
            'loading'
        ) {
            return;
        }

        if (
            window.DNA &&
            window.DNA.state &&
            window.DNA.state.data
        ) {
            initializeTimeline(
                window.DNA.state.data
            );
        } else {
            initializeTimeline();
        }
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
