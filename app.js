const API = "https://script.google.com/macros/s/AKfycbxbaop9HbasKeMj1d9CqG9jjTqJRq68Gv3f-8zaVobcbv6pDW3LRu4IJpFezpO2nFRi/exec";

const searchInput = document.getElementById("search");
const searchButton = document.getElementById("search-button");
const participantsList = document.getElementById("participants");
const resultArea = document.getElementById("result");
const statusArea = document.getElementById("status");

const catalog = Array.isArray(window.TRAINING_CATALOG) ? window.TRAINING_CATALOG : [];
const catalogByTitle = new Map();

let activeParticipant = null;
let activeModules = [];
let activeProgress = new Map();
let progressBackendReady = false;

for (const item of catalog) {
  const key = normalizeTitle(item.title);
  if (!catalogByTitle.has(key)) catalogByTitle.set(key, []);
  catalogByTitle.get(key).push(item);
}

loadParticipants();
searchButton.addEventListener("click", searchPPM);
searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") searchPPM();
});

const queryNIK = new URLSearchParams(window.location.search).get("nik");
if (queryNIK) {
  searchInput.value = queryNIK;
  window.addEventListener("DOMContentLoaded", () => searchPPM(), { once: true });
}

async function loadParticipants() {
  try {
    const response = await fetch(`${API}?action=participants`, { cache: "no-store" });
    if (!response.ok) throw new Error("Gagal memuat daftar peserta");
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];

    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const option = document.createElement("option");
      const nama = item.nama ?? item.name ?? "";
      const nik = item.nik ?? item.NIK ?? "";
      option.value = nama && nik ? `${nama} - ${nik}` : String(nik || nama);
      fragment.appendChild(option);
    });
    participantsList.replaceChildren(fragment);
  } catch (error) {
    console.warn(error);
  }
}

async function searchPPM() {
  let keyword = searchInput.value.trim();
  if (!keyword) {
    setStatus("Masukkan NIK atau nama peserta terlebih dahulu.", true);
    searchInput.focus();
    return;
  }

  if (keyword.includes("-")) keyword = keyword.split("-").pop().trim();

  setLoading(true);
  resultArea.innerHTML = "";
  setStatus("Mengambil data peserta...");

  try {
    const response = await fetch(`${API}?action=search&keyword=${encodeURIComponent(keyword)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();

    if (!payload?.status || !payload?.data) {
      setStatus("Data peserta tidak ditemukan. Periksa kembali NIK atau nama.", true);
      return;
    }

    renderJourney(payload.data);
    setStatus("");
    requestAnimationFrame(() => resultArea.scrollIntoView({ behavior: "smooth", block: "start" }));
  } catch (error) {
    console.error(error);
    setStatus("Data belum dapat dimuat. Periksa koneksi atau URL Web App Apps Script.", true);
  } finally {
    setLoading(false);
  }
}

function renderJourney(data) {
  const nama = data.nama ?? data.name ?? "-";
  const nik = data.nik ?? data.NIK ?? "-";
  const section = data.section ?? data.Section ?? "-";
  const level = data.level ?? data.currentLevel ?? data["Current Level"] ?? "-";
  const basic = data.basic ?? data.requiredBasic ?? data["Basic yang harus dikerjakan"] ?? "-";
  const category = data.kategori ?? data.category ?? "PPM";

  let modules = Array.isArray(data.modules) ? data.modules : [];
  modules = modules.map(module => enrichModule(module, section, basic));
  if (!modules.length) modules = getCatalogAssignment(section, basic);

  activeParticipant = { nama, nik: String(nik), section, level, basic, kategori: category };
  activeModules = modules.map(module => ({
    ...module,
    taskKey: createTaskKey(section, basic, module.title)
  }));
  activeProgress = new Map();
  progressBackendReady = false;

  const rows = activeModules.length
    ? activeModules.map(module => taskRow(module)).join("")
    : `<div class="empty-state">Belum ada daftar materi yang ditemukan untuk peserta ini.</div>`;

  resultArea.innerHTML = `
    <article class="journey-card">
      <div class="journey-top">
        <div>
          <h2 class="person-name">${escapeHTML(nama)}</h2>
          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Nama</span><span class="meta-value">${escapeHTML(nama)}</span></div>
            <div class="meta-item"><span class="meta-label">NIK</span><span class="meta-value">${escapeHTML(nik)}</span></div>
            <div class="meta-item"><span class="meta-label">Section</span><span class="meta-value">${escapeHTML(section)}</span></div>
          </div>
        </div>
        <div class="badges" aria-label="Kategori dan level">
          <span class="badge primary">${escapeHTML(category || "PPM")}</span>
          <span class="badge secondary">${escapeHTML(level)}</span>
        </div>
      </div>

      <div class="assignment-head">
        <p>Yang harus dikerjakan</p>
        <h2>(<span class="basic-highlight">${escapeHTML(basic)}</span>)</h2>
      </div>

      ${activeModules.length ? `
      <section class="progress-panel" aria-label="Progress peserta">
        <div class="progress-copy">
          <div>
            <span class="progress-eyebrow">PROGRESS</span>
            <strong id="participant-progress-label">Memuat progress...</strong>
          </div>
          <span id="participant-progress-percent" class="progress-percent">—</span>
        </div>
        <div class="progress-track"><span id="participant-progress-bar" style="width:0%"></span></div>
        <p id="participant-progress-note" class="progress-note">Checklist akan aktif setelah status progress berhasil dimuat.</p>
      </section>

      <div class="task-list">
        <div class="task-header" aria-hidden="true">
          <span>Judul</span><span>Link Post Test</span><span>Modul</span><span>Selesai</span>
        </div>
        ${rows}
      </div>` : rows}
    </article>
  `;

  if (activeModules.length) loadProgress(activeParticipant.nik);
}

function taskRow(module) {
  const title = module.title || "Materi Training";
  const postTest = safeURL(module.postTest);
  const moduleLink = safeURL(module.moduleLink);

  return `
    <div class="task-row" data-task-key="${escapeAttribute(module.taskKey)}">
      <div class="task-title">${escapeHTML(title)}</div>
      <div class="task-action post-test">${actionLink(postTest, "Buka Post Test", "")}</div>
      <div class="task-action module">${actionLink(moduleLink, "Buka Modul", "module-link")}</div>
      <label class="completion-control" title="Tandai jika materi ini sudah dikerjakan">
        <input class="task-checkbox" type="checkbox" data-task-key="${escapeAttribute(module.taskKey)}" disabled>
        <span class="check-box" aria-hidden="true">✓</span>
        <span class="check-text">Selesai</span>
      </label>
    </div>
  `;
}

async function loadProgress(nik) {
  const note = document.getElementById("participant-progress-note");
  try {
    const response = await fetch(`${API}?action=progress&nik=${encodeURIComponent(nik)}&_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.status || !Array.isArray(payload?.data?.items)) throw new Error("Endpoint progress belum tersedia");

    activeProgress = new Map(payload.data.items.map(item => [String(item.taskKey || ""), item]));
    progressBackendReady = true;
    syncParticipantProgressUI();
    bindProgressCheckboxes();
  } catch (error) {
    console.warn("Progress backend belum aktif:", error);
    progressBackendReady = false;
    syncParticipantProgressUI();
    if (note) note.textContent = "Link training tetap dapat digunakan. Checklist belum aktif sampai backend progress dipasang.";
  }
}

function bindProgressCheckboxes() {
  document.querySelectorAll(".task-checkbox").forEach(checkbox => {
    checkbox.disabled = false;
    checkbox.addEventListener("change", handleProgressChange);
  });
}

async function handleProgressChange(event) {
  if (!progressBackendReady || !activeParticipant) return;
  const checkbox = event.currentTarget;
  const taskKey = checkbox.dataset.taskKey || "";
  const module = activeModules.find(item => item.taskKey === taskKey);
  if (!module) return;

  const desired = checkbox.checked;
  checkbox.disabled = true;
  setRowSaving(taskKey, true);

  try {
    const params = new URLSearchParams({
      action: "saveProgress",
      nik: activeParticipant.nik,
      nama: activeParticipant.nama,
      section: activeParticipant.section,
      basic: activeParticipant.basic,
      taskKey,
      title: module.title || "Materi Training",
      completed: String(desired),
      _: String(Date.now())
    });
    const response = await fetch(`${API}?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.status || !payload?.data) throw new Error(payload?.message || "Progress gagal disimpan");

    activeProgress.set(taskKey, payload.data);
    syncParticipantProgressUI();
    flashStatus("Progress tersimpan.");
  } catch (error) {
    console.error(error);
    checkbox.checked = !desired;
    setStatus("Progress gagal disimpan. Coba lagi.", true);
  } finally {
    checkbox.disabled = false;
    setRowSaving(taskKey, false);
  }
}

function syncParticipantProgressUI() {
  const label = document.getElementById("participant-progress-label");
  const percentEl = document.getElementById("participant-progress-percent");
  const bar = document.getElementById("participant-progress-bar");
  const note = document.getElementById("participant-progress-note");
  if (!label || !percentEl || !bar || !note) return;

  if (!progressBackendReady) {
    label.textContent = "Progress belum aktif";
    percentEl.textContent = "—";
    bar.style.width = "0%";
    document.querySelectorAll(".task-checkbox").forEach(cb => { cb.disabled = true; cb.checked = false; });
    return;
  }

  let completed = 0;
  activeModules.forEach(module => {
    const record = activeProgress.get(module.taskKey);
    const isDone = Boolean(record?.completed);
    if (isDone) completed += 1;
    const checkbox = document.querySelector(`.task-checkbox[data-task-key="${cssEscape(module.taskKey)}"]`);
    if (checkbox) checkbox.checked = isDone;
    const row = document.querySelector(`.task-row[data-task-key="${cssEscape(module.taskKey)}"]`);
    if (row) row.classList.toggle("completed", isDone);
  });

  const total = activeModules.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  label.textContent = `${completed} dari ${total} materi selesai`;
  percentEl.textContent = `${percent}%`;
  bar.style.width = `${percent}%`;
  note.textContent = completed === total && total > 0
    ? "Semua materi pada assignment ini sudah ditandai selesai."
    : "Centang setelah materi benar-benar sudah dikerjakan. Status tersimpan untuk monitoring HR.";
}

function setRowSaving(taskKey, saving) {
  const row = document.querySelector(`.task-row[data-task-key="${cssEscape(taskKey)}"]`);
  if (row) row.classList.toggle("saving", saving);
}

function flashStatus(message) {
  setStatus(message, false);
  window.clearTimeout(flashStatus.timer);
  flashStatus.timer = window.setTimeout(() => setStatus(""), 1800);
}

function actionLink(url, label, extraClass) {
  if (!url) return `<span class="action-link disabled ${extraClass}" aria-disabled="true">Belum tersedia</span>`;
  return `<a class="action-link ${extraClass}" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function getCatalogAssignment(section, basic) {
  const sectionKey = normalizeTitle(section);
  const basicKey = normalizeTitle(basic);
  const sameBasic = catalog.filter(item => normalizeTitle(item.basic) === basicKey);
  let matched = sameBasic.filter(item => normalizeTitle(item.sheet) === sectionKey);

  if (!matched.length) {
    const scoredSheets = new Map();
    sameBasic.forEach(item => {
      const sheetKey = normalizeTitle(item.sheet);
      let score = 0;
      if (sectionKey && sheetKey && (sheetKey.includes(sectionKey) || sectionKey.includes(sheetKey))) score = Math.min(sheetKey.length, sectionKey.length);
      if (score > (scoredSheets.get(sheetKey) || 0)) scoredSheets.set(sheetKey, score);
    });
    const bestSheet = [...scoredSheets.entries()].sort((a,b) => b[1] - a[1])[0];
    if (bestSheet && bestSheet[1] > 0) matched = sameBasic.filter(item => normalizeTitle(item.sheet) === bestSheet[0]);
  }

  return matched.map(item => ({ title: item.title, postTest: item.postTest, moduleLink: item.moduleLink }));
}

function enrichModule(module, section, basic) {
  const title = pick(module, ["module", "title", "namaModul", "nama_modul", "name", "judul"]) || "Materi Training";
  let postTest = pick(module, ["postTest", "post_test", "posttest", "linkPostTest", "link_post_test", "postTestLink", "linkPosttest"]);
  let moduleLink = pick(module, ["moduleLink", "linkModul", "link_modul", "modul", "link", "url"]);

  const matches = catalogByTitle.get(normalizeTitle(title)) || [];
  const best = chooseCatalogMatch(matches, section, basic);
  if (!postTest && best?.postTest) postTest = best.postTest;
  if (!moduleLink && best?.moduleLink) moduleLink = best.moduleLink;
  if (best && normalizeURL(moduleLink) === normalizeURL(best.postTest) && best.moduleLink) moduleLink = best.moduleLink;
  return { title, postTest, moduleLink };
}

function chooseCatalogMatch(matches, section, basic) {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  const sectionKey = normalizeTitle(section);
  const basicKey = normalizeTitle(basic);
  return matches.map(item => {
    let score = 0;
    const sheetKey = normalizeTitle(item.sheet);
    const itemBasic = normalizeTitle(item.basic);
    if (basicKey && itemBasic === basicKey) score += 5;
    if (sectionKey && sheetKey === sectionKey) score += 5;
    if (sectionKey && sheetKey.includes(sectionKey)) score += 3;
    if (sectionKey && sectionKey.includes(sheetKey)) score += 2;
    return { item, score };
  }).sort((a,b) => b.score - a.score)[0].item;
}

function createTaskKey(section, basic, title) {
  return `${normalizeTitle(section)}::${normalizeTitle(basic)}::${normalizeTitle(title)}`;
}

function pick(object, keys) {
  if (!object || typeof object !== "object") return "";
  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}
function normalizeTitle(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function normalizeURL(value) { return String(value ?? "").trim().replace(/\/$/, ""); }
function safeURL(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}
function escapeHTML(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function escapeAttribute(value) { return escapeHTML(value); }
function cssEscape(value) { return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&"); }
function setStatus(message, isError = false) { statusArea.textContent = message; statusArea.classList.toggle("error", isError); }
function setLoading(isLoading) { searchButton.disabled = isLoading; searchButton.textContent = isLoading ? "Memuat..." : "Tampilkan"; }
