const gridSize = 10;
let grid = [];
let selectedCell = null;
let woordenLijst = [];
let gevondenWoorden = new Set();
let level = 1;
let oplossing = [];
let vasteCellen = new Set();
let strafpunten = 0;
let timerInterval = null;
let seconden = 0;
let timerGestart = false;
let topScores = { 1: null, 2: null, 3: null, 4: null, 5: null };
let hintLetters = new Set();
let laatsteZet = null;
const correcteCellen = new Set();


class ShuffleBagCooldown {
    constructor(words, cooldownShuffles = 4) {
        this.original = [...words];
        this.cooldownShuffles = cooldownShuffles;

        this.bag = [];
        this.cooldown = new Map(); // woord → resterende shuffles
        this.shuffleCount = 0;

        this.refill();
    }

    refill() {
        this.shuffleCount++;

        // cooldown verminderen
        for (const [word, cd] of this.cooldown.entries()) {
            if (cd <= 1) {
                this.cooldown.delete(word);
            } else {
                this.cooldown.set(word, cd - 1);
            }
        }

        // bag vullen met woorden die NIET in cooldown zitten
        this.bag = this.original.filter(w => !this.cooldown.has(w));

        // Fisher-Yates shuffle
        for (let i = this.bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
    }

    draw(n = 1) {
        const result = [];

        for (let i = 0; i < n; i++) {
            if (this.bag.length === 0) {
                this.refill();
            }

            const word = this.bag.pop();
            result.push(word);

            // cooldown instellen
            this.cooldown.set(word, this.cooldownShuffles);
        }

        return result;
    }
}

async function laadWoorden() {
  const res = await fetch("woorden.txt");
  const text = await res.text();

  woordenLijst = text
    .split(/\r?\n/)
    .map(w => w.trim().toUpperCase())
    .filter(Boolean);

  woordBag = new ShuffleBagCooldown(woordenLijst, 3);
}
let woordBag = null;

/* Fisher–Yates shuffle */
function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* Topscores */
function loadTopScores() {
    const saved = localStorage.getItem("letterwissel_topscores");
    if (saved) {
        topScores = JSON.parse(saved);
    }
}

function saveTopScores() {
    localStorage.setItem("letterwissel_topscores", JSON.stringify(topScores));
}

function updateTopScoreDisplay() {
    const el = document.getElementById("topscore");
    el.textContent = "Top L" + level + ": " + (topScores[level] ?? "-");
}

function updateTopScoreIfNeeded() {
    if (topScores[level] === null || strafpunten < topScores[level]) {
        topScores[level] = strafpunten;
        saveTopScores();
        updateTopScoreDisplay();
    }
}

/* reset topscore */
function bindTopscoreReset() {
    const el = document.getElementById("topscore");
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);

    newEl.addEventListener("dblclick", () => {
        topScores[level] = null;
        saveTopScores();
        updateTopScoreDisplay();
    });
}

function aantalGroeneLetters(level) {
    return 6 - level;
}

/* Wincheck */
function checkWin() {
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] !== oplossing[r][c]) {
                return false;
            }
        }
    }
    return true;
}

/* Grid opbouwen */
function maakGrid() {
    selectedCell = null;
    vasteCellen.clear();
    hintLetters.clear();

    const container = document.getElementById("grid");
    container.innerHTML = "";
    grid = [];

    // 1. Filter woorden op lengte
    const geldigeWoorden = woordenLijst.filter(w => w.length === gridSize);

    // 2. Gebruik shuffle-bag in plaats van Fisher-Yates
    const woorden = woordBag.draw(gridSize);

    // 3. Oplossing opslaan
    oplossing = woorden.map(w => w.split(""));

    const vastePerRij = aantalGroeneLetters(level);

    let vastePosities = new Set();
    let losseLetters = [];

    // 4. Grid vullen met de gekozen woorden
    for (let r = 0; r < gridSize; r++) {
        grid[r] = woorden[r].split("");
    }

    // 5. Per rij vaste posities bepalen
    for (let r = 0; r < gridSize; r++) {
        let posities = [...Array(gridSize).keys()];
        fisherYatesShuffle(posities);
        posities = posities.slice(0, vastePerRij);

        for (let c = 0; c < gridSize; c++) {
            if (!posities.includes(c)) {
                losseLetters.push(grid[r][c]);
            } else {
                vastePosities.add(`${r}-${c}`);
            }
        }
    }

    // 6. Losse letters schudden
    fisherYatesShuffle(losseLetters);

    // 7. Losse letters terugplaatsen
    let index = 0;
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const key = `${r}-${c}`;
            if (!vastePosities.has(key)) {
                grid[r][c] = losseLetters[index++];
            }
        }
    }

    // 8. Grid tekenen
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.textContent = grid[r][c];
            cell.dataset.row = r;
            cell.dataset.col = c;

            const key = `${r}-${c}`;

            if (vastePosities.has(key)) {
                cell.classList.add("found");
                vasteCellen.add(key);
                cell.style.pointerEvents = "none";
            }

            container.appendChild(cell);
        }
    }

    loadTopScores();
    updateTopScoreDisplay();
    bindTopscoreReset();
}


/* Selectie & swap */
function selecteerCel(cell) {
    const key = `${cell.dataset.row}-${cell.dataset.col}`;
    if (vasteCellen.has(key)) return;

    if (!selectedCell) {
        selectedCell = cell;
        cell.classList.add("selected");
        return;
    }

    const key2 = `${selectedCell.dataset.row}-${selectedCell.dataset.col}`;
    if (vasteCellen.has(key2)) {
        selectedCell.classList.remove("selected");
        selectedCell = null;
        return;
    }

    if (selectedCell === cell) {
        selectedCell.classList.remove("selected");
        selectedCell = null;
        return;
    }

    const r1 = selectedCell.dataset.row;
    const c1 = selectedCell.dataset.col;
    const r2 = cell.dataset.row;
    const c2 = cell.dataset.col;

    if (grid[r1][c1] !== grid[r2][c2]) {
        if (!timerGestart) {
            startTimer();
            timerGestart = true;
        }

        swapCells(selectedCell, cell);
        voegSwapPuntToe();
        controleerWoorden();
        saveGame();
    }

    selectedCell.classList.remove("selected");
    selectedCell = null;
}

function swapCells(cell1, cell2) {
    const r1 = parseInt(cell1.dataset.row);
    const c1 = parseInt(cell1.dataset.col);
    const r2 = parseInt(cell2.dataset.row);
    const c2 = parseInt(cell2.dataset.col);

    // Bewaar info over de zet vóór de swap
    laatsteZet = {
        from: { r: r1, c: c1, letter: grid[r1][c1] }, // vertrekkende letter
        to:   { r: r2, c: c2, letter: grid[r2][c2] }  // geplaatste letter
    };

    // Voer de swap uit
    [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];

    cell1.textContent = grid[r1][c1];
    cell2.textContent = grid[r2][c2];
}


/* Controleer woorden */
function controleerWoorden() {

    correcteCellen.clear();

    // 1. Markeer alle correcte posities intern
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (grid[r][c] === oplossing[r][c]) {
                correcteCellen.add(`${r}-${c}`);
            }
        }
    }

    // 2. De geplaatste letter krijgt GEEN groen, maar wel status correct
    //    (dat zit al in correcteCellen)

    // 3. De verdreven letter mag NOOIT groen worden
    if (laatsteZet) {
        const { r, c } = laatsteZet.from;
        const key = `${r}-${c}`;

        vasteCellen.delete(key);

        const cell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
        cell.classList.remove("found");
        cell.style.pointerEvents = "auto";
    }

    // 4. Woorden die volledig correct zijn → alles groen + vast
    for (let r = 0; r < gridSize; r++) {
        let volledig = true;

        for (let c = 0; c < gridSize; c++) {
            if (!correcteCellen.has(`${r}-${c}`)) {
                volledig = false;
                break;
            }
        }

        if (volledig) {
            for (let c = 0; c < gridSize; c++) {
                const key = `${r}-${c}`;
                vasteCellen.add(key);

                const cell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
                cell.classList.add("found");
                cell.style.pointerEvents = "none";
            }
        }
    }

    // 5. Wincheck
    if (checkWin()) {
        clearInterval(timerInterval);
        updateTopScoreIfNeeded();
        startFireworks();
    }
}



/* Hintfunctie */
function geefHint(cell) {
    voegHintPuntenToe();

    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    const key = `${r}-${c}`;

    if (vasteCellen.has(key)) return;

    const juisteLetter = oplossing[r][c];
    const huidigeLetter = grid[r][c];

    if (huidigeLetter === juisteLetter) {
        lockCell(r, c);
        saveGame();
        return;
    }

    let bron = null;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const k = `${i}-${j}`;
            if (vasteCellen.has(k)) continue;
            if (i === r && j === c) continue;

            if (grid[i][j] === juisteLetter) {
                bron = { i, j };
                break;
            }
        }
        if (bron) break;
    }

    if (!bron) return;

    const { i, j } = bron;

    [grid[r][c], grid[i][j]] = [grid[i][j], grid[r][c]];

    updateCell(r, c);
    updateCell(i, j);

    lockCell(r, c);

    saveGame();
}

function lockCell(r, c) {
    const key = `${r}-${c}`;
    vasteCellen.add(key);

    const el = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
    if (!el) return;

    el.classList.add("found");
    el.classList.remove("selected");
    el.style.pointerEvents = "none";
}

function updateCell(r, c) {
    const cell = document.querySelector(
        `[data-row='${r}'][data-col='${c}']`
    );
    cell.textContent = grid[r][c];
}

/* Start game */
function startGame() {
    laadWoorden();
    loadTopScores();
    initToolbar();

    const loaded = loadGame();

    if (!loaded) {
        maakGrid();
        saveGame();
    }

    loadTopScores();
    updateTopScoreDisplay();
    bindTopscoreReset();
}

/* Toolbar */
function initToolbar() {
    const buttons = document.querySelectorAll("#toolbar button");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            level = parseInt(btn.dataset.level);

            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            updateTopScoreDisplay();
            maakGrid();
        });
    });

    const first = document.querySelector("#toolbar button[data-level='1']");
    if (first) first.classList.add("active");
}

/* Score & timer */
function updateScore() {
    document.getElementById("score").textContent =
        "Pt'n: " + strafpunten;
}

function voegSwapPuntToe() {
    strafpunten += 1;
    updateScore();
}

function voegHintPuntenToe() {
    strafpunten += 10;
    updateScore();
}

function startTimer() {
    seconden = 0;
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        seconden++;
        let min = Math.floor(seconden / 60);
        let sec = seconden % 60;

        document.getElementById("timer").textContent =
            "T: " +
            String(min).padStart(2, "0") +
            ":" +
            String(sec).padStart(2, "0");
    }, 1000);
}

/* Nieuw spel */
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("nieuwBtn").addEventListener("click", () => {
        clearInterval(timerInterval);
        seconden = 0;
        timerGestart = false;

        document.getElementById("timer").textContent = "T: 00:00";

        strafpunten = 0;
        updateScore();
		
		woordBag = new ShuffleBagCooldown(woordenLijst, 3); // cooldown = 3 shuffles	
        maakGrid();
        saveGame();
    });

    document.getElementById("helpBtn").addEventListener("click", () => {
        openModal(`
            <h4>Hoe speel je dit spel?</h4>
            <p>* Ieder spel is altijd oplosbaar.<br>
            * Vorm horizontaal 10 woorden van 10 letters.<br>
            * Selecteer 2 letters om ze van plaats te wisselen. Groene letters staan al correct en kunnen niet gewisseld worden.<br>
            * Druk langere tijd op een letter voor een hint (deze wordt een extra groene tegel).<br>
            * Groene letters staan vast en zijn correct.<br>
            * 1 strafpunt per swap. 10 strafpunten per hint.<br>
            * BELANGRIJK! Er zijn geen meervouden, verkleinwoorden, vervoegingen of verbuigingen.<br>
            * Reset de topscore door er op te dubbelklikken.</p>
        `);
    });

    /* Modal events */
    const closeBtn = document.getElementById("modalClose");
    const modal = document.getElementById("modal");

    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    if (modal) {
        modal.addEventListener("click", function(e) {
            if (e.target.id === "modal") {
                closeModal();
            }
        });
    }

    /* Pointer handlers */
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("pointerup", pointerUp);

    /* Start het spel */
    startGame();
});

/* Save & load */
function saveGame() {
    const gameState = {
        grid,
        oplossing,
        vasteCellen: Array.from(vasteCellen),
        level,
        strafpunten,
        seconden,
        timerGestart
    };

    localStorage.setItem("letterwissel_save", JSON.stringify(gameState));
}

function loadGame() {
    const saved = localStorage.getItem("letterwissel_save");
    if (!saved) return false;

    const gameState = JSON.parse(saved);

    grid = gameState.grid;
    oplossing = gameState.oplossing;
    vasteCellen = new Set(gameState.vasteCellen);
    level = gameState.level;
    strafpunten = gameState.strafpunten;
    seconden = gameState.seconden;
    timerGestart = gameState.timerGestart;

    updateScore();
    tekenGridVanData();

    if (timerGestart) {
        startTimer();
    }

    return true;
}

function tekenGridVanData() {
    const container = document.getElementById("grid");
    container.innerHTML = "";

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.textContent = grid[r][c];
            cell.dataset.row = r;
            cell.dataset.col = c;

            const key = `${r}-${c}`;

            if (vasteCellen.has(key)) {
                cell.classList.add("found");
                cell.style.pointerEvents = "none";
            }

            container.appendChild(cell);
        }
    }
}

/* Modal helpers */
function closeModal() {
    const modal = document.getElementById("modal");
    modal.classList.add("hidden");
}

function openModal(contentHTML) {
    document.getElementById("modalBody").innerHTML = contentHTML;
    document.getElementById("modal").classList.remove("hidden");
}

/* Fireworks */
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
                x: x,
                y: y,
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

        const newParticles = [];
        for (let p of particles) {
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;
            p.alpha -= 0.02;

            if (p.alpha > 0) {
                newParticles.push(p);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,${Math.floor(Math.random() * 255)},0,${p.alpha})`;
                ctx.fill();
            }
        }
        particles = newParticles;

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

/* Nieuwe input-handler: swap = klik-klik, hint = long press */
const LONG_PRESS_TIME = 500;
let longPressTimer = null;
let longPressTriggered = false;

function getCellFromEvent(e) {
    return e.target.closest(".cell");
}

function pointerDown(e) {
    const cell = getCellFromEvent(e);
    if (!cell) return;

    const key = `${cell.dataset.row}-${cell.dataset.col}`;
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

    if (longPressTriggered) {
        return;
    }

    if (!cell) return;
	
	if (!timerGestart) {
    startTimer();
    timerGestart = true;
}


    if (!selectedCell) {
        selectedCell = cell;
        cell.classList.add("selected");
    } else if (selectedCell === cell) {
        cell.classList.remove("selected");
        selectedCell = null;
    } else {
        swapCells(selectedCell, cell);
        voegSwapPuntToe();
        controleerWoorden();
        saveGame();

        selectedCell.classList.remove("selected");
        selectedCell = null;
    }
}

