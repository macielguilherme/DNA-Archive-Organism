/* ============================================================
   DNA — EXPERIMENTAL ARCHIVE ORGANISM
   particles.js
   ------------------------------------------------------------
   PARTICLE ENGINE

   Responsabilidades:
   - Partículas ambientais
   - Profundidade visual
   - Movimento orbital
   - Reação ao mouse
   - Dispersão
   - Atração ao organismo
   - Partículas de memória
   - Partículas de injeção
   - Partículas de conexão
   - Canvas de efeitos

   NÃO RESPONSÁVEL POR:
   - Layout
   - HUD
   - Documentos
   - Conexões lógicas
   - Nós principais
   - CSS de interface
   ============================================================ */

"use strict";


/* ============================================================
   01. CONFIGURATION
   ============================================================ */

const PARTICLES_CONFIG = {

    canvasSelector:
        ".effects-canvas",

    amount:
        130,

    minimumAmount:
        60,

    maximumAmount:
        420,

    particleMinSize:
        0.45,

    particleMaxSize:
        2.2,

    particleMinSpeed:
        0.00008,

    particleMaxSpeed:
        0.00045,

    orbitRadius:
        420,

    mouseRadius:
        190,

    mouseForce:
        42,

    coreAttraction:
        0.000025,

    ambientDrift:
        0.012,

    connectionParticleAmount:
        12,

    injectionParticleAmount:
        85,

    memoryParticleAmount:
        55,

    pixelRatioLimit:
        2,

    enabled:
        true,

    autoStart:
        true,

    debug:
        false
};


/* ============================================================
   02. STATE
   ============================================================ */

const PARTICLES_STATE = {

    initialized:
        false,

    running:
        false,

    width:
        0,

    height:
        0,

    center: {

        x: 0,

        y: 0
    },

    particles:
        [],

    bursts:
        [],

    streams:
        [],

    injection:
        {

            active:
                false,

            progress:
                0,

            sourceX:
                0,

            sourceY:
                0,

            targetX:
                0,

            targetY:
                0
        },

    pointer:
        {

            x:
                0,

            y:
                0,

            intensity:
                0,

            active:
                false
        },

    frame:
        0,

    elapsed:
        0,

    lastTime:
        0
};


/* ============================================================
   03. DOM
   ============================================================ */

const PARTICLES_DOM = {

    canvas:
        null,

    context:
        null
};


/* ============================================================
   04. INITIALIZE
   ============================================================ */

function initializeParticles(
    options = {}
) {

    if (
        PARTICLES_STATE.initialized
    ) {

        return PARTICLES_STATE;
    }

    Object.assign(
        PARTICLES_CONFIG,
        options
    );

    resolveParticlesDOM();

    if (
        !PARTICLES_DOM.canvas
    ) {

        console.warn(
            "[DNA] Effects canvas not found."
        );

        return PARTICLES_STATE;
    }

    configureParticlesCanvas();

    resizeParticles();

    createAmbientParticles();

    bindParticleEvents();

    PARTICLES_STATE.initialized =
        true;

    if (
        PARTICLES_CONFIG.autoStart
    ) {

        startParticles();
    }

    dispatchParticleEvent(
        "dna:particles-ready",
        {
            amount:
                PARTICLES_STATE
                    .particles
                    .length
        }
    );

    return PARTICLES_STATE;
}


/* ============================================================
   05. RESOLVE DOM
   ============================================================ */

function resolveParticlesDOM() {

    PARTICLES_DOM.canvas =
        document.querySelector(
            PARTICLES_CONFIG.canvasSelector
        );

    if (
        PARTICLES_DOM.canvas
    ) {

        PARTICLES_DOM.context =
            PARTICLES_DOM.canvas.getContext(
                "2d"
            );
    }
}


/* ============================================================
   06. CONFIGURE CANVAS
   ============================================================ */

function configureParticlesCanvas() {

    const canvas =
        PARTICLES_DOM.canvas;

    if (!canvas) {
        return;
    }

    canvas.style.pointerEvents =
        "none";

    canvas.style.touchAction =
        "none";
}


/* ============================================================
   07. RESIZE
   ============================================================ */

function resizeParticles() {

    const canvas =
        PARTICLES_DOM.canvas;

    if (!canvas) {
        return;
    }

    const rect =
        canvas.getBoundingClientRect();

    const width =
        Math.max(
            1,
            rect.width
        );

    const height =
        Math.max(
            1,
            rect.height
        );

    const pixelRatio =
        Math.min(
            window.devicePixelRatio ||
            1,
            PARTICLES_CONFIG.pixelRatioLimit
        );

    canvas.width =
        Math.round(
            width *
            pixelRatio
        );

    canvas.height =
        Math.round(
            height *
            pixelRatio
        );

    PARTICLES_STATE.width =
        width;

    PARTICLES_STATE.height =
        height;

    PARTICLES_STATE.center.x =
        width / 2;

    PARTICLES_STATE.center.y =
        height / 2;

    if (
        PARTICLES_DOM.context
    ) {

        PARTICLES_DOM.context.setTransform(
            pixelRatio,
            0,
            0,
            pixelRatio,
            0,
            0
        );
    }

    if (
        PARTICLES_STATE.initialized
    ) {

        redistributeParticles();
    }
}


/* ============================================================
   08. CREATE AMBIENT PARTICLES
   ============================================================ */

function createAmbientParticles() {

    PARTICLES_STATE.particles =
        [];

    const amount =
        clamp(
            PARTICLES_CONFIG.amount,
            PARTICLES_CONFIG.minimumAmount,
            PARTICLES_CONFIG.maximumAmount
        );

    for (
        let index = 0;
        index < amount;
        index++
    ) {

        PARTICLES_STATE.particles.push(
            createParticle(
                "ambient"
            )
        );
    }
}


/* ============================================================
   09. CREATE PARTICLE
   ============================================================ */

function createParticle(
    type = "ambient",
    options = {}
) {

    const center =
        PARTICLES_STATE.center;

    const width =
        PARTICLES_STATE.width;

    const height =
        PARTICLES_STATE.height;

    const angle =
        options.angle ??
        Math.random() *
        Math.PI *
        2;

    const distance =
        options.distance ??
        (
            80 +
            Math.random() *
            PARTICLES_CONFIG.orbitRadius
        );

    const depth =
        options.depth ??
        Math.random();

    const size =
        options.size ??
        (
            PARTICLES_CONFIG.particleMinSize +
            Math.random() *
            (
                PARTICLES_CONFIG.particleMaxSize -
                PARTICLES_CONFIG.particleMinSize
            )
        );

    return {

        id:
            `PARTICLE-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        type,

        x:
            options.x ??
            (
                center.x +
                Math.cos(angle) *
                distance
            ),

        y:
            options.y ??
            (
                center.y +
                Math.sin(angle) *
                distance *
                0.72
            ),

        baseX:
            options.x ??
            (
                center.x +
                Math.cos(angle) *
                distance
            ),

        baseY:
            options.y ??
            (
                center.y +
                Math.sin(angle) *
                distance *
                0.72
            ),

        vx:
            options.vx ??
            (
                (
                    Math.random() -
                    0.5
                ) *
                0.08
            ),

        vy:
            options.vy ??
            (
                (
                    Math.random() -
                    0.5
                ) *
                0.08
            ),

        radius:
            size,

        alpha:
            options.alpha ??
            (
                0.10 +
                Math.random() *
                0.48
            ),

        depth,

        angle,

        distance,

        speed:
            options.speed ??
            (
                PARTICLES_CONFIG.particleMinSpeed +
                Math.random() *
                (
                    PARTICLES_CONFIG.particleMaxSpeed -
                    PARTICLES_CONFIG.particleMinSpeed
                )
            ),

        orbit:
            options.orbit ??
            (
                Math.random() >
                0.5
            ),

        orbitDirection:
            options.orbitDirection ??
            (
                Math.random() >
                0.5
                    ? 1
                    : -1
            ),

        phase:
            Math.random() *
            Math.PI *
            2,

        life:
            options.life ??
            Infinity,

        maxLife:
            options.maxLife ??
            Infinity,

        targetX:
            options.targetX ??
            center.x,

        targetY:
            options.targetY ??
            center.y,

        color:
            options.color ??
            "blue",

        active:
            true
    };
}


/* ============================================================
   10. REDISTRIBUTE
   ============================================================ */

function redistributeParticles() {

    const center =
        PARTICLES_STATE.center;

    for (
        const particle of
        PARTICLES_STATE.particles
    ) {

        particle.distance =
            80 +
            Math.random() *
            PARTICLES_CONFIG.orbitRadius;

        particle.angle =
            Math.random() *
            Math.PI *
            2;

        particle.x =
            center.x +
            Math.cos(
                particle.angle
            ) *
            particle.distance;

        particle.y =
            center.y +
            Math.sin(
                particle.angle
            ) *
            particle.distance *
            0.72;

        particle.baseX =
            particle.x;

        particle.baseY =
            particle.y;
    }
}


/* ============================================================
   11. START
   ============================================================ */

function startParticles() {

    if (
        PARTICLES_STATE.running
    ) {

        return;
    }

    PARTICLES_STATE.running =
        true;

    PARTICLES_STATE.lastTime =
        performance.now();

    requestAnimationFrame(
        particlesLoop
    );
}


/* ============================================================
   12. STOP
   ============================================================ */

function stopParticles() {

    PARTICLES_STATE.running =
        false;
}


/* ============================================================
   13. LOOP
   ============================================================ */

function particlesLoop(
    timestamp
) {

    if (
        !PARTICLES_STATE.running
    ) {

        return;
    }

    const delta =
        Math.min(
            50,
            timestamp -
            PARTICLES_STATE.lastTime
        );

    PARTICLES_STATE.lastTime =
        timestamp;

    PARTICLES_STATE.elapsed +=
        delta;

    PARTICLES_STATE.frame++;

    updateParticles(
        delta
    );

    renderParticles();

    requestAnimationFrame(
        particlesLoop
    );
}


/* ============================================================
   14. UPDATE
   ============================================================ */

function updateParticles(
    delta
) {

    updatePointer();

    updateAmbientParticles(
        delta
    );

    updateBursts(
        delta
    );

    updateStreams(
        delta
    );

    updateInjectionParticles(
        delta
    );

    cleanupParticles();
}


/* ============================================================
   15. UPDATE POINTER
   ============================================================ */

function updatePointer() {

    const interaction =
        window.DNAInteractions;

    if (
        !interaction
    ) {

        PARTICLES_STATE.pointer.active =
            false;

        return;
    }

    const pointer =
        interaction.getPointer?.();

    const proximity =
        interaction.getProximity?.();

    if (
        !pointer
    ) {

        return;
    }

    PARTICLES_STATE.pointer.x =
        pointer.x;

    PARTICLES_STATE.pointer.y =
        pointer.y;

    PARTICLES_STATE.pointer.intensity =
        proximity?.intensity ||
        0;

    PARTICLES_STATE.pointer.active =
        Boolean(
            pointer.inside
        );
}


/* ============================================================
   16. UPDATE AMBIENT
   ============================================================ */

function updateAmbientParticles(
    delta
) {

    const center =
        PARTICLES_STATE.center;

    for (
        const particle of
        PARTICLES_STATE.particles
    ) {

        if (
            particle.type !==
            "ambient"
        ) {

            continue;
        }

        if (
            particle.orbit
        ) {

            particle.angle +=
                particle.speed *
                delta *
                particle.orbitDirection;

            const breathing =
                Math.sin(
                    PARTICLES_STATE.elapsed *
                    0.0004 +
                    particle.phase
                ) *
                2;

            const currentDistance =
                particle.distance +
                breathing;

            particle.x =
                center.x +
                Math.cos(
                    particle.angle
                ) *
                currentDistance;

            particle.y =
                center.y +
                Math.sin(
                    particle.angle
                ) *
                currentDistance *
                0.72;
        } else {

            particle.x +=
                particle.vx *
                delta;

            particle.y +=
                particle.vy *
                delta;
        }

        applyAmbientDrift(
            particle,
            delta
        );

        applyMouseForce(
            particle
        );

        wrapParticle(
            particle
        );
    }
}


/* ============================================================
   17. AMBIENT DRIFT
   ============================================================ */

function applyAmbientDrift(
    particle,
    delta
) {

    const time =
        PARTICLES_STATE.elapsed *
        0.0002;

    particle.x +=
        Math.sin(
            time +
            particle.phase
        ) *
        PARTICLES_CONFIG.ambientDrift *
        delta *
        particle.depth;

    particle.y +=
        Math.cos(
            time * 0.7 +
            particle.phase
        ) *
        PARTICLES_CONFIG.ambientDrift *
        delta *
        particle.depth;
}


/* ============================================================
   18. MOUSE FORCE
   ============================================================ */

function applyMouseForce(
    particle
) {

    const pointer =
        PARTICLES_STATE.pointer;

    if (
        !pointer.active
    ) {

        return;
    }

    const dx =
        particle.x -
        pointer.x;

    const dy =
        particle.y -
        pointer.y;

    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    if (
        distance <= 0 ||
        distance >
        PARTICLES_CONFIG.mouseRadius
    ) {

        return;
    }

    const intensity =
        1 -
        distance /
        PARTICLES_CONFIG.mouseRadius;

    const force =
        PARTICLES_CONFIG.mouseForce *
        intensity *
        pointer.intensity;

    particle.x +=
        (
            dx /
            distance
        ) *
        force *
        0.018;

    particle.y +=
        (
            dy /
            distance
        ) *
        force *
        0.018;
}


/* ============================================================
   19. WRAP
   ============================================================ */

function wrapParticle(
    particle
) {

    const margin =
        80;

    if (
        particle.x <
        -margin
    ) {

        particle.x =
            PARTICLES_STATE.width +
            margin;
    }

    if (
        particle.x >
        PARTICLES_STATE.width +
        margin
    ) {

        particle.x =
            -margin;
    }

    if (
        particle.y <
        -margin
    ) {

        particle.y =
            PARTICLES_STATE.height +
            margin;
    }

    if (
        particle.y >
        PARTICLES_STATE.height +
        margin
    ) {

        particle.y =
            -margin;
    }
}


/* ============================================================
   20. UPDATE BURSTS
   ============================================================ */

function updateBursts(
    delta
) {

    for (
        const burst of
        PARTICLES_STATE.bursts
    ) {

        burst.radius +=
            burst.speed *
            delta;

        burst.alpha -=
            burst.fade *
            delta;

        burst.particles
            .forEach(
                particle => {

                    particle.x +=
                        particle.vx *
                        delta;

                    particle.y +=
                        particle.vy *
                        delta;

                    particle.vx *=
                        0.996;

                    particle.vy *=
                        0.996;
                }
            );
    }
}


/* ============================================================
   21. UPDATE STREAMS
   ============================================================ */

function updateStreams(
    delta
) {

    for (
        const stream of
        PARTICLES_STATE.streams
    ) {

        stream.progress +=
            stream.speed *
            delta;

        stream.alpha -=
            stream.fade *
            delta;

        stream.particles
            .forEach(
                particle => {

                    particle.progress +=
                        particle.speed *
                        delta;

                    const progress =
                        particle.progress;

                    particle.x =
                        interpolate(
                            stream.sourceX,
                            stream.targetX,
                            progress
                        );

                    particle.y =
                        interpolate(
                            stream.sourceY,
                            stream.targetY,
                            progress
                        );
                }
            );
    }
}


/* ============================================================
   22. UPDATE INJECTION
   ============================================================ */

function updateInjectionParticles(
    delta
) {

    if (
        !PARTICLES_STATE.injection.active
    ) {

        return;
    }

    PARTICLES_STATE.injection.progress +=
        delta *
        0.00055;

    if (
        PARTICLES_STATE.injection.progress >=
        1
    ) {

        PARTICLES_STATE.injection.progress =
            1;

        PARTICLES_STATE.injection.active =
            false;
    }
}


/* ============================================================
   23. CLEANUP
   ============================================================ */

function cleanupParticles() {

    PARTICLES_STATE.bursts =
        PARTICLES_STATE.bursts
            .filter(
                burst =>
                    burst.alpha > 0
            );

    PARTICLES_STATE.streams =
        PARTICLES_STATE.streams
            .filter(
                stream =>
                    stream.alpha > 0
            );

    PARTICLES_STATE.particles =
        PARTICLES_STATE.particles
            .filter(
                particle =>
                    particle.active
            );
}


/* ============================================================
   24. RENDER
   ============================================================ */

function renderParticles() {

    const context =
        PARTICLES_DOM.context;

    if (!context) {
        return;
    }

    context.clearRect(
        0,
        0,
        PARTICLES_STATE.width,
        PARTICLES_STATE.height
    );

    renderAmbientParticles(
        context
    );

    renderBursts(
        context
    );

    renderStreams(
        context
    );

    renderInjection(
        context
    );
}


/* ============================================================
   25. RENDER AMBIENT
   ============================================================ */

function renderAmbientParticles(
    context
) {

    for (
        const particle of
        PARTICLES_STATE.particles
    ) {

        if (
            particle.type !==
            "ambient"
        ) {

            continue;
        }

        const depth =
            0.45 +
            particle.depth *
            0.75;

        const pulse =
            (
                Math.sin(
                    PARTICLES_STATE.elapsed *
                    0.0015 +
                    particle.phase
                ) + 1
            ) /
            2;

        const alpha =
            particle.alpha *
            depth *
            (
                0.72 +
                pulse *
                0.28
            );

        context.beginPath();

        context.arc(
            particle.x,
            particle.y,
            particle.radius *
            (
                0.7 +
                particle.depth *
                0.6
            ),
            0,
            Math.PI * 2
        );

        context.fillStyle =
            getParticleColor(
                particle.color,
                alpha
            );

        context.fill();
    }
}


/* ============================================================
   26. RENDER BURSTS
   ============================================================ */

function renderBursts(
    context
) {

    for (
        const burst of
        PARTICLES_STATE.bursts
    ) {

        for (
            const particle of
            burst.particles
        ) {

            context.beginPath();

            context.arc(
                particle.x,
                particle.y,
                particle.radius,
                0,
                Math.PI * 2
            );

            context.fillStyle =
                getParticleColor(
                    burst.color,
                    burst.alpha
                );

            context.fill();
        }
    }
}


/* ============================================================
   27. RENDER STREAMS
   ============================================================ */

function renderStreams(
    context
) {

    for (
        const stream of
        PARTICLES_STATE.streams
    ) {

        for (
            const particle of
            stream.particles
        ) {

            const alpha =
                stream.alpha *
                (
                    1 -
                    Math.abs(
                        particle.progress -
                        0.5
                    )
                );

            context.beginPath();

            context.arc(
                particle.x,
                particle.y,
                particle.radius,
                0,
                Math.PI * 2
            );

            context.fillStyle =
                getParticleColor(
                    stream.color,
                    alpha
                );

            context.fill();
        }
    }
}


/* ============================================================
   28. RENDER INJECTION
   ============================================================ */

function renderInjection(
    context
) {

    if (
        !PARTICLES_STATE.injection.active
    ) {

        return;
    }

    const injection =
        PARTICLES_STATE.injection;

    const progress =
        injection.progress;

    const x =
        interpolate(
            injection.sourceX,
            injection.targetX,
            progress
        );

    const y =
        interpolate(
            injection.sourceY,
            injection.targetY,
            progress
        );

    context.beginPath();

    context.arc(
        x,
        y,
        4 +
        Math.sin(
            progress *
            Math.PI
        ) *
        4,
        0,
        Math.PI * 2
    );

    context.shadowBlur =
        18;

    context.shadowColor =
        "rgba(116, 145, 255, 0.85)";

    context.fillStyle =
        "rgba(178, 195, 255, 0.95)";

    context.fill();

    context.shadowBlur =
        0;
}


/* ============================================================
   29. BURST
   ============================================================ */

function burst(
    options = {}
) {

    const amount =
        options.amount ||
        35;

    const x =
        options.x ??
        PARTICLES_STATE.center.x;

    const y =
        options.y ??
        PARTICLES_STATE.center.y;

    const color =
        options.color ||
        "blue";

    const speed =
        options.speed ||
        0.08;

    const particles =
        [];

    for (
        let index = 0;
        index < amount;
        index++
    ) {

        const angle =
            Math.random() *
            Math.PI *
            2;

        const velocity =
            speed *
            (
                0.35 +
                Math.random()
            );

        particles.push({

            x,

            y,

            vx:
                Math.cos(
                    angle
                ) *
                velocity,

            vy:
                Math.sin(
                    angle
                ) *
                velocity,

            radius:
                0.6 +
                Math.random() *
                2,

            color
        });
    }

    PARTICLES_STATE.bursts.push({

        x,

        y,

        radius:
            0,

        speed:
            options.radiusSpeed ||
            0.08,

        alpha:
            options.alpha ||
            0.9,

        fade:
            options.fade ||
            0.0018,

        color,

        particles
    });

    dispatchParticleEvent(
        "dna:particle-burst",
        {
            x,

            y,

            amount,

            color
        }
    );
}


/* ============================================================
   30. MEMORY BURST
   ============================================================ */

function memoryBurst(
    documentData = null
) {

    const center =
        PARTICLES_STATE.center;

    burst({

        x:
            center.x,

        y:
            center.y,

        amount:
            PARTICLES_CONFIG.memoryParticleAmount,

        color:
            "violet",

        speed:
            0.12,

        radiusSpeed:
            0.14,

        alpha:
            0.85,

        fade:
            0.0015
    });

    dispatchParticleEvent(
        "dna:memory-particles",
        {
            document:
                documentData
        }
    );
}


/* ============================================================
   31. INJECTION BURST
   ============================================================ */

function injectionBurst(
    options = {}
) {

    const center =
        PARTICLES_STATE.center;

    burst({

        x:
            options.x ??
            center.x,

        y:
            options.y ??
            center.y,

        amount:
            options.amount ||
            PARTICLES_CONFIG.injectionParticleAmount,

        color:
            options.color ||
            "blue",

        speed:
            options.speed ||
            0.18,

        radiusSpeed:
            0.22,

        alpha:
            0.95,

        fade:
            0.0018
    });

    dispatchParticleEvent(
        "dna:injection-burst",
        options
    );
}


/* ============================================================
   32. CONNECTION BURST
   ============================================================ */

function connectionBurst(
    x,
    y
) {

    burst({

        x,

        y,

        amount:
            PARTICLES_CONFIG
                .connectionParticleAmount,

        color:
            "blue",

        speed:
            0.08,

        radiusSpeed:
            0.10,

        alpha:
            0.75,

        fade:
            0.0022
    });
}


/* ============================================================
   33. CREATE STREAM
   ============================================================ */

function createStream(
    options = {}
) {

    const sourceX =
        options.sourceX ??
        0;

    const sourceY =
        options.sourceY ??
        0;

    const targetX =
        options.targetX ??
        PARTICLES_STATE.center.x;

    const targetY =
        options.targetY ??
        PARTICLES_STATE.center.y;

    const amount =
        options.amount ||
        30;

    const particles =
        [];

    for (
        let index = 0;
        index < amount;
        index++
    ) {

        particles.push({

            progress:
                Math.random(),

            speed:
                options.speed ||
                0.0008 +
                Math.random() *
                0.001,

            radius:
                options.radius ||
                0.7 +
                Math.random() *
                1.5,

            x:
                sourceX,

            y:
                sourceY
        });
    }

    PARTICLES_STATE.streams.push({

        sourceX,

        sourceY,

        targetX,

        targetY,

        particles,

        color:
            options.color ||
            "blue",

        alpha:
            options.alpha ||
            0.9,

        fade:
            options.fade ||
            0.0005,

        speed:
            options.speed ||
            0.001
    });

    return PARTICLES_STATE.streams[
        PARTICLES_STATE.streams.length - 1
    ];
}


/* ============================================================
   34. START INJECTION
   ============================================================ */

function startInjection(
    options = {}
) {

    const center =
        PARTICLES_STATE.center;

    PARTICLES_STATE.injection = {

        active:
            true,

        progress:
            0,

        sourceX:
            options.sourceX ??
            center.x,

        sourceY:
            options.sourceY ??
            center.y,

        targetX:
            options.targetX ??
            center.x,

        targetY:
            options.targetY ??
            center.y
    };

    injectionBurst(
        {
            x:
                PARTICLES_STATE.injection
                    .sourceX,

            y:
                PARTICLES_STATE.injection
                    .sourceY,

            amount:
                options.amount ||
                PARTICLES_CONFIG
                    .injectionParticleAmount
        }
    );

    createStream({

        sourceX:
            PARTICLES_STATE.injection
                .sourceX,

        sourceY:
            PARTICLES_STATE.injection
                .sourceY,

        targetX:
            PARTICLES_STATE.injection
                .targetX,

        targetY:
            PARTICLES_STATE.injection
                .targetY,

        amount:
            options.streamAmount ||
            42,

        color:
            "blue",

        alpha:
            0.95
    });

    dispatchParticleEvent(
        "dna:injection-started",
        {
            ...PARTICLES_STATE.injection
        }
    );
}


/* ============================================================
   35. STOP INJECTION
   ============================================================ */

function stopInjection() {

    PARTICLES_STATE.injection.active =
        false;

    PARTICLES_STATE.injection.progress =
        1;

    dispatchParticleEvent(
        "dna:injection-finished"
    );
}


/* ============================================================
   36. CLEAR EFFECTS
   ============================================================ */

function clearEffects() {

    PARTICLES_STATE.bursts =
        [];

    PARTICLES_STATE.streams =
        [];

    PARTICLES_STATE.injection.active =
        false;
}


/* ============================================================
   37. GET PARTICLES
   ============================================================ */

function getParticles() {

    return [
        ...PARTICLES_STATE.particles
    ];
}


/* ============================================================
   38. GET STATE
   ============================================================ */

function getParticleState() {

    return {

        running:
            PARTICLES_STATE.running,

        amount:
            PARTICLES_STATE.particles.length,

        bursts:
            PARTICLES_STATE.bursts.length,

        streams:
            PARTICLES_STATE.streams.length,

        injection:
            {
                ...PARTICLES_STATE.injection
            }
    };
}


/* ============================================================
   39. COLOR
   ============================================================ */

function getParticleColor(
    color,
    alpha
) {

    switch (
        String(
            color
        ).toLowerCase()
    ) {

        case "violet":

            return `rgba(157, 103, 255, ${alpha})`;

        case "orange":

            return `rgba(255, 153, 68, ${alpha})`;

        case "red":

            return `rgba(255, 72, 82, ${alpha})`;

        case "white":

            return `rgba(210, 220, 255, ${alpha})`;

        case "blue":

        default:

            return `rgba(100, 140, 255, ${alpha})`;
    }
}


/* ============================================================
   40. INTERPOLATE
   ============================================================ */

function interpolate(
    first,
    second,
    amount
) {

    return (
        first +
        (
            second -
            first
        ) *
        amount
    );
}


/* ============================================================
   41. CLAMP
   ============================================================ */

function clamp(
    value,
    minimum,
    maximum
) {

    return Math.max(
        minimum,
        Math.min(
            maximum,
            value
        )
    );
}


/* ============================================================
   42. EVENT BINDINGS
   ============================================================ */

function bindParticleEvents() {

    window.addEventListener(
        "dna:memory-acquired",
        event => {

            memoryBurst(
                event.detail?.document ||
                null
            );
        }
    );


    window.addEventListener(
        "dna:organism-grown",
        () => {

            burst({

                amount:
                    25,

                color:
                    "blue",

                speed:
                    0.07,

                radiusSpeed:
                    0.12
            });
        }
    );


    window.addEventListener(
        "dna:node-selected",
        event => {

            const node =
                event.detail?.node;

            if (!node) {
                return;
            }

            connectionBurst(
                node.x,
                node.y
            );
        }
    );


    window.addEventListener(
        "dna:injection-start",
        event => {

            startInjection(
                event.detail || {}
            );
        }
    );


    window.addEventListener(
        "dna:injection-complete",
        () => {

            stopInjection();

            memoryBurst();
        }
    );


    window.addEventListener(
        "resize",
        resizeParticles
    );
}


/* ============================================================
   43. DISPATCH EVENT
   ============================================================ */

function dispatchParticleEvent(
    name,
    detail = {}
) {

    window.dispatchEvent(
        new CustomEvent(
            name,
            {
                detail: {

                    ...detail,

                    particles:
                        PARTICLES_STATE
                }
            }
        )
    );
}


/* ============================================================
   44. PUBLIC API
   ============================================================ */

window.DNAParticles = {

    state:
        PARTICLES_STATE,

    config:
        PARTICLES_CONFIG,

    initialize:
        initializeParticles,

    start:
        startParticles,

    stop:
        stopParticles,

    resize:
        resizeParticles,

    create:
        createParticle,

    burst,

    memoryBurst,

    injectionBurst,

    connectionBurst,

    createStream,

    startInjection,

    stopInjection,

    clear:
        clearEffects,

    get:
        getParticles,

    getState:
        getParticleState
};


/* ============================================================
   45. GLOBAL COMPATIBILITY
   ============================================================ */

window.initializeParticles =
    initializeParticles;


/* ============================================================
   46. AUTO INITIALIZATION
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            initializeParticles();

        }
    );

} else {

    initializeParticles();
}
