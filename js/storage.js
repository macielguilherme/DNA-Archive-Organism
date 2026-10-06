/* DNA — single LocalStorage boundary. Documents are authoritative;
   connections and organism geometry are rebuilt from them. */
"use strict";

const STORAGE_KEY = "DNA_ARCHIVE_SYSTEM_V1";
const LEGACY_DOCUMENTS_KEY = "DNA_ARCHIVE_REAL_DOCUMENTS_V1";
const STORAGE_CONFIG = { namespace: "DNA_ARCHIVE", version: 1, persistDocuments: true, persistConnections: false };
const STORAGE_STATE = {
    initialized: false,
    available: false,
    lastSave: null,
    lastError: null,
    saves: 0
};

function storageEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, {
        detail, bubbles: true
    }));
}

function emptyStoredState() {
    return { version: 1, documents: [], events: [], preferences: {}, timeline: null, backups: [] };
}

function readStoredState() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (value && typeof value === "object") {
            return { ...emptyStoredState(), ...value,
                documents: Array.isArray(value.documents) ? value.documents : [],
                events: Array.isArray(value.events) ? value.events : [],
                preferences: value.preferences && typeof value.preferences === "object" ? value.preferences : {},
                backups: Array.isArray(value.backups) ? value.backups : [] };
        }
        const legacy = JSON.parse(localStorage.getItem(LEGACY_DOCUMENTS_KEY) || "null");
        return { ...emptyStoredState(), documents: Array.isArray(legacy) ? legacy : [] };
    } catch (error) {
        STORAGE_STATE.lastError = error;
        return emptyStoredState();
    }
}

const FILE_DB_NAME = "DNA_ARCHIVE_FILES_V1";
const FILE_STORE_NAME = "originals";
let fileDbPromise;
function openFileDb() {
    if (!globalThis.indexedDB) return Promise.reject(new Error("IndexedDB indisponível neste endereço."));
    if (!fileDbPromise) fileDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(FILE_DB_NAME, 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(FILE_STORE_NAME)) request.result.createObjectStore(FILE_STORE_NAME, { keyPath: "id" }); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento de documentos."));
        request.onblocked = () => reject(new Error("Feche outras abas do arquivo e tente novamente."));
    });
    return fileDbPromise;
}
function fileTransaction(mode, action) {
    return openFileDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE_NAME, mode);
        action(tx.objectStore(FILE_STORE_NAME));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("Falha ao gravar o arquivo original."));
        tx.onabort = () => reject(tx.error || new Error("A gravação do arquivo foi cancelada."));
    }));
}
function stripFileBytes(documents) { return documents.map(({ fileData, ...record }) => record); }
async function saveDocumentFiles(record, documents) {
    if (!record?.id || !record.fileData) return false;
    const previous = storedState.documents;
    try {
        await fileTransaction("readwrite", store => store.put({ id: record.id, fileData: record.fileData }));
        storedState.documents = stripFileBytes(documents);
        if (!persist()) {
            storedState.documents = previous;
            await fileTransaction("readwrite", store => store.delete(record.id)).catch(() => {});
            return false;
        }
        STORAGE_STATE.lastError = null;
        return true;
    } catch (error) {
        STORAGE_STATE.lastError = error;
        storageEvent("dna:storage-error", { operation: "save-original", message: error.message });
        return false;
    }
}
async function hydrateStoredDocuments() {
    const db = await openFileDb();
    const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE_NAME, "readonly");
        const request = tx.objectStore(FILE_STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error("Não foi possível restaurar os originais."));
    });
    const files = new Map(rows.map(item => [item.id, item.fileData]));
    const legacy = storedState.documents.filter(item => item.fileData && !files.has(item.id));
    if (legacy.length) {
        await fileTransaction("readwrite", store => legacy.forEach(item => store.put({ id: item.id, fileData: item.fileData })));
        legacy.forEach(item => files.set(item.id, item.fileData));
        storedState.documents = stripFileBytes(storedState.documents);
        persist();
    }
    return storedState.documents.map(item => ({ ...item, fileData: files.get(item.id) || "" }));
}
let storedState = readStoredState();

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
        localStorage.removeItem(LEGACY_DOCUMENTS_KEY);
        localStorage.removeItem("DNA_ARCHIVE_REAL_CONNECTIONS_V1");
        STORAGE_STATE.available = true;
        STORAGE_STATE.lastSave = new Date().toISOString();
        STORAGE_STATE.saves++;
        storageEvent("dna:storage-save", { savedAt: STORAGE_STATE.lastSave });
        return true;
    } catch (error) {
        STORAGE_STATE.lastError = error;
        storageEvent("dna:storage-error", { operation: "save", message: error.message });
        return false;
    }
}

function initializeStorage() {
    try {
        localStorage.setItem("DNA_ARCHIVE_TEST", "1");
        localStorage.removeItem("DNA_ARCHIVE_TEST");
        STORAGE_STATE.available = true;
    } catch (error) {
        STORAGE_STATE.available = false;
        STORAGE_STATE.lastError = error;
    }
    STORAGE_STATE.initialized = true;
    storageEvent("dna:storage-ready", { available: STORAGE_STATE.available });
    return STORAGE_STATE;
}
function save(key, value) { storedState[key] = value; return persist(); }
function read(key, fallback = null) { return storedState[key] ?? fallback; }
function remove(key) { delete storedState[key]; return persist(); }
function saveDocuments(documents) {
    if (!Array.isArray(documents)) return false;
    const prior = storedState.documents;
    const next = stripFileBytes(documents);
    const keep = new Set(next.map(item => item.id));
    storedState.documents = next;
    if (persist()) {
        prior.filter(item => item.id && !keep.has(item.id)).forEach(item => fileTransaction("readwrite", store => store.delete(item.id)).catch(() => {}));
        return true;
    }
    storedState.documents = prior;
    return false;
}
function restoreDocuments() { return [...storedState.documents]; }
function saveConnections() { return true; }
function restoreConnections() { return window.DNAConnections?.getAll?.() || []; }
function saveState(value) { return save("applicationState", value || {}); }
function restoreState() { return read("applicationState", null); }
function saveOrganism(value) {
    const year = Number(value?.evolution);
    storedState.timeline = Number.isFinite(year) && year >= 1950 && year <= 2026 ? { year } : null;
    return persist();
}
function restoreOrganism() { return storedState.timeline; }
function savePreferences(value = {}) {
    storedState.preferences = { ...value };
    return persist();
}
function restorePreferences() { return { ...storedState.preferences }; }
function saveSession(value = {}) { storedState.session = { ...value }; return persist(); }
function restoreSession() { return read("session", null); }
function saveEvents(events) {
    if (!Array.isArray(events)) return false;
    storedState.events = events;
    return persist();
}
function restoreEvents() { return [...storedState.events]; }
function createBackup(options = {}) {
    const backup = { id: `BACKUP-${Date.now()}`, createdAt: new Date().toISOString(), reason: options.reason || "manual", snapshot: { ...storedState, backups: [] } };
    storedState.backups.unshift(backup);
    storedState.backups = storedState.backups.slice(0, 5);
    return persist() ? backup : null;
}
function getBackups() { return [...storedState.backups]; }
function restoreBackup(id) {
    const item = storedState.backups.find(entry => entry.id === id);
    if (!item?.snapshot) return false;
    const backups = storedState.backups;
    storedState = { ...emptyStoredState(), ...item.snapshot, backups };
    return persist();
}
async function exportStorage() { return { application: "DNA — Arquivo Vivo", ...storedState, documents: await hydrateStoredDocuments() }; }
async function downloadStorageExport() {
    const data = await exportStorage();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "dna-archive-state.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
async function importStorage(data) {
    if (!data || typeof data !== "object" || !Array.isArray(data.documents)) return false;
    createBackup({ reason: "before-import" });
    for (const item of data.documents) if (item?.id && item.fileData) await fileTransaction("readwrite", store => store.put({ id: item.id, fileData: item.fileData }));
    storedState = { ...emptyStoredState(), ...data,
        documents: stripFileBytes(data.documents),
        events: Array.isArray(data.events) ? data.events : [],
        preferences: data.preferences || {},
        backups: storedState.backups };
    if (!persist()) return false;
    storageEvent("dna:storage-imported");
    window.DNADocuments?.restore?.(await hydrateStoredDocuments());
    window.DNAConnections?.buildConnections?.();
    window.DNAOrganism?.rebuild?.();
    return true;
}
async function importStorageFile(file) {
    try { return await importStorage(JSON.parse(await file.text())); }
    catch (error) { STORAGE_STATE.lastError = error; return false; }
}
function clearAll(options = {}) {
    if (!options.skipBackup) createBackup({ reason: "before-clear" });
    const backups = storedState.backups;
    storedState = { ...emptyStoredState(), backups };
    const ok = persist();
    storageEvent("dna:storage-cleared");
    return ok;
}
function clearEverything() { storedState = emptyStoredState(); return persist(); }
function saveEverything() { return persist(); }
function restoreEverything() { return { documents: restoreDocuments(), events: restoreEvents(), preferences: restorePreferences(), timeline: restoreOrganism() }; }
function applyRestoredSystem(data = restoreEverything()) {
    window.DNADocuments?.load?.(data.documents || []);
    window.DNAConnections?.buildConnections?.();
    if (data.timeline) window.DNATimeline?.restoreState?.(data.timeline);
    window.DNAOrganism?.rebuild?.();
    return true;
}
function getStorageSize() { try { return new Blob([localStorage.getItem(STORAGE_KEY) || ""]).size; } catch { return 0; } }
function getKeys() { try { return localStorage.getItem(STORAGE_KEY) === null ? [] : [STORAGE_KEY]; } catch { return []; } }
function getFormattedStorageSize() { const size=getStorageSize(); return size < 1024 ? `${size} B` : size < 1048576 ? `${(size/1024).toFixed(1)} KB` : `${(size/1048576).toFixed(2)} MB`; }
function getStorageInfo() { return { ...STORAGE_STATE, keys: getKeys(), size: getStorageSize(), formattedSize: getFormattedStorageSize(), version: 1 }; }

window.DNAStorage = {
    state: STORAGE_STATE, config: STORAGE_CONFIG, initialize: initializeStorage, available: () => STORAGE_STATE.available,
    save, read, remove, saveState, restoreState, saveDocuments, restoreDocuments,
    saveConnections, restoreConnections, saveOrganism, restoreOrganism,
    savePreferences, restorePreferences, saveSession, restoreSession,
    saveEvents, restoreEvents, createBackup, getBackups, restoreBackup,
    export: exportStorage, downloadExport: downloadStorageExport, import: importStorage, importFile: importStorageFile, saveDocumentFiles, ready: null,
    clear: clearAll, clearEverything, saveEverything, restoreEverything,
    applyRestoredSystem, getStorageSize, getFormattedStorageSize, getKeys, getInfo: getStorageInfo
};
initializeStorage();
window.DNAStorage.ready = hydrateStoredDocuments().catch(error => { STORAGE_STATE.lastError = error; return restoreDocuments(); });
