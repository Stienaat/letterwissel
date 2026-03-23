/* =========================
   1. CONFIG & STATE
   ========================= */
const gridSize = 10;
const LONG_PRESS_TIME = 500;
const N = 10;
let grid = [];
let oplossing = [];
let woordenLijst = [];
let woordBag = null;
let selectedCell = null;
let level = 1;
let vasteCellen = new Set();
let correcteCellen = new Set();
let hintLetters = new Set();
let laatsteZet = null;
let strafpunten = 0;
let seconden = 0;
let timerGestart = false;
let timerInterval = null;
let woordenBestand = "woorden.txt";
let topScore = { 1: 500, 2: null, 3: null, 4: null, 5: null };
let longPressTimer = null;
let longPressTriggered = false;
let swapUitgevoerd = false;

let debugVisible = false;

/*DEBUGGER*/
function toggleDebug() {
    debugVisible = !debugVisible;
    document.getElementById("debugPanel").style.display = debugVisible ? "block" : "none";
    if (debugVisible) updateDebugPanel();
}
function updateDebugPanel() {
    if (!debugVisible) return;

    const panel = document.getElementById("debugPanel");

    panel.innerHTML = `
        <b>DEBUG</b><br>
		timerGestart: ${timerGestart}<br>
		seconden: ${seconden}<br>
		strafpunten: ${strafpunten}<br>	
        currentLanguage: ${currentLang}<br>
		level: ${level}<br>
    `;
}

document.addEventListener('touchmove', function (e) {
    if (e.scale !== 1) {
        e.preventDefault();
    }
}, { passive: false });

function randomSide() {
  const sides = ["L", "R", "O", "B"]; // Links, Rechts, Boven, Beneden
  return sides[Math.floor(Math.random() * sides.length)];
}

function highlightLevel(level) {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) return;

    toolbar.querySelectorAll("button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.level == level);
    });
}

/* =========================
   2. I18N HELPERS
   ========================= */

function getLang() {
  return localStorage.getItem("lang") || "nl";
}

function t(key) {
  return (window.i18n?.translations?.[getLang()]?.[key]) || key;
}

/* =========================
   3. RANDOM / WOORDDATA
   ========================= */

class ShuffleBagCooldown {
  constructor(words, cooldownShuffles = 4) {
    this.original = [...words];
    this.cooldownShuffles = cooldownShuffles;
    this.bag = [];
    this.cooldown = new Map();
    this.refill();
  }

  refill() {
    for (const [word, cd] of this.cooldown.entries()) {
      if (cd <= 1) this.cooldown.delete(word);
      else this.cooldown.set(word, cd - 1);
    }

    this.bag = this.original.filter(w => !this.cooldown.has(w));

    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  draw(n = 1) {
    const result = [];

    for (let i = 0; i < n; i++) {
      if (this.bag.length === 0) this.refill();

      const word = this.bag.pop();
      result.push(word);
      this.cooldown.set(word, this.cooldownShuffles);
    }

    return result;
  }
}

function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function laadWoorden() {
  const res = await fetch(woordenBestand);
  const text = await res.text();

  woordenLijst = text
    .split(/\r?\n/)
    .map(w => w.trim().toUpperCase())
    .filter(Boolean);
  woordBag = new ShuffleBagCooldown(woordenLijst, 3);
}

/* =========================
   4. SCORE / TIMER / SAVE
   ========================= */

function updateScore() {
document.getElementById("score").textContent =
  t("points") + ": " + strafpunten;
}

function updateTimer() {
  const min = Math.floor(seconden / 60);
  const sec = seconden % 60;
  document.getElementById("timer").textContent =
    t("time") + ": " + 
	String(min).padStart(2, "0") + 
	":" + 
	String(sec).padStart(2, "0");
}

function resetTimer() {
  seconden = 0;
  timerGestart = false;
  clearInterval(timerInterval);
  updateTimer();
}

function startTimer() {
  seconden = 0;
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    seconden++;
    updateTimer();
  }, 1000);
}

function startTimerIfNeeded() {
  if (!timerGestart) {
    startTimer();
    timerGestart = true;
  }
}

function voegSwapPuntToe() {
  strafpunten += 1;
  updateScore();
}

function voegHintPuntenToe() {
  strafpunten += 10;
  updateScore();
}

function loadtopScore() {
  const saved = localStorage.getItem("letterwissel_topScore");
  if (saved) topScore = JSON.parse(saved);
}

function savetopScore() {
  localStorage.setItem("letterwissel_topScore", JSON.stringify(topScore));
}

function updatetopScoreDisplay() {
  const el = document.getElementById("topScore");
  if (!el) return; // UI nog niet klaar → NIET crashen

  el.textContent =
    t("Top") + " L" + level + ": " + (topScore[level] ?? "-");
}

function updatetopScoreIfNeeded() {
  if (topScore[level] === null || strafpunten < topScore[level]) {
    topScore[level] = strafpunten;
    savetopScore();
    updatetopScoreDisplay();
  }
}

function bindtopScoreReset() {
  const el = document.getElementById("topScore");
  if (!el) return;

  el.addEventListener("dblclick", () => {
    topScore[level] = null;
    savetopScore();
    updatetopScoreDisplay();
  });
}

function saveGame() {
  localStorage.setItem("letterwissel_save", JSON.stringify({
    grid,
    oplossing,
    vasteCellen: Array.from(vasteCellen),
    level: Number(level),
    strafpunten: Number(strafpunten),
    seconden: Number(seconden),
    timerGestart: Boolean(timerGestart)
  }));
}

function loadGame() {
  const saved = localStorage.getItem("letterwissel_save");
  if (!saved) return false;

  const gameState = JSON.parse(saved);
  if (!gameState) return false;

  grid = gameState.grid;
  oplossing = gameState.oplossing;
  vasteCellen = new Set(gameState.vasteCellen || []);
  level = Number(gameState.level) || 1;
  strafpunten = Number(gameState.strafpunten) || 0;
  seconden = Number(gameState.seconden) || 0;
  timerGestart = Boolean(gameState.timerGestart);

  updateScore();
  renderGrid();
  highlightLevel(level);

  if (timerGestart) startTimer();

  return true;
}

/* =========================
   5. GRID / RENDER
   ========================= */

function cellKey(r, c) {
  return `${r}-${c}`;
}

function getCell(r, c) {
  return document.querySelector(`[data-row='${r}'][data-col='${c}']`);
}

function updateCell(r, c) {
  const cell = getCell(r, c);
  if (cell) cell.textContent = grid[r][c];
  const key = cellKey(r, c);
  if (vasteCellen.has(key)) {
    cell.classList.add("fixed", "hint");
  }
}

function lockCell(r, c) {
  const key = cellKey(r, c);
  vasteCellen.add(key);

  const cell = getCell(r, c);
  if (!cell) return;

  cell.classList.add("found");
  cell.classList.remove("selected");
  cell.style.pointerEvents = "none";
}

function createCell(r, c) {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.textContent = grid[r][c];
  cell.dataset.row = r;
  cell.dataset.col = c;

  if (vasteCellen.has(cellKey(r, c))) {
    cell.classList.add("found");
    cell.style.pointerEvents = "none";
  }

  return cell;
}

function renderGrid() {
  const container = document.getElementById("grid");
  container.innerHTML = "";

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      container.appendChild(createCell(r, c));
    }
  }
}

function aantalGroeneLetters(level) {
  return 6 - level;
}

function maakGrid() {
  selectedCell = null;
  vasteCellen.clear();
  hintLetters.clear();
  correcteCellen.clear();

  const woorden = woordBag.draw(gridSize);
  oplossing = woorden.map(w => w.split(""));
  grid = woorden.map(w => w.split(""));

  const vastePerRij = aantalGroeneLetters(level);
  const vastePosities = new Set();
  const losseLetters = [];

  for (let r = 0; r < gridSize; r++) {
    const posities = fisherYatesShuffle([...Array(gridSize).keys()]).slice(0, vastePerRij);

    for (let c = 0; c < gridSize; c++) {
      const key = cellKey(r, c);
      if (posities.includes(c)) vastePosities.add(key);
      else losseLetters.push(grid[r][c]);
    }
  }

  fisherYatesShuffle(losseLetters);

  let index = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!vastePosities.has(cellKey(r, c))) {
        grid[r][c] = losseLetters[index++];
      }
    }
  }

  vasteCellen = new Set(vastePosities);

  renderGrid();
  loadtopScore();
  updatetopScoreDisplay();
  bindtopScoreReset();
}

/* =========================
   6. GAME LOGICA
   ========================= */

function checkWin() {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== oplossing[r][c]) return false;
    }
  }
  return true;
}

function clearSelectedCell() {
  if (!selectedCell) return;
  selectedCell.classList.remove("selected");
  selectedCell = null;
}

function swapCells(cell1, cell2) {
  const r1 = parseInt(cell1.dataset.row);
  const c1 = parseInt(cell1.dataset.col);
  const r2 = parseInt(cell2.dataset.row);
  const c2 = parseInt(cell2.dataset.col);

swapUitgevoerd = true;


  laatsteZet = {
    from: { r: r1, c: c1, letter: grid[r1][c1] },
    to: { r: r2, c: c2, letter: grid[r2][c2] }
  };

  [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];

  cell1.textContent = grid[r1][c1];
  cell2.textContent = grid[r2][c2];
}

function controleerWoorden() {
  correcteCellen.clear();

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === oplossing[r][c]) {
        correcteCellen.add(cellKey(r, c));
      }
    }
  }

 if (swapUitgevoerd && laatsteZet) {
    swapUitgevoerd = false;


    const cell = getCell(laatsteZet.from.r, laatsteZet.from.c);
    if (cell) {
      cell.classList.remove("found");
      cell.style.pointerEvents = "auto";
    }
  }

  for (let r = 0; r < gridSize; r++) {
    let volledig = true;

    for (let c = 0; c < gridSize; c++) {
      if (!correcteCellen.has(cellKey(r, c))) {
        volledig = false;
        break;
      }
    }

    if (volledig) {
      for (let c = 0; c < gridSize; c++) lockCell(r, c);
    }
  }

if (checkWin()) {
    saveGame(); // <-- toevoegen
    clearInterval(timerInterval);
    updatetopScoreIfNeeded();
    startFireworks();
}

}

function doeSwap(cell1, cell2) {
  startTimerIfNeeded();
  swapCells(cell1, cell2);
  voegSwapPuntToe();
  controleerWoorden();
  saveGame();
}

function geefHint(cell) {
  voegHintPuntenToe();

  const r = parseInt(cell.dataset.row);
  const c = parseInt(cell.dataset.col);
  const key = cellKey(r, c);

  if (vasteCellen.has(key)) return;

  const juisteLetter = oplossing[r][c];
  const huidigeLetter = grid[r][c];

  if (huidigeLetter === juisteLetter) {
    lockCell(r, c);
    saveGame();
    return;
  }

  let bron = null;

  for (let i = 0; i < gridSize && !bron; i++) {
    for (let j = 0; j < gridSize; j++) {
      const bronKey = cellKey(i, j);
      if (vasteCellen.has(bronKey)) continue;
      if (i === r && j === c) continue;

      if (grid[i][j] === juisteLetter) {
        bron = { i, j };
        break;
      }
    }
  }

  if (!bron) return;

  [grid[r][c], grid[bron.i][bron.j]] = [grid[bron.i][bron.j], grid[r][c]];

  updateCell(r, c);
  updateCell(bron.i, bron.j);
  lockCell(r, c);

  saveGame();
}

/* =========================
   7. MESSAGE / MODAL UI
   ========================= */

function showMessage(text, extraHTML = "") {
  const bar = document.getElementById("messageBar");
  const msg = document.getElementById("messageText");
  const extra = document.getElementById("messageExtra");

  bar.style.display = "flex";
  msg.textContent = text;
  extra.innerHTML = extraHTML;
}

function clearMessage() {
  showMessage(t("defaultMessage"));
}

function openModal(contentHTML) {
  document.getElementById("modalBody").innerHTML = contentHTML;
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

/* =========================
   8. TAAL
   ========================= */

async function switchLanguage(langCode) {
  i18n.setLanguage(langCode);

  const img = document.querySelector("#langBtn img");
  if (img) img.src = `images/${langCode.toUpperCase()}.png`;

  woordenBestand = langCode === "nl" ? "woorden.txt" : `woorden_${langCode}.txt`;

  await laadWoorden();
  woordBag = new ShuffleBagCooldown(woordenLijst, 3);
  maakGrid();
  clearMessage();
  
}

function chooseLanguage() {
  showMessage(
    t("language"),
    `
      <div class="lang-select">
        <button data-lang="nl"><img src="images/NL.png" alt="NL"></button>
        <button data-lang="fr"><img src="images/FR.png" alt="FR"></button>
        <button data-lang="en"><img src="images/EN.png" alt="EN"></button>
        <button data-lang="de"><img src="images/DE.png" alt="DE"></button>
      </div>    `
  );

  document.querySelectorAll(".lang-select button").forEach(btn => {
    btn.onclick = async () => {
      await switchLanguage(btn.dataset.lang);
      clearMessage();
    };
  });

}

/* =========================
   9. EVENTS
   ========================= */

function getCellFromEvent(e) {
  return e.target.closest(".cell");
}

function pointerDown(e) {
  const cell = getCellFromEvent(e);
  if (!cell) return;

  const key = cellKey(cell.dataset.row, cell.dataset.col);
  if (vasteCellen.has(key)) return;

  longPressTriggered = false;

  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    longPressTimer = null;
    geefHint(cell);
  }, LONG_PRESS_TIME);
}

function pointerUp(e) {
  const cell = getCellFromEvent(e);

  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  if (longPressTriggered || !cell) return;

  if (!selectedCell) {
    startTimerIfNeeded();
    selectedCell = cell;
    cell.classList.add("selected");
    return;
  }

  if (selectedCell === cell) {
    clearSelectedCell();
    return;
  }

  doeSwap(selectedCell, cell);
  clearSelectedCell();
}

function initToolbar() {
  const buttons = document.querySelectorAll("#toolbar button[data-level]");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const newLevel = Number(btn.dataset.level);
      if (level === newLevel) return;

      showMessage(
        t("confirmNewGame"),
        `
          <div class="confirm-box">
            <button id="jaBtn" class="btn btn-green">Ja</button>
            <button id="neeBtn" class="btn btn-red">Nee</button>
          </div>
        `
      );

      setTimeout(() => {
        const ja = document.getElementById("jaBtn");
        const nee = document.getElementById("neeBtn");

        if (!ja || !nee) return;

       ja.onclick = () => {
		  level = newLevel;

		  // UI updaten
		  buttons.forEach(b => b.classList.remove("active"));
	  btn.classList.add("active");

		  clearMessage();   // <-- DIT is de fix
		  nieuwSpel();
		};

        nee.onclick = () => {
          showMessage(t("defaultMessage"));
        };
      }, 0);
    });
  });
}


function bindStaticUI() {
document.getElementById("nieuwBtn").onclick = () => {
  nieuwSpel();
};


  document.getElementById("helpBtn").addEventListener("click", () => {
    openModal(`
	<h4>${t("modalInfoTitle")}</h4>
	<p>${t("modalInfoBody")}</p>
	`);
  });

  const closeBtn = document.getElementById("modalClose");
  const modal = document.getElementById("modal");
  const langBtn = document.getElementById("langBtn");

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  if (modal) {
    modal.addEventListener("click", e => {
      if (e.target.id === "modal") closeModal();
    });
  }

  if (langBtn) langBtn.addEventListener("click", chooseLanguage);

  document.addEventListener("pointerdown", pointerDown);
  document.addEventListener("pointerup", pointerUp);
}


/* =========================
   10. INIT
   ========================= */

async function startGame() {
  await laadWoorden();
  loadtopScore();

  const loaded = loadGame();   // verder spelen

  if (!loaded) {
    nieuwSpel();               // eerste keer → nieuw spel
    return;
  }

  // verder spelen
  updatetopScoreDisplay();
  bindtopScoreReset();
  clearMessage();
}

async function nieuwSpel() {
  strafpunten = 0;
  seconden = 0;
  timerGestart = false;
  updateScore();
highlightLevel(level)
  woordBag = new ShuffleBagCooldown(woordenLijst, 3);

  maakGrid();
  renderGrid(); // letters staan erin

  // letters verbergen
  document.querySelectorAll("#grid .cell")
    .forEach(cell => cell.classList.add("hiddenLetter"));

  // layout stabiliseren
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      startFallingLettersOverlay();
    });
  });
}


function eindeSpel() {
  showMessage(
    t("confirmNewGame"),
    `
      <div class="confirm-box">
        <button id="jaBtn" class="btn btn-green">Ja</button>
        <button id="neeBtn" class="btn btn-red">Nee</button>
      </div>
    `
  );

  document.getElementById("jaBtn").onclick = () => {
    showMessage(t("defaultMessage"));
    nieuwSpel();
  };

  document.getElementById("neeBtn").onclick = () => {
    showMessage(t("defaultMessage"));
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  bindStaticUI();
  await startGame();
});

/* =========================
   11. EFFECTS
   ========================= */

function startFireworks(callback) {
  const canvas = document.getElementById("fireworksCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.remove("hidden");

  let particles = [];
  let running = true;

  function createExplosion(x, y) {
    for (let i = 0; i < 60; i++) {
      particles.push({
        x,
        y,
        angle: Math.random() * 2 * Math.PI,
        speed: Math.random() * 4 + 2,
        radius: 2 + Math.random() * 2,
        alpha: 1
      });
    }
  }

  function animate() {
    if (!running) return;

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const next = [];

    for (const p of particles) {
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.alpha -= 0.02;

      if (p.alpha > 0) {
        next.push(p);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,${Math.floor(Math.random() * 255)},0,${p.alpha})`;
        ctx.fill();
      }
    }

    particles = next;
    requestAnimationFrame(animate);
  }

  animate();

  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      createExplosion(
        Math.random() * canvas.width,
        Math.random() * canvas.height * 0.6
      );
    }, i * 600);
  }

  setTimeout(() => {
    running = false;
    canvas.classList.add("hidden");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (callback) callback();
  }, 4000);
}
/*=================================================================*/

function startFallingLettersOverlay() {
  const canvas = document.getElementById("startAnimCanvas");
  const ctx = canvas.getContext("2d");

  canvas.classList.remove("hidden");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const cells = [...document.querySelectorAll("#grid .cell")];
  const letters = [];

  // 1. Lees letters + targetposities
  for (const cell of cells) {
    const letter = cell.textContent;
    const rect = cell.getBoundingClientRect();

    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    const startX = Math.random() * canvas.width;
    const startY = -Math.random() * canvas.height * 0.5;

    letters.push({
      char: letter,
      startX,
      startY,
      targetX,
      targetY,
      driftX: 0,
      driftY: 0,
      driftSpeedX: (Math.random() - 0.5) * 1.2,
      driftSpeedY: (Math.random() - 0.5) * 0.6,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      size: 26,
      progress: 0
    });
  }

  // -------------------------
  // DE ANIMATIE-FUNCTIE
  // -------------------------
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let allDone = true;

    for (const l of letters) {
      l.progress += 0.012;

      if (l.progress < 1) allDone = false;

      const t = Math.min(1, l.progress);

      // zachte landing
      const ease = 1 - Math.pow(1 - t, 1);

      // dwarrel sterft mooi uit
      const landingPhase = Math.pow(1 - t, 2);

      l.driftX += l.driftSpeedX * landingPhase;
      l.driftY += l.driftSpeedY * landingPhase;
      l.rotation += l.rotationSpeed * landingPhase;

      const x = l.startX + (l.targetX - l.startX) * ease + l.driftX;
      const y = l.startY + (l.targetY - l.startY) * ease + l.driftY;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(l.rotation);
      ctx.font = `18px Arial`;
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(l.char, 0, 0);
      ctx.restore();
    }

    // -------------------------
    // EINDE ANIMATIE
    // -------------------------
    if (!allDone) {
      requestAnimationFrame(animate);
    } else {

      // 1. CLEAR
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 2. PERFECTE LANDING TEKENEN
      for (const cell of cells) {
        const rect = cell.getBoundingClientRect();
        const letter = cell.textContent;

        const style = getComputedStyle(cell);
        const fontSize = style.fontSize;
        const fontFamily = style.fontFamily;
        const fontWeight = style.fontWeight;

        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0);
        ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        ctx.fillStyle = "rgba(0,0,0,0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, 0, 0);
        ctx.restore();
      }

      // 3. FREEZE FRAME
      setTimeout(() => {

        // 4. Canvas weg
        canvas.classList.add("hidden");

        // 5. Gridletters tonen
        document.querySelectorAll("#grid .cell")
          .forEach(cell => cell.classList.remove("hiddenLetter"));

      }, 5);
    }
  }

  // -------------------------
  // START DE ANIMATIE
  // -------------------------
  animate();
}


document.addEventListener("DOMContentLoaded", () => {
  initToolbar();
  startGame();
});


/*DEBUGGER*/

window.addEventListener("keydown", (e) => {
    if (e.key === "d" || e.key === "D") {
        toggleDebug();
    }
});

