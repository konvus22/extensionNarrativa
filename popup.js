
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

let editingId = null;

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
  const prompts = await getStorage();
  renderPromptList(prompts);
}

function renderPromptList(prompts) {
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
      let prompts = await getStorage();
      prompts = prompts.filter(x => x.id !== id);
      await setStorage(prompts);
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
    await setStorage(prompts);
    setPromptStatus("Prompt actualizado.", "ok");
    editingId = null;
  } else {
    const id = generateId();
    prompts.push({ id, title, category, content });
    await setStorage(prompts);
    setPromptStatus("Prompt guardado.", "ok");
  }
  promptTitleEl.value = "";
  promptContentEl.value = "";
  loadPrompts();
});

// ---- Feeds → unified.json ----
const HOURS_WINDOW = 48;

const feedsSources = {
  burry: {
    label: "Twitter user @michaeljburry",
    url: "https://rss.app/feeds/MrNJDVJXThMoAUi4.xml",
    type: "rss"
  },
  freeWyckoffs: {
    label: "Twitter user @FreeWyckoffs",
    url: "https://rss.app/feeds/aUjc1LFb7ALQjZgm.xml",
    type: "rss"
  },
  btcTwitter: {
    label: "Twitter BTC",
    url: "https://rss.app/feeds/7CnV2gocDQVCoUfL.xml",
    type: "rss"
  },
  twitterGeneral: {
    label: "Twitter general",
    url: "https://rss.app/feeds/QBvaHwCXMLPRP4aR.xml",
    type: "rss"
  },
  unusual_whales: {
    label: "Twitter user @unusual_whales",
    url: "https://rss.app/feeds/TdqeTz9R3qJumhZJ.xml",
    type: "rss"
  },
  mario_nawfal: {
    label: "Twitter user @MarioNawfal",
    url: "https://rss.app/feeds/MtTou8GWSuoxgTYu.xml",
    type: "rss"
  },
  amcstock_main: {
    label: "Reddit r/AMCStock",
    url: "https://www.reddit.com/r/AMCStock/new/.rss",
    type: "rss"
  },
  amcstock_alt: {
    label: "Reddit r/amcstock",
    url: "https://www.reddit.com/r/amcstock/new/.rss",
    type: "rss"
  },
  superstonk: {
    label: "Reddit r/Superstonk",
    url: "https://www.reddit.com/r/Superstonk/new/.rss",
    type: "rss"
  },
  boxoffice_top: {
    label: "Reddit r/boxoffice (top, week)",
    url: "https://www.reddit.com/r/boxoffice/top/.rss?t=week",
    type: "rss"
  },
  boxoffice_latest: {
    label: "Reddit r/boxoffice (new, últimas 48h)",
    url: "https://www.reddit.com/r/boxoffice/new/.rss",
    type: "rss"
  },
  stocktwits_amc: {
    label: "Stocktwits AMC",
    url: "https://api.stocktwits.com/api/2/streams/symbol/AMC.json",
    type: "stocktwits"
  }
};

const sourcesListEl = document.getElementById("sourcesList");
const feedsStatusEl = document.getElementById("feedsStatus");
const btnUnified = document.getElementById("downloadUnified");

function setFeedsStatus(msg, type="") {
  feedsStatusEl.textContent = msg || "";
  feedsStatusEl.className = "status " + (type || "");
}

function renderSourcesList() {
  const entries = Object.entries(feedsSources);
  sourcesListEl.innerHTML = entries.map(([key, s]) => {
    return `<div class="source-item"><strong>${s.label}</strong><br><span>${s.url}</span></div>`;
  }).join("");
}

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

async function fetchRSSAsJSON(sourceKey) {
  const s = feedsSources[sourceKey];
  const res = await fetch(s.url, {
    headers: {
      "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7"
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al leer ${s.url}`);
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
    const title = getText("title") || `${sourceKey} item`;
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
      source: sourceKey,
      title: title.slice(0, 240),
      text: desc,
      link,
      author,
      createdAt: dt ? dt.toISOString() : null
    });
  }
  return out;
}

async function fetchStocktwitsJSON() {
  const s = feedsSources["stocktwits_amc"];
  const res = await fetch(s.url, {
    headers: {
      "Accept": "application/json, */*;q=0.8"
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al leer ${s.url}`);
  }
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
      source: "stocktwits_amc",
      title,
      text,
      link,
      author: user,
      createdAt: dt ? dt.toISOString() : null
    });
  }
  return out;
}

async function collectAllSources() {
  const result = {};
  for (const key of Object.keys(feedsSources)) {
    const s = feedsSources[key];
    try {
      if (s.type === "rss") {
        result[key] = await fetchRSSAsJSON(key);
      } else if (s.type === "stocktwits") {
        result[key] = await fetchStocktwitsJSON(key);
      } else {
        result[key] = [];
      }
    } catch (err) {
      console.error("Error en fuente", key, err);
      result[key] = [{
        source: key,
        title: `[ERROR] ${s.label}`,
        text: String(err),
        link: s.url,
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

async function handleDownloadUnified() {
  setFeedsStatus("Generando unified.json...", "");
  btnUnified.disabled = true;
  try {
    const all = await collectAllSources();
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

document.addEventListener("DOMContentLoaded", () => {
  renderSourcesList();
  loadPrompts();
  btnUnified.addEventListener("click", handleDownloadUnified);
});
