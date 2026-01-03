// ===============================
// Firebase init
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyAAM6p7EURXaNLDMce-zbTXa264iSwMtzc",
  authDomain: "familie-kalender-e36c7.firebaseapp.com",
  projectId: "familie-kalender-e36c7",
  storageBucket: "familie-kalender-e36c7.firebasestorage.app",
  messagingSenderId: "1081525919848",
  appId: "1:1081525919848:web:7fe054cff5fccc7a0bdbdd",
  measurementId: "G-E640JQLVT0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===============================
// Calendar doc id
// ===============================
function cellDocId(person, date) {
  return `${person}_${date}`;
}

// ===============================
// UI cleanup (brukes av refresh)
// ===============================
function clearCalendarUI() {
  document.querySelectorAll(".entries").forEach(e => e.remove());
  document.querySelectorAll(".more-indicator").forEach(e => e.remove());
}

// ===============================
// Firebase save/load
// ===============================
async function saveCellToFirebase(cell) {
  const person = cell.dataset.person;

  // Bruk dataset.date (mer robust enn å lete i DOM)
  const date = cell.dataset.date ||
    cell.closest(".calendar-grid")?.querySelector(".cell.day")?.dataset.date;

  if (!person || !date) return;

  const docId = cellDocId(person, date);

  const entries = [];
  cell.querySelectorAll(".entry").forEach(entry => {
    entries.push({
      keyword: entry.textContent,
      description: entry.dataset.description || ""
    });
  });

  if (entries.length === 0) {
    await db.collection("calendar").doc(docId).delete();
    return;
  }

  await db.collection("calendar").doc(docId).set({
    person,
    date,
    entries
  });
}

async function loadCalendarFromFirebase() {
  // Rydd kun visning (ikke alt i DOM)
  document.querySelectorAll(".cell-click .entries").forEach(e => e.remove());
  document.querySelectorAll(".more-indicator").forEach(e => e.remove());

  const { start, end } = getWeekRange();

  const snapshot = await db.collection("calendar")
    .where("date", ">=", start)
    .where("date", "<=", end)
    .get();

  snapshot.forEach(doc => {
    const data = doc.data();

    const cell = document.querySelector(
      `.cell-click[data-person="${data.person}"][data-date="${data.date}"]`
    );
    if (!cell) return;

    const old = cell.querySelector(".entries");
    if (old) old.remove();

    const container = document.createElement("div");
    container.className = "entries";

    data.entries.forEach(item => {
      const entry = document.createElement("div");
      entry.className = "entry";
      entry.textContent = item.keyword;
      entry.dataset.description = item.description || "";

      container.appendChild(entry);
    });

    cell.appendChild(container);
    updateMoreIndicator(container);
  });
}

// ===============================
// Kalender – state
// ===============================
let activePerson = null;
let editingEntry = null;
let activeCell = null;
let activeWeekStart = getMonday(new Date());

// ===============================
// Modal hooks
// ===============================
const modal = document.getElementById("cellModal");
const modalTitle = document.getElementById("modalTitle");

const keywordInput = document.getElementById("keywordInput");
const textInput = document.getElementById("textInput");

const saveBtn = document.getElementById("saveBtn");
const closeBtn = document.getElementById("closeBtn");
const deleteBtn = document.getElementById("deleteBtn");

// Start-modus (valg)
const modalStart = document.getElementById("modalStart");
const btnNew = document.getElementById("btnNew");
const btnView = document.getElementById("btnView");
const btnEdit = document.getElementById("btnEdit");

const modalView = document.getElementById("modalView");
const viewContent = document.getElementById("viewContent");

const modalEdit = document.getElementById("modalEdit");
const editContent = document.getElementById("editContent");
const saveAllBtn = document.getElementById("saveAllBtn");

const infoModal = document.getElementById("infoModal");
const infoTitle = document.getElementById("infoModalTitle");
const infoDescription = document.getElementById("infoModalDescription");
const infoClose = document.getElementById("infoModalClose");

const weekNoteInput = document.querySelector(".notes-section.free textarea");



if (infoModal && infoClose) {
  infoClose.addEventListener("click", closeInfoModal);

  infoModal.addEventListener("click", (e) => {
    if (e.target === infoModal) {
      closeInfoModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !infoModal.classList.contains("hidden")) {
      closeInfoModal();
    }
  });
}




// ===============================
// Sikkerhet: gi tydelig feil i console
// ===============================
function assertEl(el, name) {
  if (!el) console.error(`Mangler element i HTML: ${name}`);
}
[
  [modal, "cellModal"],
  [modalTitle, "modalTitle"],
  [keywordInput, "keywordInput"],
  [textInput, "textInput"],
  [saveBtn, "saveBtn"],
  [closeBtn, "closeBtn"],
  [deleteBtn, "deleteBtn"],
  [modalStart, "modalStart"],
  [btnNew, "btnNew"],
  [btnView, "btnView"],
  [btnEdit, "btnEdit"],
  [modalView, "modalView"],
  [viewContent, "viewContent"],
  [modalEdit, "modalEdit"],
  [editContent, "editContent"],
  [saveAllBtn, "saveAllBtn"]
].forEach(([el, name]) => assertEl(el, name));

// ===============================
// UI helpers
// ===============================
function hideCreateEditViews() {
  saveBtn.style.display = "none";
  deleteBtn.style.display = "none";
}


function showCreateView() {
  editingEntry = null;

  // Skjul start-valg
  modalStart.style.display = "none";

  // Sett riktig modus
  modal.classList.add("create");
  modal.classList.remove("view-only", "edit");

  // Overskrift
  modalTitle.textContent = "Ny oppføring";

  // 🔥 VIS KUN create-feltene
  modalView.classList.remove("active");
  modalEdit.classList.add("active");

  // 🔥 SKJUL REDIGERINGSKORT
  editContent.innerHTML = "";
  editContent.style.display = "none";

  // Knapper
  saveBtn.style.display = "inline-block";
  closeBtn.style.display = "inline-block";

  deleteBtn.style.display = "none";
  saveAllBtn.style.display = "none";
  
  document.querySelectorAll("#personSelector input").forEach(cb => {
  cb.checked = cb.value === activePerson;
});

}

function closeInfoModal() {
  if (infoModal) {
    infoModal.classList.add("hidden");
  }
}

if (infoModal && infoClose) {

  // Klikk på Lukk-knapp
  infoClose.addEventListener("click", closeInfoModal);

  // Klikk utenfor boksen
  infoModal.addEventListener("click", (e) => {
    if (e.target === infoModal) {
      closeInfoModal();
    }
  });

  // ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !infoModal.classList.contains("hidden")) {
      closeInfoModal();
    }
  });

}

function showStartMode(hasEntries) {
  modal.classList.remove("create", "view-only", "edit");
  

  modalStart.style.display = "flex";   // 👈 VIKTIG
  modalStart.classList.add("active");

  modalView.classList.remove("active");
  modalEdit.classList.remove("active");

  btnNew.style.display = "inline-block";
  btnView.style.display = hasEntries ? "inline-block" : "none";
  btnEdit.style.display = hasEntries ? "inline-block" : "none";
  
    // 🔥 SKJUL HANDLINGSKNAPPER I START-MODUS
  saveBtn.style.display = "none";
  deleteBtn.style.display = "none";
  saveAllBtn.style.display = "none";

}

function getWeekKey(date) {
  return date.toISOString().slice(0, 10); // mandag i uken
}

let weekNoteTimeout = null;

if (weekNoteInput) {
  weekNoteInput.addEventListener("input", () => {
    clearTimeout(weekNoteTimeout);

    weekNoteTimeout = setTimeout(async () => {
      const text = weekNoteInput.value.trim();
      const weekKey = getWeekKey(activeWeekStart);
      const docRef = db.collection("weekNotes").doc(weekKey);

      if (text === "") {
        await docRef.delete(); // tomt = slett
      } else {
        await docRef.set({ text });
      }
    }, 600); // lagrer etter 600 ms pause
  });
}

loadWeekNote();

async function loadWeekNote() {
  if (!weekNoteInput) return;

  const weekKey = getWeekKey(activeWeekStart);

  const docRef = db.collection("weekNotes").doc(weekKey);
  const snap = await docRef.get();

  if (snap.exists) {
    weekNoteInput.value = snap.data().text || "";
  } else {
    weekNoteInput.value = "";
  }
}


function updateCellDates() {
  document.querySelectorAll(".calendar-grid").forEach(grid => {
    const dayCell = grid.querySelector(".cell.day");
    if (!dayCell) return;

    const date = dayCell.dataset.date;
    if (!date) return;

    grid.querySelectorAll(".cell-click").forEach(cell => {
      cell.dataset.date = date;
    });
  });
}



// ===============================
// Dato / uke
// ===============================
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date) {
  return date.toLocaleDateString("no-NO", {
    day: "numeric",
    month: "short"
  });
}

function updateDayHeaders() {
  const dayNames = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
  const dayCells = document.querySelectorAll(".cell.day");

  dayCells.forEach((cell, index) => {
    const date = new Date(activeWeekStart);
    date.setDate(activeWeekStart.getDate() + index);

    let nameEl = cell.querySelector(".day-name");
    let dateEl = cell.querySelector(".day-date");

    // Hvis strukturen mangler (robusthet)
    if (!nameEl) {
      nameEl = document.createElement("div");
      nameEl.className = "day-name";
      cell.appendChild(nameEl);
    }

    if (!dateEl) {
      dateEl = document.createElement("div");
      dateEl.className = "day-date";
      cell.appendChild(dateEl);
    }

    nameEl.textContent = dayNames[index];
    dateEl.textContent = formatDate(date);

    cell.dataset.date = date.toISOString().slice(0, 10);
  });
}


function updateMonthLabel() {
  const ml = document.getElementById("monthLabel");
  if (!ml) return;

  const month = activeWeekStart.toLocaleDateString("no-NO", {
    month: "long"
  });

  const year = activeWeekStart.getFullYear();

  ml.textContent = month.toUpperCase();
  ml.dataset.year = year;
}


function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function updateWeekLabel() {
  const weekNr = getWeekNumber(activeWeekStart);

  const wl = document.getElementById("weekLabel");
  if (wl) wl.textContent = `Uke ${weekNr}`;

  const gridLabel = document.getElementById("weekLabelGrid");
  if (gridLabel) gridLabel.textContent = `Uke ${weekNr}`;
}

function getISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekRange() {
  const start = new Date(activeWeekStart);
  const end = new Date(activeWeekStart);
  end.setDate(start.getDate() + 6);

  return {
    start: getISODate(start),
    end: getISODate(end)
  };
}

document.querySelectorAll(".cell-click").forEach(cell => {
  cell.addEventListener("click", (e) => {

    // 🔒 KRITISK: ignorér klikk som kommer fra stikkord
    if (e.target.closest(".entry")) return;

    document.querySelectorAll(".cell-click").forEach(c => {
      c.classList.remove("active-cell");
    });

    activeCell = cell;
    activePerson = cell.dataset.person;
    editingEntry = null;

    const date = cell.dataset.date;
    modalTitle.textContent =
      `${activePerson} – ${formatDate(new Date(date))}`;

    keywordInput.value = "";
    textInput.value = "";

    modalStart.style.display = "flex";

    const hasEntries = !!cell.querySelector(".entry");
    showStartMode(hasEntries);

    modal.classList.remove("hidden");
  });
});



// ===============================
// Felles refresh (NAVIGASJON)
// ===============================
function refreshCalendar() {
  const container = document.querySelector(".calendar-container");
  const selector = document.querySelector(".week-selector");

  if (!container) return;

  // 🔮 Trigger uke-portal SPIN umiddelbart
  if (selector) {
    selector.classList.remove("spin");
    void selector.offsetWidth; // tving reflow
    selector.classList.add("spin");
  }

  // Fade ut kalender
  container.classList.add("week-exit");

  setTimeout(() => {
    updateWeekLabel();
    updateMonthLabel();
    updateDayHeaders();
    updateCellDates();
    clearCalendarUI();
    loadCalendarFromFirebase();

    container.classList.remove("week-exit");
    container.classList.add("week-enter");

    setTimeout(() => {
      container.classList.remove("week-enter");
    }, 250);

  }, 150);
}


// ===============================
// +N indikator
// ===============================
function updateMoreIndicator(container) {
  if (!container) return;

  // Fjern eksisterende indikator
  const old = container.querySelector(".more-indicator");
  if (old) old.remove();

  // Finn entries (kun chips)
  const entries = Array.from(container.querySelectorAll(".entry"));
  if (entries.length === 0) return;

  // 1) Vis ALLE først (så vi måler riktig)
  entries.forEach(e => (e.style.display = ""));

  // 2) Vent til layout er oppdatert før vi måler
  requestAnimationFrame(() => {
    const rect = container.getBoundingClientRect();
    const maxBottom = rect.top + container.clientHeight; // faktisk synlig høyde i containeren

    // Tillat maks 2 rader (basert på offsetTop-endring)
    let rows = 1;
    let lastTop = null;

    let visibleCount = 0;

    for (const entry of entries) {
      const eRect = entry.getBoundingClientRect();

      // Ny rad når top endrer seg (toleranse pga subpixel)
      if (lastTop === null) lastTop = entry.offsetTop;
      if (Math.abs(entry.offsetTop - lastTop) > 1) {
        rows++;
        lastTop = entry.offsetTop;
      }

      // Skjul alt på rad 3+ uansett
      if (rows > 2) {
        entry.style.display = "none";
        continue;
      }

      // Ekstra sikkerhet: hvis den likevel havner under synlig område, skjul
      if (eRect.bottom > maxBottom + 1) {
        entry.style.display = "none";
        continue;
      }

      visibleCount++;
    }

    const hiddenCount = entries.length - visibleCount;
    if (hiddenCount <= 0) return;

    const indicator = document.createElement("div");
    indicator.className = "more-indicator";
    indicator.textContent = `+${hiddenCount}`;
    container.appendChild(indicator);
  });
}


// ===============================
// Modal visning/redigering
// ===============================
function showEditMode(cell) {
  // ⛔ VIKTIG: fjern ALLE andre modi først
  modal.classList.remove("create", "view-only");
  modal.classList.add("edit");

  // Vis rediger-innhold
  editContent.style.display = "block";

  // Skjul start-modus
  modalStart.style.display = "none";
  modalStart.classList.remove("active");

  // Overskrift
  modalTitle.textContent = "Rediger innhold";

  // Riktig seksjon aktiv
  modalView.classList.remove("active");
  modalEdit.classList.add("active");

  // Riktige knapper
  saveBtn.style.display = "none";
  deleteBtn.style.display = "none";
  saveAllBtn.style.display = "inline-block";
  closeBtn.style.display = "inline-block";

  // Bygg redigeringskort
  editContent.innerHTML = "";
  const entries = cell.querySelectorAll(".entry");

  if (entries.length === 0) {
    editContent.innerHTML = "<p>Ingen oppføringer.</p>";
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement("div");
    card.className = "edit-card";

    const keyword = document.createElement("input");
    keyword.value = entry.textContent;

    const desc = document.createElement("textarea");
    desc.value = entry.dataset.description || "";

    const del = document.createElement("button");
    del.textContent = "Slett";
    del.className = "delete-entry";

    del.addEventListener("click", () => {
      entry.remove();
      card.remove();

      const container = activeCell.querySelector(".entries");
      if (container) updateMoreIndicator(container);
    });

    card.appendChild(keyword);
    card.appendChild(desc);
    card.appendChild(del);

    card._entry = entry;
    editContent.appendChild(card);
  });
}


function showViewMode(cell) {
  modal.classList.add("view-only");
  modal.classList.remove("create", "edit");

  // Skjul start-knapper
  modalStart.style.display = "none";
  modalStart.classList.remove("active");

  // Overskrift
  modalTitle.textContent = "Innhold";

  // Vis kun view-seksjonen
  modalView.classList.add("active");
  modalEdit.classList.remove("active");
  viewContent.innerHTML = "";

  // 🔥 KUN Avbryt i "Se innhold"
  closeBtn.style.display = "inline-block";  // Avbryt

  // 🔒 Skjul ALT annet
  saveBtn.style.display = "none";
  deleteBtn.style.display = "none";
  saveAllBtn.style.display = "none";

  const entries = cell.querySelectorAll(".entry");
  if (entries.length === 0) {
    viewContent.textContent = "Ingen oppføringer.";
    return;
  }

  entries.forEach(entry => {
    const item = document.createElement("div");
    item.className = "view-item";

    const title = document.createElement("h4");
    title.textContent = entry.textContent;

    const desc = document.createElement("p");
    desc.textContent = entry.dataset.description || "";

    item.appendChild(title);
    item.appendChild(desc);
    viewContent.appendChild(item);
  });
}

// ===============================
// Klikk på celle => åpne modal start
// ===============================
document.querySelectorAll(".cell-click").forEach(cell => {
  cell.addEventListener("click", () => {

    // 🔒 VIKTIG: stopp hvis info-modalen er åpen
    if (!infoModal.classList.contains("hidden")) return;

    document.querySelectorAll(".cell-click").forEach(c => {
      c.classList.remove("active-cell");
    });

    activeCell = cell;
    activePerson = cell.dataset.person;
    editingEntry = null;

    const date = cell.dataset.date;
    modalTitle.textContent = `${activePerson} – ${formatDate(new Date(date))}`;

    keywordInput.value = "";
    textInput.value = "";

    modalStart.style.display = "flex";

    const hasEntries = !!cell.querySelector(".entry");
    showStartMode(hasEntries);

    modal.classList.remove("hidden");
  });
});



// ===============================
// Start-knapper
// ===============================
btnNew.addEventListener("click", () => {
  editingEntry = null;
  modalTitle.textContent = "Ny oppføring";
  showCreateView();
});

btnView.addEventListener("click", () => {
  if (!activeCell) return;
  modalTitle.textContent = "Innhold";
  showViewMode(activeCell);
});

btnEdit.addEventListener("click", () => {
  if (!activeCell) return;
  modalTitle.textContent = "Rediger innhold";
  showEditMode(activeCell);
});
deleteBtn.addEventListener("click", () => {
  if (!editingEntry) return;

  const container = editingEntry.parentElement;
  editingEntry.remove();
  editingEntry = null;

  if (container.children.length === 0) {
    container.remove();
  } else {
    updateMoreIndicator(container);
  }

  saveCellToFirebase(activeCell);
  modal.classList.add("hidden");
});


// Bulk-lagre redigeringskort
saveAllBtn.addEventListener("click", () => {
  const cards = editContent.querySelectorAll(".edit-card");

  cards.forEach(card => {
    const entry = card._entry;
    const inputs = card.querySelectorAll("input, textarea");

    const newKeyword = inputs[0].value.trim();
    const newDesc = inputs[1].value.trim();

    if (!newKeyword) {
      entry.remove();
      return;
    }

    entry.textContent = newKeyword;
    entry.dataset.description = newDesc;
  });

  const container = activeCell.querySelector(".entries");
  if (container) updateMoreIndicator(container);

  saveCellToFirebase(activeCell);
  modal.classList.add("hidden");
});

// ===============================
// Lagre (ny / rediger)
// ===============================
saveBtn.addEventListener("click", () => {
  const keyword = keywordInput.value.trim();
  const description = textInput.value.trim();
  if (!keyword) return;

  // ===============================
  // REDIGER eksisterende (uendret)
  // ===============================
  if (editingEntry) {
    editingEntry.textContent = keyword;
    editingEntry.dataset.description = description;

    updateMoreIndicator(editingEntry.parentElement);
    saveCellToFirebase(activeCell);

    editingEntry = null;
    modal.classList.add("hidden");
    return;
  }

  // ===============================
  // NY oppføring (én → flere personer)
  // ===============================
  if (!activeCell) return;

  const date = activeCell.dataset.date;

  // Hent valgte personer
  const selectedPersons = Array.from(
    document.querySelectorAll("#personSelector input:checked")
  ).map(cb => cb.value);

  if (selectedPersons.length === 0) {
    alert("Velg minst én person");
    return;
  }

  selectedPersons.forEach(person => {
    const cell = document.querySelector(
      `.cell-click[data-person="${person}"][data-date="${date}"]`
    );
    if (!cell) return;

    let container = cell.querySelector(".entries");
    if (!container) {
      container = document.createElement("div");
      container.className = "entries";
      cell.appendChild(container);
    }

const entry = document.createElement("div");
entry.className = "entry";
entry.textContent = keyword;
entry.dataset.description = description;

container.appendChild(entry);
updateMoreIndicator(container);
saveCellToFirebase(cell);
  }); // ← avslutter selectedPersons.forEach

  modal.classList.add("hidden");
}); // ← avslutter saveBtn.addEventListener


// ===============================
// Slett (kun i rediger-modus for enkeltoppføring)
// ===============================

// ===============================
// Lukk modal
// ===============================
closeBtn.addEventListener("click", () => {
  editingEntry = null;
  modalStart.classList.remove("active");
  modalView.classList.remove("active");
  modalEdit.classList.remove("active");
  modal.classList.add("hidden");
});

// ===============================
// Month picker (slide-in) + år/måned
// ===============================
const monthLabel = document.getElementById("monthLabel");
const monthPicker = document.getElementById("monthPicker");
const yearSelect = document.getElementById("yearSelect");

// ===== ÅR-STATE (NYTT)
let activeYear = activeWeekStart.getFullYear();

// ===== ÅR-KNAPPER
const prevYearBtn = document.getElementById("prevYear");
const nextYearBtn = document.getElementById("nextYear");
const yearLabelEl = document.getElementById("yearLabel");

function updateYearLabel() {
  if (yearLabelEl) {
    yearLabelEl.textContent = activeYear;
  }
}

updateYearLabel();

if (prevYearBtn) {
  prevYearBtn.addEventListener("click", () => {
    activeYear--;
    updateYearLabel();
  });
}

if (nextYearBtn) {
  nextYearBtn.addEventListener("click", () => {
    activeYear++;
    updateYearLabel();
  });
}


if (yearSelect) {
  yearSelect.innerHTML = "";
  for (let y = 2020; y <= 2035; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }
}

function openMonthPicker() {
  if (!monthPicker) return;
  // synk dropdown til aktuell uke
  if (yearSelect) yearSelect.value = String(activeWeekStart.getFullYear());
  monthPicker.classList.add("open");
}

function closeMonthPicker() {
  if (!monthPicker) return;
  monthPicker.classList.remove("open");
}

if (monthLabel) {
  monthLabel.addEventListener("click", () => {
    if (!monthPicker) return;
    if (monthPicker.classList.contains("open")) closeMonthPicker();
    else openMonthPicker();
  });
}

// Klikk på måned i panelet
document.querySelectorAll(".month-grid button").forEach(btn => {
  btn.addEventListener("click", () => {
    const month = Number(btn.dataset.month);
const year = activeYear;

    activeWeekStart = getMonday(new Date(year, month, 1));
    refreshCalendar();
    closeMonthPicker();
  });
});

// ===============================
// Uke-navigasjon (høyre + venstre hjørne)
// ===============================
function goPrevWeek() {
  activeWeekStart.setDate(activeWeekStart.getDate() - 7);
  refreshCalendar();
}
function goNextWeek() {
  activeWeekStart.setDate(activeWeekStart.getDate() + 7);
  refreshCalendar();
}

const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");
if (prevWeekBtn) prevWeekBtn.onclick = goPrevWeek;
if (nextWeekBtn) nextWeekBtn.onclick = goNextWeek;

const prevWeekGridBtn = document.getElementById("prevWeekGrid");
const nextWeekGridBtn = document.getElementById("nextWeekGrid");
if (prevWeekGridBtn) prevWeekGridBtn.onclick = goPrevWeek;
if (nextWeekGridBtn) nextWeekGridBtn.onclick = goNextWeek;

document.addEventListener("click", (e) => {
  const entry = e.target.closest(".entry");
  if (!entry) return;

  // ⛔ STOPP ALLE ANDRE KLIKK
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // 🔒 Sørg for at celle-modalen er lukket
  modal.classList.add("hidden");

  infoTitle.textContent = entry.textContent;
  infoDescription.textContent =
    entry.dataset.description || "Ingen beskrivelse.";

  infoModal.classList.remove("hidden");
});


document.querySelectorAll(".cell-click").forEach(cell => {
  cell.addEventListener("click", (e) => {

    // 🔒 VIKTIG: ignorer klikk som kommer fra entry
    if (e.target.closest(".entry")) return;

    document.querySelectorAll(".cell-click").forEach(c => {
      c.classList.remove("active-cell");
    });

    activeCell = cell;
    activePerson = cell.dataset.person;
    editingEntry = null;

    const date = cell.dataset.date;
    modalTitle.textContent = `${activePerson} – ${formatDate(new Date(date))}`;

    keywordInput.value = "";
    textInput.value = "";

    modalStart.style.display = "flex";

    const hasEntries = !!cell.querySelector(".entry");
    showStartMode(hasEntries);

    modal.classList.remove("hidden");
  });
});

function showDailyQuote() {
  const el = document.getElementById("dailyQuote");
  if (!el) return;

  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;

  for (let i = 0; i < today.length; i++) {
    hash += today.charCodeAt(i);
  }

  const index = hash % quotes.length;
  el.textContent = quotes[index];
}

showDailyQuote();

// ===============================
// Init
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  refreshCalendar();
  loadWeekNote();
});