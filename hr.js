const HR_API = "https://script.google.com/macros/s/AKfycbxbaop9HbasKeMj1d9CqG9jjTqJRq68Gv3f-8zaVobcbv6pDW3LRu4IJpFezpO2nFRi/exec";

const participants = Array.isArray(window.HR_PARTICIPANTS) ? window.HR_PARTICIPANTS : [];
const trainingCatalog = Array.isArray(window.TRAINING_CATALOG) ? window.TRAINING_CATALOG : [];
const catalogByTitle = buildCatalogIndex(trainingCatalog);

const searchEl = document.getElementById("hr-search");
const categoryEl = document.getElementById("filter-category");
const sectionEl = document.getElementById("filter-section");
const levelEl = document.getElementById("filter-level");
const basicEl = document.getElementById("filter-basic");
const resetEl = document.getElementById("reset-filter");
const exportEl = document.getElementById("export-button");
const bodyEl = document.getElementById("monitor-body");
const emptyEl = document.getElementById("monitor-empty");
const resultCountEl = document.getElementById("result-count");

const summaryTotalEl = document.getElementById("summary-total");
const summaryTotalNoteEl = document.getElementById("summary-total-note");
const summarySectionsEl = document.getElementById("summary-sections");
const summaryBasic1El = document.getElementById("summary-basic1");
const summaryBasic23El = document.getElementById("summary-basic23");

const dialogEl = document.getElementById("detail-dialog");
const dialogCloseEl = document.getElementById("dialog-close");
const detailNameEl = document.getElementById("detail-name");
const detailContentEl = document.getElementById("detail-content");

initialize();

function initialize() {
  populateSelect(categoryEl, uniqueSorted(participants.map(item => item.kategori)), "Semua kategori");
  populateSelect(sectionEl, uniqueSorted(participants.map(item => item.section)), "Semua section");
  populateSelect(levelEl, sortLevels(uniqueSorted(participants.map(item => item.level))), "Semua level");
  populateSelect(basicEl, sortBasics(uniqueSorted(participants.map(item => item.basic).filter(Boolean))), "Semua Basic");

  if (Array.from(categoryEl.options).some(option => option.value === "PPM")) {
    categoryEl.value = "PPM";
  }

  [searchEl, categoryEl, sectionEl, levelEl, basicEl].forEach(element => {
    element.addEventListener(element.tagName === "INPUT" ? "input" : "change", applyFilters);
  });
  resetEl.addEventListener("click", resetFilters);
  exportEl.addEventListener("click", exportCSV);
  dialogCloseEl.addEventListener("click", () => dialogEl.close());
  dialogEl.addEventListener("click", event => {
    if (event.target === dialogEl) dialogEl.close();
  });

  applyFilters();
}

function populateSelect(select, values, allLabel) {
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = allLabel;
  select.appendChild(all);
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function applyFilters() {
  const query = normalize(searchEl.value);
  const category = categoryEl.value;
  const section = sectionEl.value;
  const level = levelEl.value;
  const basic = basicEl.value;

  const filtered = participants.filter(item => {
    const haystack = normalize(`${item.nik} ${item.nama}`);
    return (!query || haystack.includes(query)) &&
      (!category || item.kategori === category) &&
      (!section || item.section === section) &&
      (!level || item.level === level) &&
      (!basic || item.basic === basic);
  });

  renderRows(filtered);
  renderSummary(filtered);
  resultCountEl.textContent = `${filtered.length} peserta`;
  emptyEl.hidden = filtered.length !== 0;
  document.querySelector(".table-wrap").hidden = filtered.length === 0;
  return filtered;
}

function renderRows(items) {
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-nik">${escapeHTML(item.nik)}</td>
      <td class="cell-name">${escapeHTML(item.nama)}</td>
      <td>${escapeHTML(item.section || "-")}</td>
      <td><span class="small-tag ${item.kategori === "PPM" ? "ppm" : ""}">${escapeHTML(item.kategori || "-")}</span></td>
      <td>${escapeHTML(item.level || "-")}</td>
      <td>${item.basic ? `<span class="basic-tag">${escapeHTML(item.basic)}</span>` : "-"}</td>
      <td><button class="detail-button" type="button" data-nik="${escapeAttribute(item.nik)}">Lihat</button></td>
    `;
    tr.querySelector(".detail-button").addEventListener("click", () => openDetail(item));
    fragment.appendChild(tr);
  });
  bodyEl.replaceChildren(fragment);
}

function renderSummary(items) {
  summaryTotalEl.textContent = items.length;
  summaryTotalNoteEl.textContent = `dari ${participants.length} peserta`;
  summarySectionsEl.textContent = new Set(items.map(item => item.section).filter(Boolean)).size;
  summaryBasic1El.textContent = items.filter(item => item.basic === "Basic 1").length;
  summaryBasic23El.textContent = items.filter(item => item.basic === "Basic 2" || item.basic === "Basic 3").length;
}

function resetFilters() {
  searchEl.value = "";
  categoryEl.value = Array.from(categoryEl.options).some(option => option.value === "PPM") ? "PPM" : "";
  sectionEl.value = "";
  levelEl.value = "";
  basicEl.value = "";
  applyFilters();
}

async function openDetail(baseData) {
  detailNameEl.textContent = baseData.nama;
  detailContentEl.innerHTML = `<div class="detail-loading">Mengambil detail penugasan...</div>`;
  if (typeof dialogEl.showModal === "function") dialogEl.showModal();
  else dialogEl.setAttribute("open", "");

  try {
    const response = await fetch(`${HR_API}?action=search&keyword=${encodeURIComponent(baseData.nik)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const data = payload?.status && payload?.data ? payload.data : baseData;
    renderDetail(data, baseData);
  } catch (error) {
    console.error(error);
    renderDetail(baseData, baseData, true);
  }
}

function renderDetail(data, fallback, apiFailed = false) {
  const merged = {
    nama: data.nama ?? data.name ?? fallback.nama,
    nik: data.nik ?? data.NIK ?? fallback.nik,
    section: data.section ?? data.Section ?? fallback.section,
    level: data.level ?? data.currentLevel ?? data["Current Level"] ?? fallback.level,
    basic: data.basic ?? data.requiredBasic ?? data["Basic yang harus dikerjakan"] ?? fallback.basic,
    kategori: data.kategori ?? data.category ?? fallback.kategori
  };

  const modules = Array.isArray(data.modules)
    ? data.modules.map(module => enrichModule(module, merged.section, merged.basic))
    : [];

  detailNameEl.textContent = merged.nama || "Peserta";
  const meta = [
    ["NIK", merged.nik],
    ["Section", merged.section],
    ["Kategori", merged.kategori],
    ["Current Level", merged.level],
    ["Basic", merged.basic || "-"]
  ].map(([label, value]) => `
    <div class="meta-item">
      <span class="meta-label">${escapeHTML(label)}</span>
      <span class="meta-value">${escapeHTML(value || "-")}</span>
    </div>`).join("");

  let tasksHTML = "";
  if (modules.length) {
    tasksHTML = `<div class="detail-task-list">${modules.map(task => detailTaskRow(task)).join("")}</div>`;
  } else if (apiFailed) {
    tasksHTML = `<div class="detail-error">Data peserta tersedia, tetapi detail modul belum dapat diambil dari Apps Script. Coba kembali saat koneksi/API tersedia.</div>`;
  } else {
    tasksHTML = `<div class="detail-empty">Belum ada daftar modul yang dikirim backend untuk peserta ini.</div>`;
  }

  detailContentEl.innerHTML = `
    <div class="detail-meta">${meta}</div>
    <div class="detail-assignment">
      <div>
        <span class="meta-label">Yang harus dikerjakan</span>
        <strong>${escapeHTML(merged.basic || "Belum ditentukan")}</strong>
      </div>
      <a class="journey-button" href="index.html?nik=${encodeURIComponent(merged.nik)}" target="_blank" rel="noopener">Buka sebagai peserta</a>
    </div>
    ${tasksHTML}
  `;
}

function detailTaskRow(module) {
  const postTest = safeURL(module.postTest);
  const moduleLink = safeURL(module.moduleLink);
  return `
    <div class="detail-task">
      <div class="detail-task-title">${escapeHTML(module.title || "Materi Training")}</div>
      ${postTest ? `<a class="detail-link post" href="${escapeAttribute(postTest)}" target="_blank" rel="noopener noreferrer">Post Test</a>` : `<span class="detail-link post disabled">Post Test</span>`}
      ${moduleLink ? `<a class="detail-link module" href="${escapeAttribute(moduleLink)}" target="_blank" rel="noopener noreferrer">Modul</a>` : `<span class="detail-link module disabled">Modul</span>`}
    </div>`;
}

function exportCSV() {
  const items = applyFilters();
  const header = ["NIK", "Nama", "Section", "Kategori", "Current Level", "Basic yang harus dikerjakan"];
  const rows = items.map(item => [item.nik, item.nama, item.section, item.kategori, item.level, item.basic]);
  const csv = [header, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `HR-Monitoring-PPM-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function enrichModule(module, section, basic) {
  const title = pick(module, ["module", "title", "namaModul", "nama_modul", "name", "judul"]) || "Materi Training";
  let postTest = pick(module, ["postTest", "post_test", "posttest", "linkPostTest", "link_post_test", "postTestLink", "linkPosttest"]);
  let moduleLink = pick(module, ["moduleLink", "linkModul", "link_modul", "modul", "link", "url"]);
  const matches = catalogByTitle.get(normalizeTitle(title)) || [];
  const best = chooseCatalogMatch(matches, section, basic);
  if (!postTest && best?.postTest) postTest = best.postTest;
  if (!moduleLink && best?.moduleLink) moduleLink = best.moduleLink;
  return { title, postTest, moduleLink };
}

function buildCatalogIndex(catalog) {
  const map = new Map();
  catalog.forEach(item => {
    const key = normalizeTitle(item.title);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

function chooseCatalogMatch(matches, section, basic) {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  const sectionKey = normalizeTitle(section);
  const basicKey = normalizeTitle(basic);
  return matches
    .map(item => {
      const sheetKey = normalizeTitle(item.sheet);
      const itemBasic = normalizeTitle(item.basic);
      let score = 0;
      if (basicKey && itemBasic === basicKey) score += 5;
      if (sectionKey && sheetKey === sectionKey) score += 5;
      if (sectionKey && sheetKey.includes(sectionKey)) score += 3;
      if (sectionKey && sectionKey.includes(sheetKey)) score += 2;
      return { item, score };
    })
    .sort((a,b) => b.score - a.score)[0].item;
}

function pick(object, keys) {
  if (!object || typeof object !== "object") return "";
  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b, "id", { numeric:true, sensitivity:"base" }));
}
function sortLevels(values) {
  const order = ["Entry Level", "OJT", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"];
  return values.sort((a,b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b, "id", { numeric:true });
  });
}
function sortBasics(values) {
  return values.sort((a,b) => Number((a.match(/\d+/)||[999])[0]) - Number((b.match(/\d+/)||[999])[0]));
}
function normalize(value) { return String(value ?? "").toLowerCase().trim().replace(/\s+/g," "); }
function normalizeTitle(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function safeURL(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try { const url = new URL(raw); return ["http:","https:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}
function escapeHTML(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function escapeAttribute(value) { return escapeHTML(value); }
