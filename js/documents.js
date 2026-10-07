/* DNA — document records and deterministic metadata analysis. */
(() => {
    "use strict";
    const state = { documents: [], selectedId: null, nextId: 1 };
    const emit = (name, detail = {}) => document.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    const extension = name => { const i = String(name || "").lastIndexOf("."); return i < 0 ? "" : name.slice(i).toLowerCase(); };
    const types = { ".pdf":"PDF", ".txt":"TEXT", ".json":"JSON", ".csv":"CSV", ".xml":"XML", ".html":"HTML", ".htm":"HTML", ".md":"MARKDOWN", ".markdown":"MARKDOWN", ".log":"LOG" };
    const fallbackMimes = { ".pdf":"application/pdf", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".heic":"image/heic", ".heif":"image/heif" };
    const fileType = file => types[extension(file.name)] || (file.type?.startsWith("text/") ? "TEXT" : file.type || "FILE");
    const normalizeText = text => String(text || "").replace(/\r/g, "").replace(/\t/g, " ").replace(/[ ]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const formatBytes = bytes => { if (!bytes) return "0 B"; const u=["B","KB","MB","GB"]; const i=Math.min(u.length-1,Math.floor(Math.log(bytes)/Math.log(1024))); return `${(bytes/1024**i).toFixed(i?2:0)} ${u[i]}`; };
    function newId() { return `DOC-${Date.now().toString(36)}-${(state.nextId++).toString(36)}`.toUpperCase(); }
    function suggestedCategory(name, text) {
        const source = `${name} ${text.slice(0, 6000)}`.toLocaleLowerCase("pt-BR");
        const rules = [
            ["Identidade", /rg|cpf|passaporte|identidade|cnh|certid[aã]o/],
            ["Finanças", /banco|fatura|nota fiscal|imposto|irpf|pagamento|recibo|financeir/],
            ["Saúde", /sa[uú]de|exame|receita m[eé]dica|consulta|hospital|cl[ií]nica/],
            ["Trabalho", /trabalho|emprego|curr[ií]culo|contrato|holerite|sal[aá]rio/],
            ["Estudos", /escola|universidade|curso|hist[oó]rico escolar|diploma|certificado/],
            ["Moradia", /aluguel|im[oó]vel|condom[ií]nio|energia|[aá]gua|internet/],
            ["Jurídico", /processo|jur[ií]dic|advogad|tribunal|procura[cç][aã]o/],
            ["Família", /fam[ií]lia|casamento|nascimento|filho|parente/]
        ];
        return rules.find(([, pattern]) => pattern.test(source))?.[0] || "A organizar";
    }
    async function checksum(file) {
        try {
            if (!globalThis.crypto?.subtle) return null;
            const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
            return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
        } catch { return null; }
    }
    async function verifyIntegrity(id) {
        const item = getById(id);
        if (!item?.sha256) return { status: "unavailable", message: "Este registro não tem checksum calculado." };
        const file = getFile(id);
        if (!file) return { status: "unavailable", message: "Os bytes originais não estão disponíveis neste navegador." };
        const actual = await checksum(file);
        if (!actual) return { status: "unavailable", message: "Web Crypto não está disponível neste contexto." };
        return actual === item.sha256
            ? { status: "verified", message: "SHA-256 confere com os bytes armazenados." }
            : { status: "mismatch", message: "O SHA-256 diverge dos bytes armazenados." };
    }
    function uniqueMatches(text, pattern) { return [...new Set(text.match(pattern) || [])]; }
    function analyzeText(text) {
        const keywords = ["contrato","ofício","oficio","relatório","relatorio","memorando","parecer","processo","protocolo","requerimento","portaria","resolução","resolucao","ata","declaração","declaracao","termo","nota fiscal","convênio","convenio","edital","despacho","certidão","certidao"];
        const lower = text.toLowerCase();
        const found = keywords.filter(word => lower.includes(word));
        const priority = ["contrato","processo","ofício","oficio","relatório","relatorio","memorando","parecer","requerimento","portaria","resolução","resolucao","ata","termo","edital","despacho"];
        return {
            dates: uniqueMatches(text, /\b(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\b/g),
            years: uniqueMatches(text, /\b(?:19|20)\d{2}\b/g),
            emails: uniqueMatches(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi),
            urls: uniqueMatches(text, /\bhttps?:\/\/[^\s<>"']+/gi),
            references: uniqueMatches(text, /\b(?:processo|protocolo|contrato|documento|n[ºo°])[\s:#-]*[A-Z0-9./-]{3,}\b/gi),
            keywords: found, textLength: text.length,
            wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
            detectedType: priority.find(word => found.includes(word)) || found[0] || null
        };
    }
    async function bytesToBase64(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        const chunk = 0x8000;
        for (let i=0; i<bytes.length; i+=chunk) binary += String.fromCharCode(...bytes.subarray(i, i+chunk));
        return btoa(binary);
    }
    async function createFromFile(file) {
        if (!(file instanceof File)) throw new Error("Arquivo inválido.");
        const type = fileType(file);
        let text = "", structuredData = null, extractionStatus = "BINARY_FILE_RECEIVED";
        if (type === "PDF") extractionStatus = "PDF_RECEIVED";
        else if (type === "JSON") {
            text = normalizeText(await file.text());
            try { structuredData = JSON.parse(text); extractionStatus = "JSON_EXTRACTED"; }
            catch { extractionStatus = "JSON_INVALID_TEXT_EXTRACTED"; }
        } else if (type === "TEXT" || type === "CSV" || type === "XML" || type === "HTML" || type === "MARKDOWN" || type === "LOG") {
            text = normalizeText(await file.text()); extractionStatus = "TEXT_EXTRACTED";
        }
        const analysis = analyzeText(text);
        const sha256 = await checksum(file);
        const duplicate = sha256 && state.documents.find(item => item.sha256 === sha256);
        if (duplicate) throw new Error(`Este arquivo já está no arquivo pessoal como “${duplicate.name}”.`);
        const category = suggestedCategory(file.name, text);
        const record = {
            id: newId(), name: file.name, type, mimeType: file.type || fallbackMimes[extension(file.name)] || "application/octet-stream",
            extension: extension(file.name), size: file.size, sizeFormatted: formatBytes(file.size),
            lastModified: file.lastModified || null, createdAt: new Date().toISOString(),
            text, structuredData, fileData: await bytesToBase64(file), extractionStatus,
            detectedType: analysis.detectedType, classification: null, retention: null, destination: null,
            sha256,
            archiveMetadata: {
                category,
                className: "",
                categorySuggested: category !== "A organizar",
                classCode: "",
                producer: "",
                createdDate: "",
                dateCandidate: analysis.dates[0] || "",
                accessLevel: "PESSOAL",
                accessNote: "",
                retentionRule: "",
                disposition: "",
                tags: [...analysis.keywords],
                notes: "",
                metadataUpdatedAt: null
            },
            analysis
        };
        state.documents.push(record);
        const saveOriginal = window.DNAStorage?.saveDocumentFiles;
        const saved = typeof saveOriginal === "function" ? await saveOriginal(record, state.documents) : save();
        if (!saved) {
            state.documents.pop();
            const storageError = window.DNAStorage?.state?.lastError;
            if (location.protocol === "file:") throw new Error("Abra o endereço HTTPS publicado do site. O navegador bloqueia o armazenamento de documentos quando index.html é aberto diretamente.");
            if (storageError?.name === "QuotaExceededError") throw new Error("O espaço do navegador acabou. Libere espaço ou exporte e remova arquivos antigos antes de tentar novamente.");
            throw new Error(storageError?.message ? `Não foi possível guardar o original: ${storageError.message}` : "Não foi possível guardar o original no armazenamento seguro deste navegador.");
        }
        emit("dna:document-created", { document: record });
        emit("dna:documents-changed", { documents: getAll(), reason: "created" });
        return record;
    }
    function getAll() { return [...state.documents]; }
    function getById(id) { return state.documents.find(item => item.id === id) || null; }
    function save() { return window.DNAStorage?.saveDocuments?.(state.documents) === true; }
    function restore(records) {
        const source = Array.isArray(records) ? records : (window.DNAStorage?.restoreDocuments?.() || []);
        state.documents = source.filter(item => item && typeof item.id === "string").map(item => ({ ...item, archiveMetadata: item.archiveMetadata || { category: "A organizar", className: "", categorySuggested: false, classCode: "", producer: "", createdDate: "", dateCandidate: "", accessLevel: "PESSOAL", accessNote: "", retentionRule: "", disposition: "", tags: item.analysis?.keywords || [], notes: "", metadataUpdatedAt: null }, analysis: item.analysis || analyzeText(item.text || "") }));
        state.selectedId = null;
        emit("dna:documents-changed", { documents: getAll(), reason: "restored" });
        return getAll();
    }
    function load(records) { state.documents = Array.isArray(records) ? records.map(item => ({ ...item })) : []; state.selectedId = null; return getAll(); }
    function remove(id) {
        const before = state.documents.length;
        state.documents = state.documents.filter(item => item.id !== id);
        if (state.selectedId === id) state.selectedId = null;
        if (before === state.documents.length) return false;
        if (!save()) return false;
        emit("dna:document-removed", { id });
        emit("dna:documents-changed", { documents: getAll(), reason: "removed" });
        return true;
    }
    function clear() {
        const prior = state.documents;
        state.documents = []; state.selectedId = null;
        if (!save()) { state.documents = prior; return false; }
        emit("dna:documents-cleared");
        emit("dna:documents-changed", { documents: [], reason: "cleared" });
        return true;
    }
    function select(id) {
        const item = getById(id); if (!item) return null;
        state.selectedId = id; emit("dna:document-selected", { document: item }); return item;
    }
    function clearSelection() { state.selectedId = null; }
    function updateMetadata(id, changes = {}) {
        const item = getById(id);
        if (!item || !changes || typeof changes !== "object") return false;
        const previous = { ...item.archiveMetadata };
        const allowed = ["category", "className", "classCode", "producer", "createdDate", "accessLevel", "accessNote", "retentionRule", "disposition", "tags", "notes", "aiAnalysis"];
        const updated = { ...item.archiveMetadata };
        allowed.forEach(key => { if (Object.hasOwn(changes, key)) updated[key] = key === "aiAnalysis" ? changes[key] : key === "tags" ? (Array.isArray(changes[key]) ? changes[key] : String(changes[key]).split(",").map(tag => tag.trim()).filter(Boolean)) : String(changes[key] ?? "").trim(); });
        updated.categorySuggested = false;
        updated.metadataUpdatedAt = new Date().toISOString();
        item.archiveMetadata = updated;
        if (!save()) { item.archiveMetadata = previous; return false; }
        emit("dna:document-metadata-updated", { id, metadata: updated });
        emit("dna:documents-changed", { documents: getAll(), reason: "metadata-updated" });
        return true;
    }
    function getFile(id) {
        const item = getById(id); if (!item?.fileData) return null;
        const raw = atob(item.fileData), bytes = new Uint8Array(raw.length);
        for (let i=0; i<raw.length; i++) bytes[i] = raw.charCodeAt(i);
        return new File([bytes], item.name, { type: item.mimeType, lastModified: item.lastModified || Date.now() });
    }
    function getStats() {
        const docs = state.documents;
        return { total: docs.length,
            active: docs.filter(d => d.active === true || String(d.status || "").toUpperCase() === "ACTIVE").length,
            permanent: docs.filter(d => String(d.retention || "").toUpperCase() === "PERMANENT").length,
            withText: docs.filter(d => Boolean(d.text)).length,
            totalText: docs.reduce((n,d) => n + (d.analysis?.textLength || 0), 0),
            totalWords: docs.reduce((n,d) => n + (d.analysis?.wordCount || 0), 0) };
    }
    window.DNADocuments = { state, createFromFile, getAll, getById, remove, clear, select, clearSelection, getFile, getStats, updateMetadata, verifyIntegrity, analyzeDocument: doc => ({ ...doc, analysis: analyzeText(doc?.text || "") }), save, restore, load, suggestCategory: suggestedCategory, formatBytes, extractDates: text => analyzeText(text).dates, extractYears: text => analyzeText(text).years, extractEmails: text => analyzeText(text).emails, extractURLs: text => analyzeText(text).urls, extractNumbers: text => analyzeText(text).references, detectKeywords: text => analyzeText(text).keywords };
    window.addDNAFile = createFromFile;
    restore();
    window.DNAStorage?.ready?.then(records => restore(records)).catch(() => {});
})();
