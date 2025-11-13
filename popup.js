
// ---- Tabs ----
const tabs = document.querySelectorAll(".tab");
const panels = {
  prompts: document.getElementById("panel-prompts"),
  feeds: document.getElementById("panel-feeds")
};

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const id = tab.dataset.tab;
    Object.keys(panels).forEach(k => {
      panels[k].classList.toggle("active", k === id);
    });
  });
});

// ---- Prompts manager ----
const promptTitleEl = document.getElementById("promptTitle");
const promptCategoryEl = document.getElementById("promptCategory");
const promptContentEl = document.getElementById("promptContent");
const savePromptBtn = document.getElementById("savePrompt");
const promptStatusEl = document.getElementById("promptStatus");
const promptListEl = document.getElementById("promptList");
const promptFilterEl = document.getElementById("promptFilter");
const promptEditorEl = document.getElementById("promptEditor");
const togglePromptEditorBtn = document.getElementById("togglePromptEditor");
const exportPromptsBtn = document.getElementById("exportPrompts");
const importPromptsBtn = document.getElementById("importPrompts");
const importPromptsFileInput = document.getElementById("importPromptsFile");

let editingId = null;
let promptsCache = [];
let promptEditorCollapsed = true;

function setPromptStatus(msg, type = "") {
  promptStatusEl.textContent = msg || "";
  promptStatusEl.className = "status " + (type || "");
}

function generateId() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
}

function getStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get(["prompts"], (data) => {
      resolve(data.prompts || []);
    });
  });
}

function setStorage(prompts) {
  return new Promise(resolve => {
    chrome.storage.local.set({ prompts }, () => resolve());
  });
}

async function loadPrompts() {
  promptsCache = await getStorage();
  renderPromptList();
}

function setPromptEditorCollapsed(collapsed) {
  promptEditorCollapsed = collapsed;
  if (!promptEditorEl || !togglePromptEditorBtn) return;
  promptEditorEl.classList.toggle("collapsed", collapsed);
  togglePromptEditorBtn.innerHTML = collapsed
    ? "<span>▾</span><strong>Abrir</strong>"
    : "<span>▴</span><strong>Cerrar</strong>";
  togglePromptEditorBtn.setAttribute("aria-expanded", String(!collapsed));
}

function renderPromptList() {
  const filterValue = promptFilterEl ? (promptFilterEl.value || "Todas") : "Todas";
  const prompts = filterValue === "Todas"
    ? promptsCache
    : promptsCache.filter(p => (p.category || "AMC") === filterValue);
  if (!prompts.length) {
    promptListEl.innerHTML = '<div style="font-size:11px; color:#9ca3af;">Aún no hay prompts guardados.</div>';
    return;
  }
  promptListEl.innerHTML = prompts.map(p => `
    <div class="prompt-item" data-id="${p.id}">
      <div class="prompt-main">
        <div class="prompt-title">${p.title || "(sin título)"}</div>
        <div class="prompt-meta">${p.category || "Sin categoría"}</div>
        <div class="chips">
          <span class="chip">${p.category || "Sin categoría"}</span>
        </div>
      </div>
      <div class="prompt-actions">
        <button class="icon-btn edit-btn" title="Editar">✏️</button>
        <button class="icon-btn delete-btn" title="Eliminar">🗑️</button>
      </div>
    </div>
  `).join("");

  // Tarjeta completa → copia a portapapeles (excepto botones)
  promptListEl.querySelectorAll(".prompt-item").forEach(card => {
    card.addEventListener("click", async (ev) => {
      if (ev.target.closest(".icon-btn")) return;
      const id = card.dataset.id;
      const prompts = await getStorage();
      const p = prompts.find(x => x.id === id);
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

  // Editar / eliminar
  promptListEl.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = ev.currentTarget.closest(".prompt-item").dataset.id;
      const prompts = await getStorage();
      const p = prompts.find(x => x.id === id);
      if (!p) return;
      editingId = id;
      promptTitleEl.value = p.title || "";
      promptCategoryEl.value = p.category || "AMC";
      promptContentEl.value = p.content || "";
      setPromptStatus("Editando prompt...", "");
    });
  });
  promptListEl.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = ev.currentTarget.closest(".prompt-item").dataset.id;
      promptsCache = promptsCache.filter(x => x.id !== id);
      await setStorage(promptsCache);
      renderPromptList();
      setPromptStatus("Prompt eliminado.", "ok");
      if (editingId === id) {
        editingId = null;
        promptTitleEl.value = "";
        promptContentEl.value = "";
      }
    });
  });
}

savePromptBtn.addEventListener("click", async () => {
  const title = (promptTitleEl.value || "").trim();
  const category = promptCategoryEl.value || "AMC";
  const content = (promptContentEl.value || "").trim();
  if (!content) {
    setPromptStatus("El contenido del prompt no puede estar vacío.", "error");
    return;
  }
  let prompts = await getStorage();
  if (editingId) {
    prompts = prompts.map(p => p.id === editingId ? { ...p, title, category, content } : p);
    promptsCache = prompts;
    await setStorage(promptsCache);
    setPromptStatus("Prompt actualizado.", "ok");
    editingId = null;
  } else {
    const id = generateId();
    prompts.push({ id, title, category, content });
    promptsCache = prompts;
    await setStorage(promptsCache);
    setPromptStatus("Prompt guardado.", "ok");
  }
  promptTitleEl.value = "";
  promptContentEl.value = "";
  loadPrompts();
});

if (promptFilterEl) {
  promptFilterEl.addEventListener("change", renderPromptList);
}

if (togglePromptEditorBtn) {
  togglePromptEditorBtn.addEventListener("click", () => {
    setPromptEditorCollapsed(!promptEditorCollapsed);
  });
}

if (exportPromptsBtn) {
  exportPromptsBtn.addEventListener("click", async () => {
    const prompts = await getStorage();
    if (!prompts.length) {
      setPromptStatus("No hay prompts para exportar.", "error");
      return;
    }
    const payload = JSON.stringify(prompts, null, 2);
    downloadBlob("prompts-backup.json", payload);
    setPromptStatus("Prompts exportados.", "ok");
  });
}

async function handlePromptsImport(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("JSON inválido");
    let prompts = await getStorage();
    let importedCount = 0;
    for (const item of data) {
      const content = typeof item.content === "string" ? item.content.trim() : "";
      if (!content) continue;
      const title = typeof item.title === "string" ? item.title : "";
      const category = typeof item.category === "string" ? item.category : "AMC";
      let id = typeof item.id === "string" && item.id ? item.id : generateId();
      if (prompts.some(p => p.id === id)) {
        id = generateId();
      }
      prompts.push({ id, title, category, content });
      importedCount++;
    }
    if (!importedCount) throw new Error("No se encontraron prompts válidos.");
    promptsCache = prompts;
    await setStorage(promptsCache);
    renderPromptList();
    setPromptStatus(`Se importaron ${importedCount} prompts.`, "ok");
  } catch (err) {
    console.error(err);
    setPromptStatus("Error importando: " + err.message, "error");
  }
}

if (importPromptsBtn && importPromptsFileInput) {
  importPromptsBtn.addEventListener("click", () => importPromptsFileInput.click());
  importPromptsFileInput.addEventListener("change", async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    await handlePromptsImport(file);
    importPromptsFileInput.value = "";
  });
}

// ---- Feeds → unified.json ----
const HOURS_WINDOW = 48;
const defaultFeeds = [
  { id: "burry", label: "Twitter user @michaeljburry", url: "https://rss.app/feeds/MrNJDVJXThMoAUi4.xml", type: "rss" },
  { id: "freeWyckoffs", label: "Twitter user @FreeWyckoffs", url: "https://rss.app/feeds/aUjc1LFb7ALQjZgm.xml", type: "rss" },
  { id: "btcTwitter", label: "Twitter BTC", url: "https://rss.app/feeds/7CnV2gocDQVCoUfL.xml", type: "rss" },
  { id: "twitterGeneral", label: "Twitter general", url: "https://rss.app/feeds/QBvaHwCXMLPRP4aR.xml", type: "rss" },
  { id: "unusual_whales", label: "Twitter user @unusual_whales", url: "https://rss.app/feeds/TdqeTz9R3qJumhZJ.xml", type: "rss" },
  { id: "mario_nawfal", label: "Twitter user @MarioNawfal", url: "https://rss.app/feeds/MtTou8GWSuoxgTYu.xml", type: "rss" },
  { id: "amcstock_main", label: "Reddit r/AMCStock", url: "https://www.reddit.com/r/AMCStock/new/.rss", type: "rss" },
  { id: "amcstock_alt", label: "Reddit r/amcstock", url: "https://www.reddit.com/r/amcstock/new/.rss", type: "rss" },
  { id: "superstonk", label: "Reddit r/Superstonk", url: "https://www.reddit.com/r/Superstonk/new/.rss", type: "rss" },
  { id: "boxoffice_top", label: "Reddit r/boxoffice (top, week)", url: "https://www.reddit.com/r/boxoffice/top/.rss?t=week", type: "rss" },
  { id: "boxoffice_latest", label: "Reddit r/boxoffice (new, últimas 48h)", url: "https://www.reddit.com/r/boxoffice/new/.rss", type: "rss" },
  { id: "stocktwits_amc", label: "Stocktwits AMC", url: "https://api.stocktwits.com/api/2/streams/symbol/AMC.json", type: "stocktwits" }
];

const FEEDS_STORAGE_KEY = "feedsSources";

const feedLabelEl = document.getElementById("feedLabel");
const feedUrlEl = document.getElementById("feedUrl");
const feedTypeEl = document.getElementById("feedType");
const saveFeedBtn = document.getElementById("saveFeed");
const feedFormStatusEl = document.getElementById("feedFormStatus");
const feedListEl = document.getElementById("feedList");
const feedsStatusEl = document.getElementById("feedsStatus");
const btnUnified = document.getElementById("downloadUnified");
const githubRepoEl = document.getElementById("githubRepo");
const githubBranchEl = document.getElementById("githubBranch");
const githubPathEl = document.getElementById("githubPath");
const githubTokenEl = document.getElementById("githubToken");
const githubStatusEl = document.getElementById("githubStatus");
const saveGithubBtn = document.getElementById("saveGithubSettings");
const uploadGithubBtn = document.getElementById("uploadGithub");

let feedsCache = [];
let editingFeedId = null;
const GITHUB_SETTINGS_KEY = "githubSettings";

function setFeedsStatus(msg, type="") {
  feedsStatusEl.textContent = msg || "";
  feedsStatusEl.className = "status " + (type || "");
}

function setFeedFormStatus(msg, type="") {
  feedFormStatusEl.textContent = msg || "";
  feedFormStatusEl.className = "status " + (type || "");
}

function generateFeedId() {
  return "feed_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
}

function getFeedsStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get([FEEDS_STORAGE_KEY], data => {
      resolve(data[FEEDS_STORAGE_KEY] || []);
    });
  });
}

function setFeedsStorage(feeds) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [FEEDS_STORAGE_KEY]: feeds }, () => resolve());
  });
}

async function loadFeeds() {
  let feeds = await getFeedsStorage();
  if (!feeds.length) {
    feeds = defaultFeeds.map(f => ({ ...f }));
    await setFeedsStorage(feeds);
  }
  feedsCache = feeds;
  renderFeedList();
}

function renderFeedList() {
  if (!feedsCache.length) {
    feedListEl.innerHTML = '<div class="feed-empty">No hay fuentes configuradas.</div>';
    return;
  }
  feedListEl.innerHTML = feedsCache.map(feed => `
    <div class="feed-item" data-id="${feed.id}">
      <div class="feed-info">
        <div class="feed-title">${feed.label || "(sin nombre)"}</div>
        <div class="feed-url" title="${feed.url}">${feed.url}</div>
        <div class="feed-meta">Tipo: ${feed.type === "stocktwits" ? "Stocktwits" : "RSS"}</div>
      </div>
      <div class="feed-actions">
        <button class="icon-btn edit-feed" title="Editar">✏️</button>
        <button class="icon-btn delete-feed" title="Eliminar">🗑️</button>
      </div>
    </div>
  `).join("");

  feedListEl.querySelectorAll(".edit-feed").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = ev.currentTarget.closest(".feed-item").dataset.id;
      startFeedEdit(id);
    });
  });

  feedListEl.querySelectorAll(".delete-feed").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = ev.currentTarget.closest(".feed-item").dataset.id;
      feedsCache = feedsCache.filter(feed => feed.id !== id);
      await setFeedsStorage(feedsCache);
      renderFeedList();
      if (editingFeedId === id) {
        resetFeedForm();
      }
      setFeedFormStatus("Fuente eliminada.", "ok");
    });
  });
}

function startFeedEdit(id) {
  const feed = feedsCache.find(f => f.id === id);
  if (!feed) return;
  editingFeedId = id;
  feedLabelEl.value = feed.label || "";
  feedUrlEl.value = feed.url || "";
  feedTypeEl.value = feed.type || "rss";
  setFeedFormStatus("Editando fuente...", "");
}

function resetFeedForm() {
  editingFeedId = null;
  feedLabelEl.value = "";
  feedUrlEl.value = "";
  feedTypeEl.value = "rss";
}

saveFeedBtn.addEventListener("click", async () => {
  const label = (feedLabelEl.value || "").trim();
  const url = (feedUrlEl.value || "").trim();
  const type = feedTypeEl.value || "rss";

  if (!label || !url) {
    setFeedFormStatus("Nombre y URL son obligatorios.", "error");
    return;
  }
  try {
    new URL(url);
  } catch (err) {
    setFeedFormStatus("La URL no es válida.", "error");
    return;
  }

  if (editingFeedId) {
    feedsCache = feedsCache.map(feed => feed.id === editingFeedId ? { ...feed, label, url, type } : feed);
    await setFeedsStorage(feedsCache);
    setFeedFormStatus("Fuente actualizada.", "ok");
    resetFeedForm();
  } else {
    feedsCache = [...feedsCache, { id: generateFeedId(), label, url, type }];
    await setFeedsStorage(feedsCache);
    setFeedFormStatus("Fuente guardada.", "ok");
    resetFeedForm();
  }
  renderFeedList();
});

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

async function fetchRSSAsJSON(source) {
  const res = await fetch(source.url, {
    headers: {
      "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7"
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al leer ${source.url}`);
  }
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");
  const items = Array.from(xml.querySelectorAll("item, entry"));
  const out = [];

  for (const item of items) {
    const getText = (selector) => {
      const el = item.querySelector(selector);
      return el ? el.textContent.trim() : "";
    };
    let dtStr = getText("pubDate") || getText("published") || getText("updated") || getText("date");
    let dt = parseDateFallback(dtStr);
    if (!dt) {
      const title = getText("title");
      if (!title) continue;
    }
    if (!withinWindow(dt || new Date())) {
      continue;
    }
    const title = getText("title") || `${source.id} item`;
    const desc = getText("description") || getText("summary") || "";
    const linkEl = item.querySelector("link");
    let link = "";
    if (linkEl) {
      link = linkEl.getAttribute("href") || linkEl.textContent.trim();
    }
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
      source: source.id,
      title: title.slice(0, 240),
      text: desc,
      link,
      author,
      createdAt: dt ? dt.toISOString() : null
    });
  }
  return out;
}

async function fetchStocktwitsJSON(source) {
  const res = await fetch(source.url, {
    headers: {
      "Accept": "application/json, */*;q=0.8"
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al leer ${source.url}`);
  }
  const data = await res.json();
  const msgs = Array.isArray(data.messages) ? data.messages : [];
  const out = [];
  for (const m of msgs) {
    const createdStr = m.created_at;
    const dt = parseDateFallback(createdStr);
    if (!withinWindow(dt || new Date())) continue;
    const title = `${source.label || "Stocktwits"} #${m.id}`;
    const text = (m.body || "").trim();
    const link = m.url || "";
    const user = m.user && m.user.username ? m.user.username : "";
    out.push({
      source: source.id,
      title,
      text,
      link,
      author: user,
      createdAt: dt ? dt.toISOString() : null
    });
  }
  return out;
}

async function collectAllSources(feeds) {
  const result = {};
  for (const feed of feeds) {
    try {
      if (feed.type === "rss") {
        result[feed.id] = await fetchRSSAsJSON(feed);
      } else if (feed.type === "stocktwits") {
        result[feed.id] = await fetchStocktwitsJSON(feed);
      } else {
        result[feed.id] = [];
      }
    } catch (err) {
      console.error("Error en fuente", feed.id, err);
      result[feed.id] = [{
        source: feed.id,
        title: `[ERROR] ${feed.label}`,
        text: String(err && err.message ? err.message : err),
        link: feed.url,
        author: "",
        createdAt: new Date().toISOString()
      }];
    }
  }
  return result;
}

function downloadBlob(filename, dataStr) {
  const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setGithubStatus(msg, type = "") {
  if (!githubStatusEl) return;
  githubStatusEl.textContent = msg || "";
  githubStatusEl.className = "status " + (type || "");
}

function sanitizeGithubSettings(raw = {}) {
  return {
    repo: (raw.repo || "").trim(),
    branch: (raw.branch || "main").trim() || "main",
    path: (raw.path || "unified.json").trim() || "unified.json",
    token: (raw.token || "").trim()
  };
}

function applyGithubSettings(settings) {
  if (!settings) return;
  const safe = sanitizeGithubSettings(settings);
  if (githubRepoEl) githubRepoEl.value = safe.repo;
  if (githubBranchEl) githubBranchEl.value = safe.branch;
  if (githubPathEl) githubPathEl.value = safe.path;
  if (githubTokenEl) githubTokenEl.value = safe.token;
}

function readGithubForm() {
  return sanitizeGithubSettings({
    repo: githubRepoEl ? githubRepoEl.value : "",
    branch: githubBranchEl ? githubBranchEl.value : "",
    path: githubPathEl ? githubPathEl.value : "",
    token: githubTokenEl ? githubTokenEl.value : ""
  });
}

function getGithubSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get([GITHUB_SETTINGS_KEY], data => {
      resolve(sanitizeGithubSettings(data[GITHUB_SETTINGS_KEY] || {}));
    });
  });
}

function setGithubSettings(settings) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [GITHUB_SETTINGS_KEY]: sanitizeGithubSettings(settings) }, () => resolve());
  });
}

async function handleSaveGithubSettings() {
  const payload = readGithubForm();
  await setGithubSettings(payload);
  setGithubStatus("Datos guardados.", "ok");
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function uploadUnifiedToGithub() {
  if (!uploadGithubBtn) return;
  const settings = readGithubForm();
  if (!settings.repo || !settings.repo.includes("/")) {
    setGithubStatus("Repo inválido. Usa owner/repo.", "error");
    return;
  }
  if (!settings.token) {
    setGithubStatus("Necesitas un token personal.", "error");
    return;
  }
  setGithubStatus("Generando y subiendo unified.json...", "");
  uploadGithubBtn.disabled = true;
  try {
    const feeds = await getFeedsStorage();
    if (!feeds.length) {
      throw new Error("Configura al menos una fuente.");
    }
    const all = await collectAllSources(feeds);
    const unified = {
      generatedAt: new Date().toISOString(),
      sources: all
    };
    const payload = JSON.stringify(unified, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(payload)));
    const [owner, repo] = settings.repo.split("/");
    const pathEncoded = encodePath(settings.path);
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${pathEncoded}`;
    const headers = {
      "Authorization": `Bearer ${settings.token}`,
      "Accept": "application/vnd.github+json"
    };
    let sha = null;
    const checkRes = await fetch(`${baseUrl}?ref=${encodeURIComponent(settings.branch)}`, { headers });
    if (checkRes.status === 200) {
      const data = await checkRes.json();
      sha = data.sha;
    } else if (checkRes.status !== 404) {
      const text = await checkRes.text();
      throw new Error(`GitHub respondió ${checkRes.status}: ${text}`);
    }
    const body = {
      message: `chore: update unified.json (${new Date().toISOString()})`,
      content: base64,
      branch: settings.branch,
      committer: { name: "Prompts Extension", email: "bot@local" }
    };
    if (sha) body.sha = sha;
    const putRes = await fetch(baseUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(`GitHub respondió ${putRes.status}: ${text}`);
    }
    setGithubStatus("unified.json subido a GitHub.", "ok");
  } catch (err) {
    console.error(err);
    setGithubStatus("Error subiendo: " + err.message, "error");
  } finally {
    uploadGithubBtn.disabled = false;
  }
}

async function handleDownloadUnified() {
  setFeedsStatus("Generando unified.json...", "");
  btnUnified.disabled = true;
  try {
    const feeds = await getFeedsStorage();
    if (!feeds.length) {
      setFeedsStatus("No hay fuentes configuradas.", "error");
      return;
    }
    const all = await collectAllSources(feeds);
    const unified = {
      generatedAt: new Date().toISOString(),
      sources: all
    };
    const payload = JSON.stringify(unified, null, 2);
    downloadBlob("unified.json", payload);
    setFeedsStatus("unified.json descargado.", "ok");
  } catch (err) {
    console.error(err);
    setFeedsStatus("Error generando unified.json.", "error");
  } finally {
    btnUnified.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setPromptEditorCollapsed(true);
  loadFeeds();
  loadPrompts();
  if (btnUnified) {
    btnUnified.addEventListener("click", handleDownloadUnified);
  }
  if (saveGithubBtn) {
    saveGithubBtn.addEventListener("click", handleSaveGithubSettings);
  }
  if (uploadGithubBtn) {
    uploadGithubBtn.addEventListener("click", uploadUnifiedToGithub);
  }
  if (githubRepoEl) {
    const ghSettings = await getGithubSettings();
    applyGithubSettings(ghSettings);
  }
});
