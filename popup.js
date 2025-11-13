// =========================
// TABS
// =========================
const tabs = document.querySelectorAll(".tab");
const panels = {
  prompts: document.getElementById("panel-prompts"),
  feeds: document.getElementById("panel-feeds"),
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const id = tab.dataset.tab;
    Object.keys(panels).forEach((k) => {
      panels[k].classList.toggle("active", k === id);
    });
  });
});

// =========================
// EDITOR PLEGABLE PROMPTS
// =========================
const promptEditorEl = document.getElementById("promptEditor");
if (promptEditorEl) {
  const header = promptEditorEl.querySelector(".prompt-editor-header");
  header.addEventListener("click", () => {
    promptEditorEl.classList.toggle("collapsed");
  });
}

// =========================
// PROMPTS (CRUD + EXPORT/IMPORT + FILTRO)
// =========================
const promptTitleEl = document.getElementById("promptTitle");
const promptCategoryEl = document.getElementById("promptCategory");
const promptContentEl = document.getElementById("promptContent");
const savePromptBtn = document.getElementById("savePrompt");
const promptStatusEl = document.getElementById("promptStatus");
const promptListEl = document.getElementById("promptList");
const exportBtn = document.getElementById("exportPrompts");
const importBtn = document.getElementById("importPrompts");
const importFileEl = document.getElementById("importFile");

let editingId = null;
let currentFilter = "Todas";

function setPromptStatus(msg, type = "") {
  if (!promptStatusEl) return;
  promptStatusEl.textContent = msg || "";
  promptStatusEl.className = "status " + (type || "");
}

function generatePromptId() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
}

function getPromptsStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["prompts"], (data) => {
      resolve(data.prompts || []);
    });
  });
}

function setPromptsStorage(prompts) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ prompts }, () => resolve());
  });
}

async function loadPrompts() {
  const prompts = await getPromptsStorage();
  renderPromptList(prompts);
}

function renderPromptList(prompts) {
  if (!promptListEl) return;

  // aplicar filtro
  const filtered = prompts.filter((p) => {
    if (!currentFilter || currentFilter === "Todas") return true;
    return (p.category || "Otros") === currentFilter;
  });

  if (!filtered.length) {
    promptListEl.innerHTML =
      '<div style="font-size:11px; color:#9ca3af;">No hay prompts para este filtro.</div>';
    return;
  }

  promptListEl.innerHTML = filtered
    .map(
      (p) => `
    <div class="prompt-item" data-id="${p.id}">
      <div class="prompt-main">
        <div class="prompt-title">${p.title || "(sin título)"}</div>
        <div class="prompt-meta">${p.category || "Sin categoría"}</div>
        <div class="chips">
          <span class="chip">${p.category || "Sin categoría"}</span>
        </div>
      </div>
      <div class="prompt-actions">
        <button class="icon-btn edit-btn"   title="Editar">✏️</button>
        <button class="icon-btn delete-btn" title="Eliminar">🗑️</button>
      </div>
    </div>`
    )
    .join("");

  // Copy al click en tarjeta
  promptListEl.querySelectorAll(".prompt-item").forEach((card) => {
    card.addEventListener("click", async (ev) => {
      if (ev.target.closest(".icon-btn")) return; // no copiar si es botón
      const id = card.dataset.id;
      const prompts = await getPromptsStorage();
      const p = prompts.find((x) => x.id === id);
      if (!p) return;
      try {
        await navigator.clipboard.writeText(p.content || "");
        setPromptStatus("Prompt copiado al portapapeles.", "ok");
      } catch (err) {
        console.error(err);
        setPromptStatus("No se pudo copiar.", "error");
      }
    });
  });

  // Editar
  promptListEl.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = ev.currentTarget.closest(".prompt-item").dataset.id;
      const prompts = await getPromptsStorage();
      const p = prompts.find((x) => x.id === id);
      if (!p) return;
      editingId = id;
      promptTitleEl.value = p.title || "";
      promptCategoryEl.value = p.category || "AMC";
      promptContentEl.value = p.content || "";
      setPromptStatus("Editando prompt...", "");
      promptEditorEl.classList.remove("collapsed");
    });
  });

  // Eliminar
  promptListEl.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = ev.currentTarget.closest(".prompt-item").dataset.id;
      let prompts = await getPromptsStorage();
      prompts = prompts.filter((x) => x.id !== id);
      await setPromptsStorage(prompts);
      renderPromptList(prompts);
      setPromptStatus("Prompt eliminado.", "ok");
      if (editingId === id) {
        editingId = null;
        promptTitleEl.value = "";
        promptContentEl.value = "";
      }
    });
  });
}

// Guardar prompt
if (savePromptBtn) {
  savePromptBtn.addEventListener("click", async () => {
    const title = (promptTitleEl.value || "").trim();
    const category = promptCategoryEl.value || "Otros";
    const content = (promptContentEl.value || "").trim();
    if (!content) {
      setPromptStatus("El contenido del prompt no puede estar vacío.", "error");
      return;
    }
    let prompts = await getPromptsStorage();
    if (editingId) {
      prompts = prompts.map((p) =>
        p.id === editingId ? { ...p, title, category, content } : p
      );
      await setPromptsStorage(prompts);
      setPromptStatus("Prompt actualizado.", "ok");
      editingId = null;
    } else {
      const id = generatePromptId();
      prompts.push({ id, title, category, content });
      await setPromptsStorage(prompts);
      setPromptStatus("Prompt guardado.", "ok");
    }
    promptTitleEl.value = "";
    promptContentEl.value = "";
    loadPrompts();
  });
}

// Exportar prompts
if (exportBtn) {
  exportBtn.addEventListener("click", async () => {
    const prompts = await getPromptsStorage();
    const blob = new Blob([JSON.stringify(prompts, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompts-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPromptStatus("Prompts exportados.", "ok");
  });
}

// Importar prompts
if (importBtn && importFileEl) {
  importBtn.addEventListener("click", () => importFileEl.click());
  importFileEl.addEventListener("change", async () => {
    const file = importFileEl.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Formato no válido");
      await setPromptsStorage(data);
      await loadPrompts();
      setPromptStatus("Prompts importados (sobrescribiendo los anteriores).", "ok");
    } catch (err) {
      console.error(err);
      setPromptStatus("Error al importar prompts.", "error");
    } finally {
      importFileEl.value = "";
    }
  });
}

// Filtros por categoría
const filterChips = document.querySelectorAll(".filter-chip");
if (filterChips && filterChips.length) {
  filterChips.forEach((chip) => {
    chip.addEventListener("click", async () => {
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter || "Todas";
      const prompts = await getPromptsStorage();
      renderPromptList(prompts);
    });
  });
}

// =========================
// FEEDS CONFIGURABLES
// =========================

// Feeds por defecto (los que has definido)
const DEFAULT_FEEDS = [
  {
    id: "burry",
    label: "Twitter user @michaeljburry",
    url: "https://rss.app/feeds/MrNJDVJXThMoAUi4.xml",
    type: "rss",
    enabled: true,
  },
  {
    id: "freeWyckoffs",
    label: "Twitter user @FreeWyckoffs",
    url: "https://rss.app/feeds/aUjc1LFb7ALQjZgm.xml",
    type: "rss",
    enabled: true,
  },
  {
    id: "btcTwitter",
    label: "Twitter BTC",
    url: "https://rss.app/feeds/7CnV2gocDQVCoUfL.xml",
    type: "rss",
    enabled: true,
  },
  {
    id: "twitterGeneral",
    label: "Twitter general",
    url: "https://rss.app/feeds/QBvaHwCXMLPRP4aR.xml",
    type: "rss",
    enabled: true,
  },
  {
    id: "unusual_whales",
    label: "Twitter user @unusual_whales",
    url: "https://rss.app/feeds/TdqeTz9R3qJumhZJ.xml",
    type: "rss",
    enabled: true,
  },
  {
    id: "mario_nawfal",
    label: "Twitter user @MarioNawfal",
    url: "https://rss.app/feeds/MtTou8GWSuoxgTYu.xml",
    type: "rss",
    enabled: true,
  },
  {
    id: "amcstock_main",
    label: "Reddit r/AMCStock",
    url: "https://www.reddit.com/r/AMCStock/new/.rss",
    type: "rss",
    enabled: true,
  },
  {
    id: "amcstock_alt",
    label: "Reddit r/amcstock",
    url: "https://www.reddit.com/r/amcstock/new/.rss",
    type: "rss",
    enabled: true,
  },
  {
    id: "superstonk",
    label: "Reddit r/Superstonk",
    url: "https://www.reddit.com/r/Superstonk/new/.rss",
    type: "rss",
    enabled: true,
  },
  {
    id: "boxoffice_top",
    label: "Reddit r/boxoffice (top, week)",
    url: "https://www.reddit.com/r/boxoffice/top/.rss?t=week",
    type: "rss",
    enabled: true,
  },
  {
    id: "boxoffice_latest",
    label: "Reddit r/boxoffice (new, últimas 48h)",
    url: "https://www.reddit.com/r/boxoffice/new/.rss",
    type: "rss",
    enabled: true,
  },
  {
    id: "stocktwits_amc",
    label: "Stocktwits AMC",
    url: "https://api.stocktwits.com/api/2/streams/symbol/AMC.json",
    type: "stocktwits",
    enabled: true,
  },
];

function getFeeds() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["feedsConfig"], (data) => {
      if (!data.feedsConfig || !Array.isArray(data.feedsConfig)) {
        resolve(DEFAULT_FEEDS);
      } else {
        resolve(data.feedsConfig);
      }
    });
  });
}

function setFeeds(feeds) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ feedsConfig: feeds }, () => resolve());
  });
}

const sourcesListEl = document.getElementById("sourcesList");
const feedsEditorEl = document.getElementById("feedsEditor");
const addFeedBtn = document.getElementById("addFeed");
const saveFeedsBtn = document.getElementById("saveFeeds");
const feedsConfigStatusEl = document.getElementById("feedsConfigStatus");
const feedsStatusEl = document.getElementById("feedsStatus");
const btnUnified = document.getElementById("downloadUnified");

function setFeedsConfigStatus(msg, type = "") {
  if (!feedsConfigStatusEl) return;
  feedsConfigStatusEl.textContent = msg || "";
  feedsConfigStatusEl.className = "status " + (type || "");
}

function setFeedsStatus(msg, type = "") {
  if (!feedsStatusEl) return;
  feedsStatusEl.textContent = msg || "";
  feedsStatusEl.className = "status " + (type || "");
}

let currentFeeds = [];

function renderSourcesList() {
  if (!sourcesListEl) return;
  const enabled = currentFeeds.filter((f) => f.enabled !== false);
  sourcesListEl.innerHTML = enabled
    .map(
      (f) =>
        `<div class="source-item"><strong>${f.label}</strong><br><span>${f.url}</span></div>`
    )
    .join("");
}

function renderFeedsEditor() {
  if (!feedsEditorEl) return;
  feedsEditorEl.innerHTML = currentFeeds
    .map(
      (f, idx) => `
      <div class="feeds-editor-row" data-index="${idx}">
        <input class="feed-label" value="${f.label}" placeholder="Nombre descriptivo" />
        <input class="feed-url" value="${f.url}" placeholder="URL" />
      </div>
      <div class="feeds-editor-row" data-index="${idx}">
        <select class="feed-type">
          <option value="rss" ${f.type === "rss" ? "selected" : ""}>RSS</option>
          <option value="stocktwits" ${f.type === "stocktwits" ? "selected" : ""}>Stocktwits</option>
        </select>
        <button class="btn-outline-small feed-delete">Eliminar</button>
      </div>
    `
    )
    .join("");

  feedsEditorEl.querySelectorAll(".feed-delete").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const idx = Number(
        ev.currentTarget.closest(".feeds-editor-row").dataset.index
      );
      currentFeeds.splice(idx, 1);
      renderFeedsEditor();
      renderSourcesList();
    });
  });
}

async function initFeedsEditor() {
  currentFeeds = await getFeeds();
  renderSourcesList();
  renderFeedsEditor();
}

if (addFeedBtn) {
  addFeedBtn.addEventListener("click", () => {
    currentFeeds.push({
      id: "feed_" + Date.now(),
      label: "Nuevo feed",
      url: "",
      type: "rss",
      enabled: true,
    });
    renderFeedsEditor();
  });
}

if (saveFeedsBtn) {
  saveFeedsBtn.addEventListener("click", async () => {
    const rows = feedsEditorEl.querySelectorAll(".feeds-editor-row");
    const updated = [];
    const maxIdx = currentFeeds.length - 1;

    for (let i = 0; i <= maxIdx; i++) {
      const rowLabelUrl = feedsEditorEl.querySelector(
        `.feeds-editor-row[data-index="${i}"] .feed-label`
      );
      const rowUrl = feedsEditorEl.querySelector(
        `.feeds-editor-row[data-index="${i}"] .feed-url`
      );
      const rowType = feedsEditorEl.querySelector(
        `.feeds-editor-row[data-index="${i}"] .feed-type`
      );
      if (!rowLabelUrl || !rowUrl || !rowType) continue;
      const base = currentFeeds[i] || { id: "feed_" + Date.now() };
      updated.push({
        ...base,
        label: rowLabelUrl.value.trim() || base.label || "Feed",
        url: rowUrl.value.trim(),
        type: rowType.value || "rss",
        enabled: true,
      });
    }

    currentFeeds = updated;
    await setFeeds(currentFeeds);
    setFeedsConfigStatus("Feeds guardados.", "ok");
    renderSourcesList();
  });
}

// =========================
// FETCH PARA UNIFIED.JSON
// =========================

function parseDateFallback(str) {
  if (!str) return null;
  const t = Date.parse(str);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}
function withinWindow(date) {
  if (!date) return false;
  const cutoff = Date.now() - HOURS_WINDOW * 3600 * 1000;
  return date.getTime() >= cutoff;
}

async function fetchRSSAsJSON(feed) {
  const res = await fetch(feed.url, {
    headers: {
      Accept:
        "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer ${feed.url}`);
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");
  const items = Array.from(xml.querySelectorAll("item, entry"));
  const out = [];

  for (const item of items) {
    const getText = (sel) => {
      const el = item.querySelector(sel);
      return el ? el.textContent.trim() : "";
    };
    let dtStr =
      getText("pubDate") ||
      getText("published") ||
      getText("updated") ||
      getText("date");
    let dt = parseDateFallback(dtStr);
    if (!dt) {
      const title = getText("title");
      if (!title) continue;
    }
    if (!withinWindow(dt || new Date())) continue;

    const title = getText("title") || `${feed.id} item`;
    const desc = getText("description") || getText("summary") || "";
    const linkEl = item.querySelector("link");
    let link = "";
    if (linkEl) link = linkEl.getAttribute("href") || linkEl.textContent.trim();
    let author = "";
    const authorEl = item.querySelector("author");
    if (authorEl) {
      author = authorEl.textContent.trim();
    } else {
      const dcCreators = item.getElementsByTagName("dc:creator");
      if (dcCreators && dcCreators.length > 0) {
        author = dcCreators[0].textContent.trim();
      }
    }
    out.push({
      source: feed.id,
      title: title.slice(0, 240),
      text: desc,
      link,
      author,
      createdAt: dt ? dt.toISOString() : null,
    });
  }
  return out;
}

async function fetchStocktwitsJSON(feed) {
  const res = await fetch(feed.url, {
    headers: { Accept: "application/json, */*;q=0.8" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer ${feed.url}`);
  const data = await res.json();
  const msgs = Array.isArray(data.messages) ? data.messages : [];
  const out = [];
  for (const m of msgs) {
    const createdStr = m.created_at;
    const dt = parseDateFallback(createdStr);
    if (!withinWindow(dt || new Date())) continue;
    const title = `Stocktwits #${m.id}`;
    const text = (m.body || "").trim();
    const link = m.url || "";
    const user = m.user && m.user.username ? m.user.username : "";
    out.push({
      source: feed.id,
      title,
      text,
      link,
      author: user,
      createdAt: dt ? dt.toISOString() : null,
    });
  }
  return out;
}

async function collectAllSources() {
  const feeds = currentFeeds.length ? currentFeeds : await getFeeds();
  const enabled = feeds.filter((f) => f.enabled !== false);
  const result = {};

  for (const feed of enabled) {
    try {
      if (feed.type === "rss") {
        result[feed.id] = await fetchRSSAsJSON(feed);
      } else if (feed.type === "stocktwits") {
        result[feed.id] = await fetchStocktwitsJSON(feed);
      } else {
        result[feed.id] = [];
      }
    } catch (err) {
      console.error("Error en feed", feed.id, err);
      result[feed.id] = [
        {
          source: feed.id,
          title: `[ERROR] ${feed.label}`,
          text: String(err),
          link: feed.url,
          author: "",
          createdAt: new Date().toISOString(),
        },
      ];
    }
  }
  return result;
}

if (btnUnified) {
  btnUnified.addEventListener("click", async () => {
    setFeedsStatus("Generando unified.json...", "");
    btnUnified.disabled = true;
    try {
      const all = await collectAllSources();
      const unified = {
        generatedAt: new Date().toISOString(),
        sources: all,
      };
      const blob = new Blob([JSON.stringify(unified, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "unified.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedsStatus("unified.json descargado.", "ok");
    } catch (err) {
      console.error(err);
      setFeedsStatus("Error generando unified.json.", "error");
    } finally {
      btnUnified.disabled = false;
    }
  });
}

// =========================
// GitHub config y subida
// =========================

function getGithubConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["githubConfig"], (data) => {
      resolve(data.githubConfig || {});
    });
  });
}
function setGithubConfig(cfg) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ githubConfig: cfg }, () => resolve());
  });
}

const ghOwnerEl = document.getElementById("ghOwner");
const ghRepoEl = document.getElementById("ghRepo");
const ghBranchEl = document.getElementById("ghBranch");
const ghPathEl = document.getElementById("ghPathBase");
const ghTokenEl = document.getElementById("ghToken");
const ghSaveBtn = document.getElementById("saveGithub");
const ghUploadBtn = document.getElementById("uploadGithub");
const ghStatusEl = document.getElementById("githubStatus");

function setGithubStatus(msg, type = "") {
  if (!ghStatusEl) return;
  ghStatusEl.textContent = msg || "";
  ghStatusEl.className = "status " + (type || "");
}

async function loadGithubUI() {
  const cfg = await getGithubConfig();
  if (ghOwnerEl) ghOwnerEl.value = cfg.owner || "";
  if (ghRepoEl) ghRepoEl.value = cfg.repo || "feeds-narrativa";
  if (ghBranchEl) ghBranchEl.value = cfg.branch || "main";
  if (ghPathEl) ghPathEl.value = cfg.pathBase || "data/unified";
  if (ghTokenEl) ghTokenEl.value = cfg.token || "";
}

if (ghSaveBtn) {
  ghSaveBtn.addEventListener("click", async () => {
    const cfg = {
      owner: ghOwnerEl.value.trim(),
      repo: ghRepoEl.value.trim(),
      branch: (ghBranchEl.value.trim() || "main"),
      pathBase: (ghPathEl.value.trim() || "data/unified"),
      token: ghTokenEl.value.trim(),
    };
    await setGithubConfig(cfg);
    setGithubStatus("Config GitHub guardada (solo en este navegador).", "ok");
  });
}

async function uploadUnifiedToGithub(unified) {
  const cfg = await getGithubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token || !cfg.pathBase) {
    throw new Error("Config incompleta (owner, repo, token o carpeta).");
  }
  const branch = cfg.branch || "main";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `unified-${ts}.json`;
  const path = `${cfg.pathBase.replace(/\\/+$/,"")}/${name}`;
  const content = JSON.stringify(unified, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(content)));
  const body = JSON.stringify({ message: `Add ${name}`, content: base64, branch });
  const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${cfg.token}`,
    },
    body,
  });
  if (!res.ok) {
    let errMsg = `GitHub ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.message) errMsg += `: ${j.message}`;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

if (ghUploadBtn) {
  ghUploadBtn.addEventListener("click", async () => {
    setGithubStatus("Creando unified.json y subiendo a GitHub...", "");
    ghUploadBtn.disabled = true;
    try {
      const all = await collectAllSources();
      const unified = {
        generatedAt: new Date().toISOString(),
        sources: all,
      };
      await uploadUnifiedToGithub(unified);
      setGithubStatus("Subido a GitHub correctamente en data/unified/...", "ok");
    } catch (err) {
      console.error(err);
      setGithubStatus(String(err), "error");
    } finally {
      ghUploadBtn.disabled = false;
    }
  });
}

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", () => {
  // En este caso ya estamos al final del body, pero por si acaso:
  initFeedsEditor();
  loadPrompts();
  loadGithubUI();
});
