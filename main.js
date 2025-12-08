/* MinimalPro Calculator
   - safe-ish evaluator with math functions
   - degrees for trig (sin/cos/tan)
   - history saved in localStorage
   - themes + UI controls
   - WebAudio click sound (no file needed)
*/

const display = document.getElementById("display");
const subDisplay = document.getElementById("subDisplay");
const keypad = document.getElementById("keypad");
const historyToggle = document.getElementById("historyToggle");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const themeSelect = document.getElementById("themeSelect");
const soundToggle = document.getElementById("soundToggle");

// localStorage keys
const LS_HISTORY = "mp_calc_history_v1";
const LS_THEME = "mp_calc_theme_v1";
const LS_LAST = "mp_calc_last_v1";

// state
let history = JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
let soundOn = true;

// --- WebAudio simple click (small beep) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClick() {
  if (!soundOn) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = 700;
  g.gain.value = 0.02;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.06);
}

// --- helper math functions (degrees) ---
function toRad(deg){ return deg * Math.PI / 180; }
function sin(x){ return Math.sin(toRad(x)); }
function cos(x){ return Math.cos(toRad(x)); }
function tan(x){ return Math.tan(toRad(x)); }
function sqrt(x){ return Math.sqrt(x); }
function pow(a,b){ return Math.pow(a,b); }
function ln(x){ return Math.log(x); }        // natural log
function log(x){ return Math.log10(x); }     // base-10
function exp(x){ return Math.exp(x); }
function abs(x){ return Math.abs(x); }
const pi = Math.PI;

// --- UI update helpers ---
function pushHistory(expr, result){
  const item = { expr, result, ts: Date.now() };
  history.unshift(item);
  if(history.length > 30) history.length = 30; // keep last 30
  localStorage.setItem(LS_HISTORY, JSON.stringify(history));
  renderHistory();
}
function renderHistory(){
  if(!history.length) {
    historyList.innerHTML = "<div style='opacity:.7;'>No history yet</div>";
    return;
  }
  historyList.innerHTML = history.map(h => {
    const time = new Date(h.ts).toLocaleString();
    return `<div class="history-item"><div>${escapeHtml(h.expr)}</div><div style="font-weight:700">${escapeHtml(String(h.result))}</div></div>`;
  }).join("");
}

// safe simple escape
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

// --- load last expression if any ---
display.value = localStorage.getItem(LS_LAST) || "";

// --- evaluator (sanitise then evaluate using Function with math helpers) ---
function sanitizeExpression(input){
  if(!input) return "";
  // normalize symbols
  let s = input.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
  // allow ^ as power -> **
  s = s.replace(/\^/g, "**");
  return s;
}

function evaluateExpression(input){
  const expr = sanitizeExpression(input);
  if(!expr) return "";
  // very small whitelist test: only allow digits, operators, letters, parentheses, dot, comma, underscore
  if(!/^[0-9+\-*/().^%,*a-zA-Z_]+$/.test(expr)) throw new Error("Invalid characters");
  // Build a Function and pass helpers as parameters to limit global access
  const func = new Function(
    "sin","cos","tan","sqrt","pow","ln","log","exp","abs","pi",
    "return (" + expr + ");"
  );
  // call with our helpers (sin/cos in degrees)
  return func(sin, cos, tan, sqrt, pow, ln, log, exp, abs, pi);
}

// --- keypad click handler ---
keypad.addEventListener("click", (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  playClick();

  // ripple effect manually (improves on CSS)
  const rect = btn.getBoundingClientRect();
  const rip = document.createElement("span");
  rip.style.position = "absolute";
  rip.style.left = (e.clientX - rect.left - 40) + "px";
  rip.style.top = (e.clientY - rect.top - 40) + "px";
  rip.style.width = "80px";
  rip.style.height = "80px";
  rip.style.borderRadius = "50%";
  rip.style.background = "rgba(0,0,0,0.08)";
  rip.style.pointerEvents = "none";
  rip.style.transform = "scale(0)";
  rip.style.transition = "transform .45s, opacity .45s";
  btn.appendChild(rip);
  requestAnimationFrame(()=> rip.style.transform = "scale(1.6)");
  setTimeout(()=> { rip.style.opacity = "0"; }, 180);
  setTimeout(()=> rip.remove(), 600);

  const action = btn.dataset.action;
  const insert = btn.dataset.insert;
  if(action === "clear"){
    display.value = "";
    subDisplay.textContent = "";
    localStorage.setItem(LS_LAST, "");
    return;
  }
  if(action === "del"){
    display.value = display.value.slice(0,-1);
    localStorage.setItem(LS_LAST, display.value);
    return;
  }
  if(action === "equals"){
    computeResult();
    return;
  }
  if(insert){
    display.value += insert;
    localStorage.setItem(LS_LAST, display.value);
  }
});

// compute and show
function computeResult(){
  const expr = display.value.trim();
  if(!expr) return;
  try{
    const result = evaluateExpression(expr);
    if(result === Infinity || result === -Infinity) {
      subDisplay.textContent = "Error: Division by zero";
      return;
    }
    subDisplay.textContent = expr + " =";
    display.value = String((Math.round((result + Number.EPSILON) * 1e12)/1e12)); // round small floats
    pushHistory(expr, display.value);
    localStorage.setItem(LS_LAST, display.value);
  } catch(err){
    subDisplay.textContent = "Error: " + (err.message || "Invalid expression");
  }
}

// allow Enter key to compute (for keyboard)
document.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") { computeResult(); playClick(); }
  if(e.key === "Backspace") { /* normal */ }
  // map keyboard numbers/operators to input (optional)
});

// --- history toggle + clear ---
historyToggle.addEventListener("click", ()=>{
  const hidden = historyPanel.classList.toggle("hidden");
  historyToggle.textContent = hidden ? "History ▾" : "History ▴";
});
clearHistoryBtn.addEventListener("click", ()=>{
  if(confirm("Clear history?")) {
    history = [];
    localStorage.removeItem(LS_HISTORY);
    renderHistory();
  }
});

// on history item click - copy to display
historyList.addEventListener("click", (e)=>{
  const item = e.target.closest(".history-item");
  if(!item) return;
  const text = item.querySelector("div")?.innerText || "";
  if(text) {
    display.value = text;
    localStorage.setItem(LS_LAST, display.value);
  }
});

// --- theme handling ---
function applyTheme(theme){
  document.body.className = theme;
  localStorage.setItem(LS_THEME, theme);
}
themeSelect.addEventListener("change", (e)=> applyTheme(e.target.value));
const savedTheme = localStorage.getItem(LS_THEME) || "theme-default";
themeSelect.value = savedTheme;
applyTheme(savedTheme);

// --- sound toggle ---
soundToggle.addEventListener("click", ()=>{
  soundOn = !soundOn;
  soundToggle.textContent = soundOn ? "🔊" : "🔈";
});

// render initial history
renderHistory();
