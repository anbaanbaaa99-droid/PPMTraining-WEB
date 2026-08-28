const HR_API = "https://script.google.com/macros/s/AKfycbxbaop9HbasKeMj1d9CqG9jjTqJRq68Gv3f-8zaVobcbv6pDW3LRu4IJpFezpO2nFRi/exec";

let participants = [];
const trainingCatalog = Array.isArray(window.TRAINING_CATALOG) ? window.TRAINING_CATALOG : [];
const catalogByTitle = buildCatalogIndex(trainingCatalog);

let progressIndex = new Map();
let progressBackendReady = false;
let lastFiltered = [];
let hrToken = "";
let dashboardInitialized = false;

const HR_SESSION_KEY = "ppm_hr_session_v1";

const loginGateEl = document.getElementById("hr-login-gate");
const hrAppEl = document.getElementById("hr-app");
const loginFormEl = document.getElementById("hr-login-form");
const usernameEl = document.getElementById("hr-username");
const passwordEl = document.getElementById("hr-password");
const loginButtonEl = document.getElementById("hr-login-button");
const loginStatusEl = document.getElementById("hr-login-status");
const togglePasswordEl = document.getElementById("toggle-password");
const logoutEl = document.getElementById("hr-logout");

const searchEl = document.getElementById("hr-search");
const categoryEl = document.getElementById("filter-category");
const sectionEl = document.getElementById("filter-section");
const levelEl = document.getElementById("filter-level");
const basicEl = document.getElementById("filter-basic");
const statusEl = document.getElementById("filter-status");
const resetEl = document.getElementById("reset-filter");
const exportEl = document.getElementById("export-button");
const refreshEl = document.getElementById("refresh-progress");
const bodyEl = document.getElementById("monitor-body");
const emptyEl = document.getElementById("monitor-empty");
const resultCountEl = document.getElementById("result-count");
const backendBannerEl = document.getElementById("progress-backend-banner");

const summaryTotalEl = document.getElementById("summary-total");
const summaryTotalNoteEl = document.getElementById("summary-total-note");
const summaryCompletedEl = document.getElementById("summary-completed");
const summaryInProgressEl = document.getElementById("summary-inprogress");
const summaryNotStartedEl = document.getElementById("summary-notstarted");
const summaryAverageEl = document.getElementById("summary-average");
const summarySectionNoteEl = document.getElementById("summary-section-note");

const dialogEl = document.getElementById("detail-dialog");
const dialogCloseEl = document.getElementById("dialog-close");
const detailNameEl = document.getElementById("detail-name");
const detailContentEl = document.getElementById("detail-content");

const HR_FRONTEND_VERSION = "20260828-loginfix1";

initializeHRPage();

function initializeHRPage() {
  const required = [
    ["hr-login-gate", loginGateEl],
    ["hr-app", hrAppEl],
    ["hr-login-form", loginFormEl],
    ["hr-username", usernameEl],
    ["hr-password", passwordEl],
    ["hr-login-button", loginButtonEl],
    ["hr-login-status", loginStatusEl]
  ];
  const missing = required.filter(([, el]) => !el).map(([id]) => id);
  if (missing.length) {
    console.error("HR UI tidak lengkap:", missing);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="position:fixed;z-index:99999;left:12px;right:12px;top:12px;padding:12px;background:#fff0f3;border:1px solid #c43a55;border-radius:8px;color:#8f1f35;font:14px Arial">Frontend HR tidak lengkap. Elemen hilang: ${missing.join(", ")}</div>`
    );
    return;
  }

  loginFormEl.addEventListener("submit", handleHRLogin);
  togglePasswordEl?.addEventListener("click", togglePasswordVisibility);
  logoutEl?.addEventListener("click", logoutHR);

  window.addEventListener("error", event => {
    console.error("HR frontend error:", event.error || event.message);
    if (!hrAppEl.hidden) return;
    setLoginStatus(`JavaScript error: ${event.message || "unknown error"}`, true);
  });
  window.addEventListener("unhandledrejection", event => {
    console.error("HR unhandled rejection:", event.reason);
    if (!hrAppEl.hidden) return;
    const msg = event.reason?.message || String(event.reason || "unknown error");
    setLoginStatus(`Error: ${msg}`, true);
  });

  console.info(`HR frontend ${HR_FRONTEND_VERSION} loaded`);
  bootHR();
}

async function bootHR() {
  const saved = readSavedSession();
  if (!saved?.token) {
    showLogin();
    return;
  }

  setLoginStatus("Memeriksa sesi HR...");
  try {
    const valid = await validateHRSession(saved.token);
    if (!valid) throw new Error("Sesi tidak valid");
    hrToken = saved.token;
    await enterDashboard();
  } catch (error) {
    console.warn(error);
    clearHRSession();
    showLogin("Sesi telah berakhir. Silakan login kembali.", true);
  }
}

async function handleHRLogin(event) {
  event.preventDefault();
  event.stopPropagation();

  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  if (!username || !password) {
    setLoginStatus("Username dan password wajib diisi.", true);
    return;
  }

  loginButtonEl.disabled = true;
  loginButtonEl.textContent = "Memeriksa...";
  setLoginStatus("Menghubungi server HR...");

  try {
    // FormData menjaga POST sebagai simple browser request dan cocok dengan e.parameter Apps Script.
    const form = new FormData();
    form.append("action", "hrLogin");
    form.append("username", username);
    form.append("password", password);

    const payload = await fetchJsonWithTimeout(HR_API, {
      method: "POST",
      body: form,
      cache: "no-store",
      redirect: "follow",
      credentials: "omit"
    }, 15000);

    if (!payload?.status || !payload?.data?.token) {
      const serverMessage = payload?.message || "Username atau password salah.";
      if (/unsupported post action/i.test(serverMessage)) {
        throw new Error("Backend Apps Script masih versi lama. Deploy ulang versi yang memiliki doPost() + handleHRAuthPost_().");
      }
      if (/belum dikonfigurasi/i.test(serverMessage)) {
        throw new Error("HR login belum dikonfigurasi. Cek PPM_HR_USERNAME, PPM_HR_PASSWORD, dan PPM_HR_TOKEN_SECRET di Script Properties.");
      }
      throw new Error(serverMessage);
    }

    hrToken = String(payload.data.token);
    saveHRSession({ token: hrToken, expiresAt: payload.data.expiresAt || "" });
    passwordEl.value = "";
    setLoginStatus("Login berhasil. Memuat data peserta...");
    await enterDashboard();
  } catch (error) {
    console.error("HR login failed:", error);
    setLoginStatus(formatLoginError(error), true);
  } finally {
    loginButtonEl.disabled = false;
    loginButtonEl.textContent = "Masuk ke Dashboard";
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Server HR merespons HTTP ${response.status}.`);
    }
    if (!text.trim()) {
      throw new Error("Server HR mengembalikan respons kosong.");
    }
    try {
      return JSON.parse(text);
    } catch {
      const preview = text.replace(/\s+/g, " ").slice(0, 120);
      throw new Error(`Respons backend bukan JSON: ${preview}`);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Koneksi ke backend HR timeout. Periksa deployment Apps Script dan jaringan.");
    }
    if (error instanceof TypeError && /fetch/i.test(error.message || "")) {
      throw new Error("Browser tidak dapat membaca respons Apps Script (network/CORS/redirect). Pastikan Web App di-deploy untuk Anyone dan URL /exec di hr.js masih benar.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function formatLoginError(error) {
  const message = String(error?.message || "Login gagal.").trim();
  return message || "Login gagal. Periksa akun HR dan deployment backend.";
}

async function enterDashboard() {
  setLoginStatus("Membuka dashboard...");
  const data = await loadHRParticipants();
  participants = data;
  loginGateEl.hidden = true;
  hrAppEl.hidden = false;
  setLoginStatus("");
  initializeDashboard();
}

async function validateHRSession(token) {
  try {
    const payload = await fetchJsonWithTimeout(
      `${HR_API}?action=hrValidate&token=${encodeURIComponent(token)}&_=${Date.now()}`,
      { cache: "no-store", credentials: "omit", redirect: "follow" },
      12000
    );
    return Boolean(payload?.status && payload?.data?.valid);
  } catch (error) {
    console.warn("Validasi sesi HR gagal:", error);
    return false;
  }
}

async function loadHRParticipants() {
  const payload = await fetchJsonWithTimeout(
    `${HR_API}?action=hrParticipants&token=${encodeURIComponent(hrToken)}&_=${Date.now()}`,
    { cache: "no-store", credentials: "omit", redirect: "follow" },
    15000
  );
  if (!payload?.status || !Array.isArray(payload?.data)) {
    if (payload?.code === "UNAUTHORIZED") handleUnauthorized();
    throw new Error(payload?.message || "Data peserta HR tidak tersedia.");
  }
  return payload.data.map(item => ({
    ...item,
    nik: String(item?.nik ?? "").trim(),
    nama: String(item?.nama ?? "").trim(),
    section: String(item?.section ?? "").trim(),
    level: String(item?.level ?? "").trim(),
    basic: String(item?.basic ?? "").trim(),
    kategori: String(item?.kategori ?? "").trim() || "PPM",
    moduleSheet: String(item?.moduleSheet ?? item?.module_sheet ?? "").trim()
  }));
}

function initializeDashboard() {
  populateSelect(categoryEl, uniqueSorted(participants.map(item => item.kategori)), "Semua kategori");
  populateSelect(sectionEl, uniqueSorted(participants.map(item => item.section)), "Semua section");
  populateSelect(levelEl, sortLevels(uniqueSorted(participants.map(item => item.level))), "Semua level");
  populateSelect(basicEl, sortBasics(uniqueSorted(participants.map(item => item.basic).filter(Boolean))), "Semua Basic");
  if (Array.from(categoryEl.options).some(option => option.value === "PPM")) categoryEl.value = "PPM";

  if (!dashboardInitialized) {
    [searchEl, categoryEl, sectionEl, levelEl, basicEl, statusEl].forEach(element => {
      element.addEventListener(element.tagName === "INPUT" ? "input" : "change", applyFilters);
    });
    resetEl.addEventListener("click", resetFilters);
    exportEl.addEventListener("click", exportCSV);
    refreshEl.addEventListener("click", loadAllProgress);
    dialogCloseEl.addEventListener("click", () => dialogEl.close());
    dialogEl.addEventListener("click", event => { if (event.target === dialogEl) dialogEl.close(); });
    dashboardInitialized = true;
  }

  applyFilters();
  loadAllProgress();
}

function togglePasswordVisibility() {
  const show = passwordEl.type === "password";
  passwordEl.type = show ? "text" : "password";
  togglePasswordEl.textContent = show ? "Sembunyi" : "Lihat";
  togglePasswordEl.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
}

function logoutHR() {
  clearHRSession();
  hrToken = "";
  location.reload();
}

function handleUnauthorized() {
  clearHRSession();
  hrToken = "";
  alert("Sesi HR sudah berakhir. Silakan login kembali.");
  location.reload();
}

function readSavedSession() {
  try { return JSON.parse(sessionStorage.getItem(HR_SESSION_KEY) || "null"); }
  catch { return null; }
}
function saveHRSession(value) { sessionStorage.setItem(HR_SESSION_KEY, JSON.stringify(value)); }
function clearHRSession() { sessionStorage.removeItem(HR_SESSION_KEY); }

function showLogin(message = "", isError = false) {
  hrAppEl.hidden = true;
  loginGateEl.hidden = false;
  setLoginStatus(message, isError);
  requestAnimationFrame(() => usernameEl.focus());
}

function setLoginStatus(message, isError = false) {
  loginStatusEl.textContent = message || "";
  loginStatusEl.classList.toggle("error", Boolean(isError));
}

async function loadAllProgress() {
  refreshEl.disabled = true;
  refreshEl.textContent = "Memuat...";
  try {
    const response = await fetch(`${HR_API}?action=progressAll&token=${encodeURIComponent(hrToken)}&_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.status || !Array.isArray(payload?.data)) {
      if (payload?.code === "UNAUTHORIZED") return handleUnauthorized();
      throw new Error(payload?.message || "Endpoint progressAll belum tersedia");
    }

    progressIndex = new Map();
    payload.data.forEach(record => {
      const nik = String(record.nik ?? "").trim();
      const taskKey = String(record.taskKey ?? "").trim();
      if (!nik || !taskKey) return;
      if (!progressIndex.has(nik)) progressIndex.set(nik, new Map());
      progressIndex.get(nik).set(taskKey, record);
    });
    progressBackendReady = true;
    backendBannerEl.hidden = true;
  } catch (error) {
    console.warn(error);
    progressBackendReady = false;
    backendBannerEl.hidden = false;
  } finally {
    refreshEl.disabled = false;
    refreshEl.textContent = "Refresh Progress";
    applyFilters();
  }
}

function populateSelect(select, values, allLabel) {
  select.replaceChildren();
  const all = document.createElement("option"); all.value = ""; all.textContent = allLabel; select.appendChild(all);
  values.forEach(value => { const option = document.createElement("option"); option.value = value; option.textContent = value; select.appendChild(option); });
}

function applyFilters() {
  const query = normalize(searchEl.value);
  const category = categoryEl.value;
  const section = sectionEl.value;
  const level = levelEl.value;
  const basic = basicEl.value;
  const status = statusEl.value;

  const filtered = participants.filter(item => {
    const haystack = normalize(`${item.nik} ${item.nama}`);
    const metrics = getParticipantMetrics(item);
    return (!query || haystack.includes(query)) &&
      (!category || item.kategori === category) &&
      (!section || item.section === section) &&
      (!level || item.level === level) &&
      (!basic || item.basic === basic) &&
      (!status || (progressBackendReady && metrics.status === status));
  });

  lastFiltered = filtered;
  renderRows(filtered);
  renderSummary(filtered);
  resultCountEl.textContent = `${filtered.length} peserta`;
  emptyEl.hidden = filtered.length !== 0;
  document.querySelector(".table-wrap").hidden = filtered.length === 0;
  return filtered;
}

function getParticipantMetrics(item, modulesOverride = null) {
  let modules = [];
  let mappingStatus = "resolved";

  if (Array.isArray(modulesOverride)) {
    modules = modulesOverride;
  } else {
    const resolution = resolveExpectedModules(item.section, item.basic, item.moduleSheet);
    modules = resolution.modules;
    mappingStatus = resolution.status;
  }

  if (mappingStatus === "ambiguous") {
    return { modules: [], total: 0, completed: 0, percent: null, status: "Perlu Mapping" };
  }

  const total = modules.length;
  if (!progressBackendReady) return { modules, total, completed: 0, percent: null, status: "Belum Aktif" };

  const records = progressIndex.get(String(item.nik)) || new Map();
  let completed = 0;
  modules.forEach(module => {
    const key = createTaskKey(item.section, item.basic, module.title);
    if (records.get(key)?.completed) completed += 1;
  });

  const percent = total ? Math.round((completed / total) * 100) : 0;
  let status = "Belum Mulai";
  if (!total) status = "Belum Ada Materi";
  else if (completed >= total) status = "Completed";
  else if (completed > 0) status = "On Progress";
  return { modules, total, completed, percent, status };
}

function renderRows(items) {
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const metrics = getParticipantMetrics(item);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-nik">${escapeHTML(item.nik)}</td>
      <td class="cell-name">${escapeHTML(item.nama)}</td>
      <td>${escapeHTML(item.section || "-")}</td>
      <td><span class="small-tag ${item.kategori === "PPM" ? "ppm" : ""}">${escapeHTML(item.kategori || "-")}</span></td>
      <td>${escapeHTML(item.level || "-")}</td>
      <td>${item.basic ? `<span class="basic-tag">${escapeHTML(item.basic)}</span>` : "-"}</td>
      <td>${progressCell(metrics)}</td>
      <td>${statusChip(metrics.status)}</td>
      <td><button class="detail-button" type="button" data-nik="${escapeAttribute(item.nik)}">Lihat</button></td>
    `;
    tr.querySelector(".detail-button").addEventListener("click", () => openDetail(item));
    fragment.appendChild(tr);
  });
  bodyEl.replaceChildren(fragment);
}

function progressCell(metrics) {
  if (metrics.percent === null) return `<div class="mini-progress muted"><div class="mini-progress-top"><strong>— / —</strong><span>—</span></div><div class="mini-track"><i style="width:0%"></i></div></div>`;
  return `<div class="mini-progress"><div class="mini-progress-top"><strong>${metrics.completed}/${metrics.total}</strong><span>${metrics.percent}%</span></div><div class="mini-track"><i style="width:${metrics.percent}%"></i></div></div>`;
}

function statusChip(status) {
  const cls = status === "Completed" ? "completed" : status === "On Progress" ? "in-progress" : status === "Belum Mulai" ? "not-started" : "inactive";
  return `<span class="status-chip ${cls}">${escapeHTML(status)}</span>`;
}

function renderSummary(items) {
  summaryTotalEl.textContent = items.length;
  summaryTotalNoteEl.textContent = `dari ${participants.length} peserta`;
  const sections = new Set(items.map(item => item.section).filter(Boolean)).size;
  summarySectionNoteEl.textContent = `${sections} section`;

  if (!progressBackendReady) {
    summaryCompletedEl.textContent = "—";
    summaryInProgressEl.textContent = "—";
    summaryNotStartedEl.textContent = "—";
    summaryAverageEl.textContent = "—";
    return;
  }

  const metrics = items.map(getParticipantMetrics);
  summaryCompletedEl.textContent = metrics.filter(m => m.status === "Completed").length;
  summaryInProgressEl.textContent = metrics.filter(m => m.status === "On Progress").length;
  summaryNotStartedEl.textContent = metrics.filter(m => m.status === "Belum Mulai").length;
  const measurable = metrics.filter(m => m.total > 0);
  const avg = measurable.length ? Math.round(measurable.reduce((sum,m) => sum + m.percent, 0) / measurable.length) : 0;
  summaryAverageEl.textContent = `${avg}%`;
}

function resetFilters() {
  searchEl.value = "";
  categoryEl.value = Array.from(categoryEl.options).some(option => option.value === "PPM") ? "PPM" : "";
  sectionEl.value = ""; levelEl.value = ""; basicEl.value = ""; statusEl.value = "";
  applyFilters();
}

async function openDetail(baseData) {
  detailNameEl.textContent = baseData.nama;
  detailContentEl.innerHTML = `<div class="detail-loading">Mengambil detail penugasan...</div>`;
  if (typeof dialogEl.showModal === "function") dialogEl.showModal(); else dialogEl.setAttribute("open", "");

  try {
    const response = await fetch(`${HR_API}?action=search&keyword=${encodeURIComponent(baseData.nik)}`, { cache: "no-store" });
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
    nik: String(data.nik ?? data.NIK ?? fallback.nik),
    section: data.section ?? data.Section ?? fallback.section,
    level: data.level ?? data.currentLevel ?? data["Current Level"] ?? fallback.level,
    basic: data.basic ?? data.requiredBasic ?? data["Basic yang harus dikerjakan"] ?? fallback.basic,
    kategori: data.kategori ?? data.category ?? fallback.kategori,
    moduleSheet: data.moduleSheet ?? data.module_sheet ?? fallback.moduleSheet ?? ""
  };

  const backendResolution = data.moduleResolution && typeof data.moduleResolution === "object" ? data.moduleResolution : {};
  let modules = Array.isArray(data.modules) ? data.modules.map(module => enrichModule(module, merged.section, merged.basic)) : [];
  const localResolution = resolveExpectedModules(merged.section, merged.basic, merged.moduleSheet);
  const mappingAmbiguous = backendResolution.status === "ambiguous" || (!modules.length && localResolution.status === "ambiguous");
  if (!modules.length && !mappingAmbiguous) modules = localResolution.modules;

  detailNameEl.textContent = merged.nama || "Peserta";
  const metaRows = [["NIK",merged.nik],["Section",merged.section],["Kategori",merged.kategori],["Current Level",merged.level],["Basic",merged.basic || "-"]];
  if (merged.moduleSheet) metaRows.push(["Module Sheet", merged.moduleSheet]);
  const meta = metaRows
    .map(([label,value]) => `<div class="meta-item"><span class="meta-label">${escapeHTML(label)}</span><span class="meta-value">${escapeHTML(value || "-")}</span></div>`).join("");

  const metrics = mappingAmbiguous
    ? { modules: [], total: 0, completed: 0, percent: null, status: "Perlu Mapping" }
    : getParticipantMetrics({ ...merged, nik: merged.nik }, modules);
  const records = progressIndex.get(merged.nik) || new Map();
  let tasksHTML = "";
  if (modules.length) {
    tasksHTML = `<div class="detail-task-list">${modules.map(task => detailTaskRow(task, merged, records)).join("")}</div>`;
  } else if (mappingAmbiguous) {
    const candidates = backendResolution.candidates?.length ? backendResolution.candidates : localResolution.candidates;
    tasksHTML = `<div class="detail-error"><strong>Section belum cukup spesifik.</strong><br>Isi kolom Module Sheet / Sheet Modul. Kandidat: ${escapeHTML((candidates || []).join(", ") || "lebih dari satu sheet")}</div>`;
  } else if (apiFailed) {
    tasksHTML = `<div class="detail-error">Detail modul belum dapat diambil dari Apps Script dan tidak ditemukan pada katalog lokal.</div>`;
  } else {
    tasksHTML = `<div class="detail-empty">Belum ada daftar modul untuk assignment ini.</div>`;
  }

  detailContentEl.innerHTML = `
    <div class="detail-meta">${meta}</div>
    <div class="detail-progress-card">
      <div><span class="meta-label">Progress</span><strong>${metrics.status === "Perlu Mapping" ? "Perlu mapping sheet" : metrics.percent === null ? "Belum aktif" : `${metrics.completed}/${metrics.total} materi (${metrics.percent}%)`}</strong></div>
      ${statusChip(metrics.status)}
    </div>
    <div class="detail-assignment"><div><span class="meta-label">Yang harus dikerjakan</span><strong>${escapeHTML(merged.basic || "Belum ditentukan")}</strong></div><a class="journey-button" href="index.html?nik=${encodeURIComponent(merged.nik)}" target="_blank" rel="noopener">Buka sebagai peserta</a></div>
    ${tasksHTML}
  `;
}

function detailTaskRow(module, participant, records) {
  const postTest = safeURL(module.postTest);
  const moduleLink = safeURL(module.moduleLink);
  const key = createTaskKey(participant.section, participant.basic, module.title);
  const record = records.get(key);
  const done = progressBackendReady && Boolean(record?.completed);
  const completedAt = done && record?.completedAt ? formatDateTime(record.completedAt) : "";
  return `
    <div class="detail-task ${done ? "done" : ""}">
      <div class="detail-task-title">${escapeHTML(module.title || "Materi Training")}<small>${progressBackendReady ? (done ? `Selesai${completedAt ? ` • ${escapeHTML(completedAt)}` : ""}` : "Belum ditandai selesai") : "Progress belum aktif"}</small></div>
      ${postTest ? `<a class="detail-link post" href="${escapeAttribute(postTest)}" target="_blank" rel="noopener noreferrer">Post Test</a>` : `<span class="detail-link post disabled">Post Test</span>`}
      ${moduleLink ? `<a class="detail-link module" href="${escapeAttribute(moduleLink)}" target="_blank" rel="noopener noreferrer">Modul</a>` : `<span class="detail-link module disabled">Modul</span>`}
      <span class="task-state ${done ? "done" : ""}">${done ? "✓ Selesai" : "Belum"}</span>
    </div>`;
}

function exportCSV() {
  const items = lastFiltered.length || !participants.length ? lastFiltered : applyFilters();
  const header = ["NIK","Nama","Section","Kategori","Current Level","Basic","Materi","Selesai","Progress","Status"];
  const rows = items.map(item => {
    const m = getParticipantMetrics(item);
    return [item.nik,item.nama,item.section,item.kategori,item.level,item.basic,m.total,m.percent === null ? "" : m.completed,m.percent === null ? "" : `${m.percent}%`,m.status];
  });
  const csv = [header,...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `HR-Monitoring-PPM-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function getExpectedModules(section, basic, moduleSheet = "") {
  return resolveExpectedModules(section, basic, moduleSheet).modules;
}

function resolveExpectedModules(section, basic, moduleSheet = "") {
  const sectionKey = normalizeSectionKey(section);
  const hintKey = normalizeSectionKey(moduleSheet);
  const basicKeys = parseBasicAssignments(basic).map(normalizeTitle);
  if (!basicKeys.length) return { modules: [], status: "missing-basic", candidates: [] };

  const sameBasic = trainingCatalog.filter(item => basicKeys.includes(normalizeTitle(item.basic)));
  const sheetKeys = [...new Set(sameBasic.map(item => normalizeSectionKey(item.sheet)).filter(Boolean))];
  let selectedKey = "";

  if (hintKey && sheetKeys.includes(hintKey)) selectedKey = hintKey;
  if (!selectedKey && sectionKey && sheetKeys.includes(sectionKey)) selectedKey = sectionKey;

  if (!selectedKey) {
    const candidates = sheetKeys.filter(key => sectionKey && (key.includes(sectionKey) || sectionKey.includes(key)));
    if (candidates.length === 1) selectedKey = candidates[0];
    else if (candidates.length > 1) {
      return {
        modules: [],
        status: "ambiguous",
        candidates: sameBasic
          .filter(item => candidates.includes(normalizeSectionKey(item.sheet)))
          .map(item => item.sheet)
          .filter((value,index,arr) => arr.indexOf(value) === index)
      };
    }
  }

  if (!selectedKey) return { modules: [], status: "not-found", candidates: [] };

  const seen = new Set();
  const modules = sameBasic
    .filter(item => normalizeSectionKey(item.sheet) === selectedKey)
    .filter(item => {
      const key = `${normalizeTitle(item.basic)}::${normalizeTitle(item.title)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item => ({ title:item.title, postTest:item.postTest, moduleLink:item.moduleLink }));

  return { modules, status: "resolved", candidates: [] };
}

function enrichModule(module, section, basic) {
  const title = pick(module,["module","title","namaModul","nama_modul","name","judul"]) || "Materi Training";
  let postTest = pick(module,["postTest","post_test","posttest","linkPostTest","link_post_test","postTestLink","linkPosttest"]);
  let moduleLink = pick(module,["moduleLink","linkModul","link_modul","modul","link","url"]);
  const matches = catalogByTitle.get(normalizeTitle(title)) || []; const best = chooseCatalogMatch(matches,section,basic);
  if (!postTest && best?.postTest) postTest = best.postTest;
  if (!moduleLink && best?.moduleLink) moduleLink = best.moduleLink;
  return { title, postTest, moduleLink };
}
function buildCatalogIndex(catalog) { const map = new Map(); catalog.forEach(item => { const key=normalizeTitle(item.title); if(!map.has(key)) map.set(key,[]); map.get(key).push(item); }); return map; }
function chooseCatalogMatch(matches, section, basic) {
  if (!matches.length) return null; if (matches.length===1) return matches[0];
  const sectionKey=normalizeSectionKey(section), basicKeys=parseBasicAssignments(basic).map(normalizeTitle);
  return matches.map(item => { const sheetKey=normalizeSectionKey(item.sheet), itemBasic=normalizeTitle(item.basic); let score=0; if(basicKeys.includes(itemBasic))score+=5; if(sectionKey&&sheetKey===sectionKey)score+=5; if(sectionKey&&sheetKey.includes(sectionKey))score+=3; if(sectionKey&&sectionKey.includes(sheetKey))score+=2; return {item,score}; }).sort((a,b)=>b.score-a.score)[0].item;
}
function createTaskKey(section,basic,title){ return `${normalizeTitle(section)}::${normalizeTitle(basic)}::${normalizeTitle(title)}`; }
function formatDateTime(value){ const d=new Date(value); if(Number.isNaN(d.getTime())) return String(value||""); return new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(d); }
function csvCell(value){ const text=String(value??""); return `"${text.replaceAll('"','""')}"`; }
function pick(object,keys){ if(!object||typeof object!=="object")return""; for(const key of keys){const value=object[key];if(value!==undefined&&value!==null&&String(value).trim()!=="")return String(value).trim();}return""; }
function uniqueSorted(values){ return [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id",{numeric:true,sensitivity:"base"})); }
function sortLevels(values){ const order=["Entry Level","OJT","Level 1","Level 2","Level 3","Level 4","Level 5"]; return values.sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);if(ai!==-1||bi!==-1)return(ai===-1?999:ai)-(bi===-1?999:bi);return a.localeCompare(b,"id",{numeric:true});}); }
function sortBasics(values){ return values.sort((a,b)=>Number((a.match(/\d+/)||[999])[0])-Number((b.match(/\d+/)||[999])[0])); }
function normalize(value){ return String(value??"").toLowerCase().trim().replace(/\s+/g," "); }
function normalizeTitle(value){ return String(value??"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," "); }
function parseBasicAssignments(value){ const raw=String(value??"").trim(); if(!raw)return[]; if(/basic/i.test(raw)){const numbers=raw.match(/\d+/g)||[];if(numbers.length)return[...new Set(numbers.map(number=>`Basic ${number}`))];} return raw.split(/[,;/\n]+/).map(item=>item.trim()).filter(Boolean); }
function normalizeSectionKey(value){ return normalizeTitle(String(value??"").replace(/&/g," and ")); }
function safeURL(value){ const raw=String(value??"").trim(); if(!raw)return""; try{const url=new URL(raw);return["http:","https:"].includes(url.protocol)?url.href:"";}catch{return"";} }
function escapeHTML(value){ return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function escapeAttribute(value){ return escapeHTML(value); }
