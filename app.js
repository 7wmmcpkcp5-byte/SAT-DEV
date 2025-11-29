// SAT-DEV – entorno de desarrollo con login usuario + PIN
// Todo el progreso se guarda por usuario en localStorage.

const STORAGE_KEY = "sat_dev_state_v1";
const MISTAKES_KEY = "sat_dev_mistakes_v1";
const BANK_OVERRIDE_KEY = "sat_dev_bank_override_v1";

let currentUser = null; // { username, isAdmin }
let appState = loadState();
let mistakes = loadMistakes();
let bankOverride = loadBankOverride();

// --- State helpers -------------------------------------------------------

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function loadMistakes() {
  try {
    return JSON.parse(localStorage.getItem(MISTAKES_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMistakes() {
  localStorage.setItem(MISTAKES_KEY, JSON.stringify(mistakes));
}

function loadBankOverride() {
  try {
    return JSON.parse(localStorage.getItem(BANK_OVERRIDE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBankOverride() {
  localStorage.setItem(BANK_OVERRIDE_KEY, JSON.stringify(bankOverride));
}

function getUserState(username) {
  if (!appState[username]) {
    appState[username] = {
      answered: 0,
      correct: 0,
    };
  }
  return appState[username];
}

// --- Login ---------------------------------------------------------------

async function handleLogin() {
  const usernameInput = document.getElementById("login-username");
  const pinInput = document.getElementById("login-pin");
  const errorEl = document.getElementById("login-error");

  const username = (usernameInput.value || "").trim();
  const pin = (pinInput.value || "").trim();

  if (!username || !pin) {
    errorEl.textContent = "Introduce usuario y PIN.";
    return;
  }

  try {
    const users = await fetch("users.json").then((r) => r.json());
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === username.toLowerCase() &&
        u.pin === pin
    );
    if (!user) {
      errorEl.textContent = "Usuario o PIN incorrectos.";
      return;
    }

    currentUser = {
      username: user.username,
      isAdmin: user.role === "admin",
    };

    usernameInput.value = "";
    pinInput.value = "";
    errorEl.textContent = "";

    enterApp();
  } catch (err) {
    console.error(err);
    errorEl.textContent = "No se pudo leer users.json";
  }
}

function enterApp() {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("main-view").classList.remove("hidden");

  document.getElementById(
    "user-label"
  ).textContent = `${currentUser.username} ${
    currentUser.isAdmin ? "(Admin)" : ""
  }`;

  updateDashboard();
  renderMistakesList();
  // Si no es admin, deshabilitamos pestaña Dev
  const devTabBtn = document.querySelector('nav.tabs button[data-tab="dev"]');
  devTabBtn.disabled = !currentUser.isAdmin;
}

function logout() {
  currentUser = null;
  document.getElementById("main-view").classList.add("hidden");
  document.getElementById("login-view").classList.remove("hidden");
}

// --- Tabs ----------------------------------------------------------------

function setupTabs() {
  const buttons = document.querySelectorAll("nav.tabs button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tabName = btn.dataset.tab;
      document
        .querySelectorAll("section.tab")
        .forEach((s) => s.classList.remove("active"));
      document.getElementById(`tab-${tabName}`).classList.add("active");
    });
  });
}

// --- Question banks ------------------------------------------------------

// generate key like "math_level1"
function bankKey(section, level) {
  return `${section}_level${level}`;
}

async function loadBank(section, level) {
  const key = bankKey(section, level);

  // 1) override local
  if (bankOverride[key]) {
    return bankOverride[key];
  }

  // 2) fetch from JSON file
  const filename = `${section}_level${level}.json`;
  try {
    const data = await fetch(filename).then((r) => r.json());
    return data;
  } catch (err) {
    console.error(err);
    return [];
  }
}

function pickRandomQuestion(bank, username) {
  if (!bank || bank.length === 0) return null;

  // evitar repetición inmediata: simple barajado
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  // opcionalmente se podría evitar las del último intento.
  return shuffled[0];
}

// --- Render question / answer flow ---------------------------------------

function renderQuestion(section, level, containerId) {
  const container = document.getElementById(containerId);
  container.textContent = "Cargando banco...";

  loadBank(section, level).then((bank) => {
    if (!bank || bank.length === 0) {
      container.innerHTML =
        "<p>No hay preguntas en este banco todavía. Usa la pestaña Dev para añadir.</p>";
      return;
    }

    const q = pickRandomQuestion(bank, currentUser.username);
    if (!q) {
      container.innerHTML =
        "<p>No se pudo escoger pregunta. Revisa el formato del JSON.</p>";
      return;
    }

    container.innerHTML = "";

    const stem = document.createElement("p");
    stem.className = "question-stem";
    stem.textContent = q.question;
    container.appendChild(stem);

    const choicesDiv = document.createElement("div");
    choicesDiv.className = "choices";

    const feedback = document.createElement("p");
    feedback.className = "feedback";
    container.appendChild(choicesDiv);
    container.appendChild(feedback);

    const actionsRow = document.createElement("div");
    actionsRow.className = "actions-row";
    const nextBtn = document.createElement("button");
    nextBtn.className = "ghost small";
    nextBtn.textContent = "Siguiente pregunta";
    actionsRow.appendChild(nextBtn);
    container.appendChild(actionsRow);

    ["A", "B", "C", "D"].forEach((letter) => {
      if (!q.choices || !q.choices[letter]) return;
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = `${letter}) ${q.choices[letter]}`;
      btn.addEventListener("click", () =>
        handleAnswer(q, letter, feedback, section, level)
      );
      choicesDiv.appendChild(btn);
    });

    nextBtn.addEventListener("click", () =>
      renderQuestion(section, level, containerId)
    );
  });
}

function handleAnswer(q, chosen, feedbackEl, section, level) {
  if (!currentUser) return;

  const userState = getUserState(currentUser.username);
  userState.answered += 1;

  const correct = chosen === q.answer;
  if (correct) {
    userState.correct += 1;
    feedbackEl.textContent = "✅ Correcto";
    feedbackEl.classList.remove("bad");
    feedbackEl.classList.add("ok");
    // si estaba en errores, lo quitamos
    removeMistake(q.id, section, level);
  } else {
    feedbackEl.textContent = `❌ Incorrecto. Respuesta correcta: ${q.answer}`;
    feedbackEl.classList.remove("ok");
    feedbackEl.classList.add("bad");
    addMistake(q, section, level);
  }

  saveState();
  saveMistakes();
  updateDashboard();
  renderMistakesList();
}

// --- Mistakes ------------------------------------------------------------

function addMistake(q, section, level) {
  const u = currentUser.username;
  if (!mistakes[u]) mistakes[u] = [];
  const key = `${section}_${level}_${q.id}`;
  if (!mistakes[u].some((m) => m.key === key)) {
    mistakes[u].push({
      key,
      section,
      level,
      question: q.question,
      choices: q.choices,
      answer: q.answer,
    });
  }
}

function removeMistakeId(username, key) {
  if (!mistakes[username]) return;
  mistakes[username] = mistakes[username].filter((m) => m.key !== key);
}

function removeMistake(qid, section, level) {
  const key = `${section}_${level}_${qid}`;
  removeMistakeId(currentUser.username, key);
}

function renderMistakesList() {
  const container = document.getElementById("mistakes-list");
  if (!currentUser) {
    container.innerHTML = "<p>Inicia sesión.</p>";
    return;
  }

  const list = mistakes[currentUser.username] || [];
  if (list.length === 0) {
    container.innerHTML = "<p>No hay errores guardados. ¡Bien!</p>";
    return;
  }

  container.innerHTML = "";
  list.forEach((m) => {
    const card = document.createElement("article");
    card.className = "mistake-card";

    const stem = document.createElement("p");
    stem.className = "question-stem";
    stem.textContent = m.question;
    card.appendChild(stem);

    const choicesDiv = document.createElement("div");
    choicesDiv.className = "choices";
    ["A", "B", "C", "D"].forEach((letter) => {
      if (!m.choices || !m.choices[letter]) return;
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = `${letter}) ${m.choices[letter]}`;
      btn.addEventListener("click", () =>
        handleMistakeAnswer(m, letter, card)
      );
      choicesDiv.appendChild(btn);
    });
    card.appendChild(choicesDiv);

    const info = document.createElement("p");
    info.className = "feedback bad";
    info.textContent = `Respuesta correcta: ${m.answer}`;
    card.appendChild(info);

    container.appendChild(card);
  });
}

function handleMistakeAnswer(m, chosen, cardEl) {
  const isCorrect = chosen === m.answer;
  if (isCorrect) {
    removeMistakeId(currentUser.username, m.key);
    saveMistakes();
    renderMistakesList();
  } else {
    cardEl.classList.add("shake");
    setTimeout(() => cardEl.classList.remove("shake"), 300);
  }
}

// --- Dashboard -----------------------------------------------------------

function updateDashboard() {
  if (!currentUser) return;
  const st = getUserState(currentUser.username);
  const answered = st.answered || 0;
  const correct = st.correct || 0;

  document.getElementById("stat-answered").textContent = answered;
  document.getElementById("stat-accuracy").textContent =
    answered === 0 ? "0%" : Math.round((correct / answered) * 100) + "%";

  const list = mistakes[currentUser.username] || [];
  document.getElementById("stat-mistakes").textContent = list.length;
}

// --- Dev tools -----------------------------------------------------------

function setupDevTools() {
  const loadBtn = document.getElementById("dev-load-btn");
  const saveBtn = document.getElementById("dev-save-btn");

  loadBtn.addEventListener("click", async () => {
    if (!currentUser?.isAdmin) {
      alert("Dev tools solo para Admin.");
      return;
    }
    const section = document.getElementById("dev-section-select").value;
    const level = document.getElementById("dev-level-select").value;
    const key = bankKey(section, level);
    const bank = await loadBank(section, level);
    document.getElementById("dev-editor").value = JSON.stringify(
      bank,
      null,
      2
    );
  });

  saveBtn.addEventListener("click", () => {
    if (!currentUser?.isAdmin) {
      alert("Dev tools solo para Admin.");
      return;
    }
    const section = document.getElementById("dev-section-select").value;
    const level = document.getElementById("dev-level-select").value;
    const key = bankKey(section, level);

    try {
      const text = document.getElementById("dev-editor").value || "[]";
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        alert("El JSON debe ser un array de preguntas.");
        return;
      }
      bankOverride[key] = parsed;
      saveBankOverride();
      alert("Banco guardado localmente para este dispositivo.");
    } catch (err) {
      alert("JSON no válido. Revisa la sintaxis.");
    }
  });
}

// --- Sync button (solo fuerza guardado local) ----------------------------

function setupSync() {
  const btn = document.getElementById("sync-btn");
  btn.addEventListener("click", () => {
    saveState();
    saveMistakes();
    saveBankOverride();
    alert("Progreso guardado en este dispositivo.");
  });
}

// --- Bootstrap -----------------------------------------------------------

function setupLevelButtons() {
  document.querySelectorAll(".level-buttons button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      const level = btn.dataset.level;
      if (!currentUser) return;
      const containerId =
        section === "math"
          ? "math-question-area"
          : section === "reading"
          ? "reading-question-area"
          : "vocab-question-area";
      renderQuestion(section, level, containerId);
    });
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((err) => console.log("SW registration failed", err));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-btn").addEventListener("click", handleLogin);
  document
    .getElementById("logout-btn")
    .addEventListener("click", () => logout());
  document
    .getElementById("login-pin")
    .addEventListener("keyup", (e) => {
      if (e.key === "Enter") handleLogin();
    });

  setupTabs();
  setupLevelButtons();
  setupDevTools();
  setupSync();
  registerServiceWorker();
});
