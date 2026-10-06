/* DNA — deterministic relationships derived from document evidence. */
(() => {
    "use strict";
    const state = { connections: [] };
    const emit = (name, detail = {}) => document.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    function getDocuments() { return window.DNADocuments?.getAll?.() || []; }
    function common(a = [], b = []) { const right = new Set(b.map(String)); return [...new Set(a.map(String).filter(item => right.has(item)))]; }
    function addConnection({ source, target, evidence = [], type = "SHARED_EVIDENCE", strength } = {}) {
        if (!source || !target || source === target || !evidence.length) return null;
        const docs = new Set(getDocuments().map(doc => doc.id));
        if (!docs.has(source) || !docs.has(target)) return null;
        const [left, right] = [source, target].sort();
        const id = `REL-${left}--${right}`;
        const connection = { id, source: left, target: right, type, evidence: [...new Set(evidence)], strength: Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : Math.min(1, evidence.length / 5) };
        const index = state.connections.findIndex(item => item.id === id);
        if (index >= 0) state.connections[index] = connection;
        else state.connections.push(connection);
        return connection;
    }
    function buildConnections() {
        const docs = getDocuments();
        const rebuilt = [];
        for (let i=0; i<docs.length; i++) for (let j=i+1; j<docs.length; j++) {
            const a=docs[i], b=docs[j], aa=a.analysis || {}, bb=b.analysis || {}, evidence=[];
            for (const [key, prefix] of [["years","YEAR"],["dates","DATE"],["emails","EMAIL"],["urls","URL"],["references","REFERENCE"],["keywords","KEYWORD"]]) {
                common(aa[key], bb[key]).forEach(value => evidence.push(`${prefix}:${value}`));
            }
            if (!evidence.length) continue;
            const connection = addConnection({ source:a.id, target:b.id, evidence });
            if (connection) rebuilt.push(connection);
        }
        state.connections = rebuilt;
        emit("dna:connections-rebuilt", { connections:getAll() });
        return getAll();
    }
    function getAll() { return [...state.connections]; }
    function getForDocument(id) { return state.connections.filter(item => item.source === id || item.target === id); }
    function getRelated(id) { const ids = new Set(getForDocument(id).map(item => item.source === id ? item.target : item.source)); return [...ids].map(other => window.DNADocuments?.getById(other)).filter(Boolean); }
    function count() { return state.connections.length; }
    function clear() { state.connections = []; emit("dna:connections-cleared"); }
    function save() { return true; }
    function restore() { return buildConnections(); }
    window.DNAConnections = { state, buildConnections, getAll, getForDocument, getRelated, count, clear, save, restore };
    document.addEventListener("dna:documents-changed", buildConnections);
    document.addEventListener("dna:documents-cleared", clear);
})();
