const API = "https://script.google.com/macros/s/AKfycbxbaop9HbasKeMj1d9CqG9jjTqJRq68Gv3f-8zaVobcbv6pDW3LRu4IJpFezpO2nFRi/exec";

const searchInput = document.getElementById("search");
const searchButton = document.getElementById("search-button");
const participantsList = document.getElementById("participants");
const resultArea = document.getElementById("result");
const statusArea = document.getElementById("status");

const catalog = Array.isArray(window.TRAINING_CATALOG) ? window.TRAINING_CATALOG : [];
const catalogByTitle = new Map();

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

async function loadParticipants() {
  try {
    const response = await fetch(`${API}?action=participants`);
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
    // Autocomplete bersifat tambahan. Pencarian NIK tetap dapat digunakan.
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

  if (keyword.includes("-")) {
    keyword = keyword.split("-").pop().trim();
  }

  setLoading(true);
  resultArea.innerHTML = "";
  setStatus("Mengambil data peserta...");

  try {
    const response = await fetch(`${API}?action=search&keyword=${encodeURIComponent(keyword)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();

    if (!payload?.status || !payload?.data) {
      setStatus("Data peserta tidak ditemukan. Periksa kembali NIK atau nama.", true);
      return;
    }

    renderJourney(payload.data);
    setStatus("");
    requestAnimationFrame(() => {
      resultArea.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  const rows = modules.length
    ? modules.map(module => taskRow(module)).join("")
    : `<div class="empty-state">Belum ada daftar materi yang ditemukan untuk peserta ini.</div>`;

  resultArea.innerHTML = `
    <article class="journey-card">
      <div class="journey-top">
        <div>
          <h2 class="person-name">${escapeHTML(nama)}</h2>
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Nama</span>
              <span class="meta-value">${escapeHTML(nama)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">NIK</span>
              <span class="meta-value">${escapeHTML(nik)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Section</span>
              <span class="meta-value">${escapeHTML(section)}</span>
            </div>
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

      ${modules.length ? `
      <div class="task-list">
        <div class="task-header" aria-hidden="true">
          <span>Judul</span>
          <span>Link Post Test</span>
          <span>Modul</span>
        </div>
        ${rows}
      </div>` : rows}
    </article>
  `;
}

function taskRow(module) {
  const title = module.title || "Materi Training";
  const postTest = safeURL(module.postTest);
  const moduleLink = safeURL(module.moduleLink);

  return `
    <div class="task-row">
      <div class="task-title">${escapeHTML(title)}</div>
      <div class="task-action post-test">
        ${actionLink(postTest, "Buka Post Test", "")}
      </div>
      <div class="task-action module">
        ${actionLink(moduleLink, "Buka Modul", "module-link")}
      </div>
    </div>
  `;
}

function actionLink(url, label, extraClass) {
  if (!url) {
    return `<span class="action-link disabled ${extraClass}" aria-disabled="true">Belum tersedia</span>`;
  }
  return `<a class="action-link ${extraClass}" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function enrichModule(module, section, basic) {
  const title = pick(module, ["module", "title", "namaModul", "nama_modul", "name", "judul"]) || "Materi Training";
  let postTest = pick(module, ["postTest", "post_test", "posttest", "linkPostTest", "link_post_test", "postTestLink", "linkPosttest"]);
  let moduleLink = pick(module, ["moduleLink", "linkModul", "link_modul", "modul", "link", "url"]);

  const matches = catalogByTitle.get(normalizeTitle(title)) || [];
  const best = chooseCatalogMatch(matches, section, basic);

  if (!postTest && best?.postTest) postTest = best.postTest;
  if (!moduleLink && best?.moduleLink) moduleLink = best.moduleLink;

  // Jika backend hanya mengirim satu link pada field `link`, gunakan katalog untuk
  // membedakan Link Modul dan Link Post Test berdasarkan judul materi.
  if (best && normalizeURL(moduleLink) === normalizeURL(best.postTest) && best.moduleLink) {
    moduleLink = best.moduleLink;
  }

  return { title, postTest, moduleLink };
}

function chooseCatalogMatch(matches, section, basic) {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  const sectionKey = normalizeTitle(section);
  const basicKey = normalizeTitle(basic);
  const scored = matches.map(item => {
    let score = 0;
    const sheetKey = normalizeTitle(item.sheet);
    const itemBasic = normalizeTitle(item.basic);
    if (basicKey && itemBasic === basicKey) score += 5;
    if (sectionKey && sheetKey === sectionKey) score += 5;
    if (sectionKey && sheetKey.includes(sectionKey)) score += 3;
    if (sectionKey && sectionKey.includes(sheetKey)) score += 2;
    return { item, score };
  });
  scored.sort((a,b) => b.score - a.score);
  return scored[0].item;
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
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeURL(value) {
  return String(value ?? "").trim().replace(/\/$/, "");
}

function safeURL(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

function setStatus(message, isError = false) {
  statusArea.textContent = message;
  statusArea.classList.toggle("error", isError);
}

function setLoading(isLoading) {
  searchButton.disabled = isLoading;
  searchButton.textContent = isLoading ? "Memuat..." : "Tampilkan";
}
