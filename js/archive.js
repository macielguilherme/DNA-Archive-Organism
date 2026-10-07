/* DNA — Personal Archive workspace and e-ARQ inspired metadata. */
(() => {
    "use strict";
    let categories = ["A organizar", "Identidade", "Finanças", "Saúde", "Trabalho", "Estudos", "Moradia", "Jurídico", "Família", "Outros"];
    const state = { open: false, view: "overview", query: "", category: "Todas", selected: null, aiResults: {}, integrityResults: {} };
    const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    const docs = () => window.DNADocuments?.getAll?.() || [];
    const metadata = doc => doc.archiveMetadata || {};
    const listValue = value => Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
    const fmtDate = value => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR"); };

    function mount() {
        const shell = document.createElement("div");
        shell.id = "archive-workspace";
        shell.innerHTML = `
            <button class="archive-workspace__scrim" data-archive-close aria-label="Fechar biblioteca" tabindex="-1"></button>
            <aside class="archive-drawer" aria-label="Central do arquivo" aria-hidden="true">
                <header class="archive-drawer__header">
                    <div><small>DNA / ARQUIVO PESSOAL</small><h2>Central do arquivo</h2></div>
                    <button class="archive-icon-button" data-archive-close aria-label="Fechar">×</button>
                </header>
                <nav class="archive-nav" aria-label="Seções do arquivo">
                    <button data-archive-view="overview">⌂ <span>Visão geral</span></button>
                    <button data-archive-view="library">▤ <span>Documentos</span><b data-nav-count>0</b></button>
                    <button data-archive-view="classification">⌗ <span>Classificação</span></button>
                    <button data-archive-view="preservation">◈ <span>Preservação</span></button>
                    <button data-archive-view="audit">◷ <span>Auditoria</span></button>
                </nav>
                <section class="archive-workspace__content" data-archive-content></section>
                <footer class="archive-drawer__footer">
                    <button class="archive-utility-button" data-archive-export>⇩ Exportar pacote</button>
                    <button class="archive-utility-button" data-archive-import>⇧ Importar pacote</button>
                    <input type="file" accept="application/json,.json" data-archive-import-input hidden>
                </footer>
            </aside>`;
        document.body.append(shell);
        document.querySelectorAll('[data-action="archive-toggle"]').forEach(button => button.addEventListener("click", () => setOpen(true)));
        shell.querySelectorAll("[data-archive-close]").forEach(button => button.addEventListener("click", () => setOpen(false)));
        shell.addEventListener("click", handleClick);
        shell.addEventListener("input", handleInput);
        shell.addEventListener("change", handleChange);
        shell.querySelector("[data-archive-import]").addEventListener("click", () => shell.querySelector("[data-archive-import-input]").click());
        shell.querySelector("[data-archive-import-input]").addEventListener("change", async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const imported = await window.DNAStorage?.importFile?.(file);
            if (imported) logEvent("PACKAGE IMPORTED", file.name);
            alert(imported ? "Pacote importado. Os dados locais anteriores foram guardados em backup." : "Não foi possível importar este pacote JSON.");
            event.target.value = "";
            render();
        });
        document.addEventListener("dna:documents-changed", render);
        document.addEventListener("dna:document-selected", event => { state.selected = event.detail?.document?.id || state.selected; render(); });
        document.addEventListener("dna:gemini-analysis", event => { state.aiResults[event.detail.id] = event.detail; if (event.detail.status === "complete") logEvent("ARQUIVO ORGANIZADO PELA IA", `Campos arquivísticos preenchidos e salvos automaticamente para ${event.detail.id}.`); if (state.view === "classification") render(); });
        document.addEventListener("keydown", event => { if (event.key === "Escape" && state.open) setOpen(false); });
        render();
    }

    function setOpen(open) {
        state.open = open;
        const root = document.querySelector("#archive-workspace");
        root?.classList.toggle("is-open", open);
        root?.querySelector(".archive-drawer")?.setAttribute("aria-hidden", String(!open));
        if (open) render();
    }

    function render() {
        const root = document.querySelector("#archive-workspace");
        if (!root) return;
        const list = docs();
        categories = [...new Set(["A organizar", "Identidade", "Finanças", "Saúde", "Trabalho", "Estudos", "Moradia", "Jurídico", "Família", "Outros", ...list.map(item => metadata(item).category).filter(Boolean)])];
        root.querySelector("[data-nav-count]").textContent = String(list.length);
        root.querySelectorAll("[data-archive-view]").forEach(button => button.classList.toggle("is-active", button.dataset.archiveView === state.view));
        const content = root.querySelector("[data-archive-content]");
        const missingDescription = list.filter(doc => !metadata(doc).classCode || !metadata(doc).producer || !metadata(doc).retentionRule).length;
        const missingHash = list.filter(doc => !doc.sha256).length;
        if (state.view === "overview") {
            content.innerHTML = `<div class="archive-view-heading"><span>PAINEL PESSOAL</span><h3>Seu arquivo, em contexto.</h3><p>Documentos e metadados ficam no armazenamento local deste navegador.</p></div>
                <div class="archive-stat-grid"><article><span>DOCUMENTOS</span><strong>${list.length}</strong></article><article><span>ARMAZENAMENTO</span><strong>${escape(window.DNAStorage?.getFormattedStorageSize?.() || "—")}</strong></article><article><span>METADADOS PENDENTES</span><strong>${missingDescription}</strong></article><article><span>INTEGRIDADE SHA-256</span><strong>${list.length - missingHash}/${list.length}</strong></article></div>
                <div class="archive-callout"><b>Próximo passo recomendado</b><p>${list.length ? `${missingDescription} documento(s) ainda podem receber produtor, código de classificação e regra de retenção.` : "Adicione seus arquivos para começar a construir seu arquivo pessoal."}</p><button class="button button--primary" data-action="inject">+ Adicionar documentos</button></div>
                <div class="archive-section-title"><span>ACESSO RÁPIDO</span></div>${quickLinks()}`;
        } else if (state.view === "library") {
            const filtered = filterDocs(list);
            content.innerHTML = `<div class="archive-view-heading"><span>ACERVO PESSOAL</span><h3>Documentos</h3><p>Pesquise e organize arquivos capturados neste navegador.</p></div>
                <div class="archive-search"><input type="search" data-archive-search placeholder="Buscar nome, assunto, tag…" value="${escape(state.query)}" aria-label="Buscar documentos"><span>⌕</span></div>
                <div class="archive-filter-row"><label for="archive-category-filter">Coleção</label><select id="archive-category-filter" data-archive-category>${["Todas", ...categories].map(category => `<option ${category === state.category ? "selected" : ""}>${escape(category)}</option>`).join("")}</select></div>
                <div class="archive-result-count">${filtered.length} DE ${list.length} DOCUMENTOS</div>
                <div class="archive-document-list">${filtered.length ? filtered.map(renderCard).join("") : `<div class="archive-empty"><span>◇</span><b>Nenhum documento por aqui</b><p>Experimente outra busca ou adicione arquivos ao acervo.</p><button class="button button--primary" data-action="inject">Adicionar documentos</button></div>`}</div>`;
        } else if (state.view === "classification") {
            const doc = list.find(item => item.id === state.selected) || list.find(item => !metadata(item).classCode) || list[0];
            content.innerHTML = `<div class="archive-view-heading"><span>GESTÃO DA DESCRIÇÃO</span><h3>Classificação</h3><p>Práticas inspiradas no e-ARQ Brasil v2: classificação, metadados capturados, controle de acesso e destinação documentada. Preencha conforme sua realidade; nada é inferido como regra oficial.</p></div>
                ${doc ? metadataForm(doc) : `<div class="archive-empty"><b>Seu arquivo começa aqui</b><p>Inclua um documento para criar sua primeira descrição.</p><button class="button button--primary" data-action="inject">Adicionar documento</button></div>`}`;
        } else if (state.view === "preservation") {
            content.innerHTML = `<div class="archive-view-heading"><span>CONFIABILIDADE E PRESERVAÇÃO</span><h3>Integridade</h3><p>Verificações técnicas calculadas a partir dos arquivos capturados.</p></div>
                <div class="archive-preservation-card"><span>CHECKSUM SHA-256</span><strong>${list.length - missingHash} / ${list.length}</strong><p>Identificador criptográfico calculado localmente durante a captura, quando o navegador oferece Web Crypto.</p></div>
                <div class="archive-preservation-list"><div class="archive-section-title"><span>CONFERIR ARQUIVOS</span></div>${list.length ? list.map(doc => { const result = state.integrityResults[doc.id]; return `<article><div><b>${escape(doc.name)}</b><code>${escape(doc.sha256 ? `${doc.sha256.slice(0, 14)}…` : "SEM CHECKSUM")}</code>${result ? `<small class="integrity-${escape(result.status)}">${escape(result.message)}</small>` : ""}</div><button class="button" data-verify-integrity="${escape(doc.id)}" ${doc.sha256 ? "" : "disabled"}>Conferir</button></article>`; }).join("") : `<div class="archive-empty"><b>Nenhum arquivo capturado</b></div>`}</div>
                <div class="archive-preservation-card"><span>EXTRAÇÃO TEXTUAL</span><strong>${list.filter(doc => doc.extractionStatus === "TEXT_EXTRACTED" || doc.extractionStatus === "JSON_EXTRACTED").length} / ${list.length}</strong><p>Arquivos sem extração textual são marcados como recebidos. O projeto não afirma que leu o conteúdo de PDFs sem OCR.</p></div>
                <div class="archive-preservation-card"><span>CÓPIA DE SEGURANÇA</span><strong>${window.DNAStorage?.getBackups?.().length || 0}</strong><p>Exportar pacote cria um arquivo JSON com os documentos, metadados, eventos e dados binários guardados localmente.</p><button class="button" data-archive-export>⇩ Baixar pacote</button></div>
                <div class="archive-warning"><b>Importante</b><p>O armazenamento do navegador pode ter limite. Guarde cópias exportadas fora deste dispositivo. Isto é um arquivo pessoal local, não um SIGAD certificado ou plenamente conforme.</p></div>`;
        } else {
            const events = window.DNAStorage?.restoreEvents?.() || [];
            content.innerHTML = `<div class="archive-view-heading"><span>TRILHA DE AÇÕES</span><h3>Auditoria local</h3><p>Eventos registrados pelo aplicativo neste navegador.</p></div><div class="archive-event-list">${events.length ? [...events].reverse().map(event => `<article><i></i><div><b>${escape(event.title || event.type || event.action || "AÇÃO")}</b><p>${escape(event.description || event.detail || "Evento registrado")}</p><time>${escape(event.timestamp ? fmtDate(event.timestamp) : event.time || "")}</time></div></article>`).join("") : `<div class="archive-empty"><b>Sem eventos registrados</b><p>As ações documentais aparecerão aqui quando ocorrerem.</p></div>`}</div>`;
        }
    }

    function quickLinks() {
        return `<div class="archive-quick-grid"><button data-archive-view="library"><b>▤</b><span>Ver documentos</span><small>Pesquisa e coleções</small></button><button data-archive-view="classification"><b>⌗</b><span>Descrever</span><small>Metadados e classificação</small></button><button data-archive-view="preservation"><b>◈</b><span>Preservar</span><small>Integridade e cópias</small></button><button data-archive-view="audit"><b>◷</b><span>Rastrear ações</span><small>Histórico local</small></button></div>`;
    }

    function renderCard(doc) {
        const meta = metadata(doc);
        const isSelected = state.selected === doc.id;
        const ext = (doc.extension || "arquivo").replace(".", "").toUpperCase();
        return `<button class="archive-document-card ${isSelected ? "is-selected" : ""}" data-archive-select="${escape(doc.id)}"><span class="archive-document-card__icon">${escape(ext.slice(0, 4))}</span><span class="archive-document-card__body"><strong>${escape(doc.name)}</strong><small>${meta.categorySuggested ? "SUGESTÃO · " : ""}${escape(meta.category || "A organizar")} · ${escape(doc.sizeFormatted || "—")}</small><em>${escape([meta.className, ...(meta.tags || []).slice(0, 3)].filter(Boolean).join(" · ") || doc.extractionStatus || "Sem tags")}</em></span><span class="archive-document-card__arrow">›</span></button>`;
    }

    function metadataForm(doc) {
        const meta = metadata(doc);
        return `<form class="archive-metadata-form" data-metadata-form="${escape(doc.id)}"><div class="archive-selected-file"><small>DOCUMENTO SELECIONADO</small><strong>${escape(doc.name)}</strong><span>ID ${escape(doc.id)} · ${escape(doc.type)} · CAPTURADO ${escape(fmtDate(doc.createdAt))}</span><button type="button" class="archive-download-button" data-archive-download="${escape(doc.id)}">⇩ Baixar arquivo original</button></div>
            <label>Coleção<select name="category">${categories.map(category => `<option ${category === (meta.category || "A organizar") ? "selected" : ""}>${escape(category)}</option>`).join("")}</select></label>
            <label>Classe temática<input name="className" list="archive-class-options" value="${escape(meta.className)}" placeholder="Classe pessoal criada a partir do documento"></label><datalist id="archive-class-options">${[...new Set(docs().map(item => metadata(item).className).filter(Boolean))].map(value => `<option value="${escape(value)}"></option>`).join("")}</datalist>
            <label>Código interno pessoal<input name="classCode" value="${escape(meta.classCode)}" placeholder="Criado automaticamente; não é código e-ARQ"></label>
            <label>Produtor / origem<input name="producer" value="${escape(meta.producer)}" placeholder="Pessoa, instituição ou origem"></label>
            <label>Data do documento<input name="createdDate" value="${escape(meta.createdDate)}" placeholder="Confirme a data manualmente">${meta.dateCandidate ? `<small class="archive-date-candidate">Data localizada no texto (confirme antes de salvar): ${escape(meta.dateCandidate)}</small>` : ""}</label>
            <label>Acesso<select name="accessLevel">${["PESSOAL", "PRIVADO", "RESTRITO", "COMPARTILHADO"].map(value => `<option ${value === (meta.accessLevel || "PESSOAL") ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label>Observação de acesso<input name="accessNote" value="${escape(meta.accessNote)}" placeholder="Quem pode acessar ou condição de uso"></label>
            <label>Regra de retenção<input name="retentionRule" value="${escape(meta.retentionRule)}" placeholder="Regra definida por você; deixe vazio se desconhecida"></label>
            <label>Destinação pretendida<input name="disposition" value="${escape(meta.disposition)}" placeholder="Ex.: manter / rever em data — decisão sua"></label>
            <label>Tags, separadas por vírgula<input name="tags" value="${escape((meta.tags || []).join(", "))}" placeholder="assuntos, pessoas, projetos"></label>
            <label>Notas<textarea name="notes" rows="3" placeholder="Contexto, relação ou observação">${escape(meta.notes)}</textarea></label>
            <div class="archive-form-note">A coleção pode ser sugerida automaticamente pelo nome/texto. Código, produtor, acesso, prazo e destinação são seus metadados.</div>
            <button class="button button--primary" type="submit">Salvar descrição</button>
            <button type="button" class="button archive-gemini-button" data-gemini-analyze="${escape(doc.id)}">✦ Realizar guarda documental via IA</button>
            ${renderAIResult(state.aiResults[doc.id] || (meta.aiAnalysis ? { status: "complete", ...meta.aiAnalysis } : null), doc.id)}
            <button type="button" class="archive-delete-button" data-archive-delete="${escape(doc.id)}">Remover este documento</button></form>`;
    }

    function renderAIResult(result, id) {
        if (!result) return "";
        if (result.status === "loading") return `<div class="archive-ai-result is-loading"><span class="archive-ai-result__pulse"></span><b>Lendo e extraindo campos do documento…</b><p>O Gemini está analisando o conteúdo completo enviado.</p></div>`;
        if (result.status === "error") return `<div class="archive-ai-result is-error"><b>ANÁLISE NÃO CONCLUÍDA</b><p>${escape(result.error)}</p><button type="button" class="button" data-action="ai-settings">Abrir configuração da API</button></div>`;
        const data = result.result || {};
        const fields = Object.entries(data).map(([key, value]) => `<section class="archive-ai-field"><span>${escape(labelFor(key))}</span>${renderAIValue(value)}</section>`).join("");
        return `<div class="archive-ai-result"><small>RELATÓRIO COMPLETO · GEMINI · REVISE CADA CAMPO</small><p class="archive-ai-result__notice">Leitura automatizada: pode omitir ou interpretar incorretamente itens. Datas, números, nomes e evidências precisam de conferência humana.</p><div class="archive-ai-result__fields">${fields}</div><div class="archive-ai-result__actions"><span class="archive-ai-result__saved">Campos preenchidos e guardados automaticamente · confira as sugestões</span><button type="button" class="button" data-gemini-report="${escape(id)}">⇩ Baixar JSON</button></div></div>`;
    }

    const aiLabels = { titulo_sugerido: "Título sugerido", tipo_documental: "Tipo documental", resumo_completo: "Resumo completo", finalidade_assunto: "Finalidade e assunto", pessoas: "Pessoas e papéis", organizacoes: "Organizações", identificadores: "Identificadores e números", datas_e_periodos: "Datas e períodos", valores_monetarios: "Valores monetários", enderecos_e_locais: "Endereços e locais", contatos: "Contatos", referencias_citadas: "Referências citadas", obrigacoes_e_prazos: "Obrigações e prazos", assinaturas_e_validacao: "Assinaturas e validação", dados_pessoais_ou_sensiveis: "Dados pessoais ou sensíveis", colecao_sugerida: "Coleção sugerida", tags_sugeridas: "Tags sugeridas", metadados_arquivisticos_a_confirmar: "Metadados a confirmar", pontos_ilegiveis_ou_incerto: "Pontos incertos ou ilegíveis", confianca_global: "Confiança global", valor: "Valor", evidencias: "Evidências no documento", confianca: "Confiança", nome: "Nome", papel: "Papel", tipo: "Tipo", contexto: "Contexto", responsavel: "Responsável", prazo_explicito: "Prazo explícito", descricao: "Descrição", observacao: "Observação", presente: "Identificado", indicado_no_documento: "Indicado no documento" };
    function labelFor(key) { return aiLabels[key] || String(key).replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase()); }
    function renderAIValue(value, depth = 0) {
        if (value === null || value === undefined || value === "") return `<span class="archive-ai-result__unknown">Não identificado no documento</span>`;
        if (typeof value === "boolean") return `<span>${value ? "Sim" : "Não"}</span>`;
        if (typeof value === "number") return `<span>${escape(value <= 1 && value >= 0 ? `${Math.round(value * 100)}%` : value)}</span>`;
        if (Array.isArray(value)) return value.length ? `<ul>${value.map(item => `<li>${renderAIValue(item, depth + 1)}</li>`).join("")}</ul>` : `<span class="archive-ai-result__unknown">Nenhum identificado</span>`;
        if (typeof value === "object") {
            if (depth > 5) return `<span class="archive-ai-result__unknown">Nível adicional omitido</span>`;
            return `<dl>${Object.entries(value).map(([key, item]) => `<div><dt>${escape(labelFor(key))}</dt><dd>${renderAIValue(item, depth + 1)}</dd></div>`).join("")}</dl>`;
        }
        return `<span>${escape(value)}</span>`;
    }

    function filterDocs(list) {
        const query = state.query.trim().toLocaleLowerCase("pt-BR");
        return list.filter(doc => {
            const meta = metadata(doc);
            const categoryMatch = state.category === "Todas" || meta.category === state.category;
            const content = [doc.name, doc.type, doc.text?.slice(0, 2500), meta.category, meta.className, meta.classCode, meta.producer, meta.createdDate, meta.notes, ...(meta.tags || [])].join(" ").toLocaleLowerCase("pt-BR");
            return categoryMatch && (!query || content.includes(query));
        }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    }

    function handleInput(event) {
        if (event.target.matches("[data-archive-search]")) { state.query = event.target.value; const cursor = event.target.selectionStart; render(); const input = document.querySelector("[data-archive-search]"); input?.focus(); input?.setSelectionRange(cursor, cursor); }
    }
    function handleChange(event) { if (event.target.matches("[data-archive-category]")) { state.category = event.target.value; render(); } }
    function handleClick(event) {
        if (event.target.closest('[data-action="inject"]')) { window.DNAUI?.openModal?.("#injection-modal"); return; }
        if (event.target.closest("[data-archive-export]")) { logEvent("PACKAGE EXPORTED", "Pacote de arquivo pessoal baixado."); window.DNAStorage?.downloadExport?.(); return; }
        const view = event.target.closest("[data-archive-view]");
        if (view) { state.view = view.dataset.archiveView; render(); return; }
        const select = event.target.closest("[data-archive-select]");
        if (select) { state.selected = select.dataset.archiveSelect; window.DNADocuments?.select?.(state.selected); render(); return; }
        const download = event.target.closest("[data-archive-download]");
        if (download) {
            const file = window.DNADocuments?.getFile?.(download.dataset.archiveDownload);
            if (!file) { alert("O conteúdo original não está disponível no armazenamento local."); return; }
            const url = URL.createObjectURL(file);
            const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            logEvent("DOCUMENT EXPORTED", file.name);
            return;
        }
        const report = event.target.closest("[data-gemini-report]");
        if (report) {
            const data = state.aiResults[report.dataset.geminiReport]?.result;
            if (!data) return;
            const blob = new Blob([JSON.stringify({ documentId: report.dataset.geminiReport, createdAt: new Date().toISOString(), model: window.DNAGemini?.getModel?.(), reviewRequired: true, analysis: data }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `dna-relatorio-${report.dataset.geminiReport}.json`; anchor.click(); URL.revokeObjectURL(url); return;
        }
        const saveReport = event.target.closest("[data-gemini-save-report]");
        if (saveReport) {
            const id = saveReport.dataset.geminiSaveReport;
            const reportData = state.aiResults[id]?.result;
            if (!reportData) return;
            const saved = window.DNADocuments?.updateMetadata?.(id, { aiAnalysis: { model: window.DNAGemini?.getModel?.(), analyzedAt: new Date().toISOString(), result: reportData } });
            if (saved) { logEvent("AI REPORT SAVED", `Relatório de leitura associado ao documento ${id}.`); alert("Relatório salvo nos metadados locais do documento."); render(); }
            else alert("Não foi possível guardar o relatório. O espaço disponível no navegador pode ter sido excedido.");
            return;
        }
        const remove = event.target.closest("[data-archive-delete]");
        if (remove && confirm("Remover este documento do arquivo local? Esta ação não pode ser desfeita sem um pacote exportado.")) { window.DNADocuments?.remove?.(remove.dataset.archiveDelete); state.selected = null; render(); }
        const verify = event.target.closest("[data-verify-integrity]");
        if (verify) {
            verify.disabled = true;
            window.DNADocuments?.verifyIntegrity?.(verify.dataset.verifyIntegrity).then(result => { state.integrityResults[verify.dataset.verifyIntegrity] = result; render(); });
        }
    }
    function handleSubmit(event) {
        const form = event.target.closest("[data-metadata-form]");
        if (!form) return;
        event.preventDefault();
        const fields = Object.fromEntries(new FormData(form).entries());
        const ok = window.DNADocuments?.updateMetadata?.(form.dataset.metadataForm, fields);
        if (ok) { state.selected = form.dataset.metadataForm; alert("Descrição salva no arquivo local."); render(); }
        else alert("Não foi possível salvar os metadados. Confira o espaço disponível no navegador.");
    }

    function logEvent(title, description) {
        const events = window.DNAStorage?.restoreEvents?.() || [];
        events.push({ time: new Date().toLocaleString("pt-BR"), timestamp: new Date().toISOString(), title, description });
        window.DNAStorage?.saveEvents?.(events.slice(-200));
    }

    document.addEventListener("submit", handleSubmit);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
    else mount();
    window.DNAArchive = { open: () => setOpen(true), render, categories };
})();
