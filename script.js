// script.js — Логика приложения SchulKompass с синхронизацией через Firebase Realtime Database

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// -------------------------------------------------------------------
// 1. КОНФИГУРАЦИЯ FIREBASE
// -------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDKa0bo_wtF08Wwy0vn0JHDnba1Tt_4Riw",
  authDomain: "schulkompass-6f78c.firebaseapp.com",
  databaseURL: "https://schulkompass-6f78c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "schulkompass-6f78c",
  storageBucket: "schulkompass-6f78c.firebasestorage.app",
  messagingSenderId: "206897427783",
  appId: "1:206897427783:web:ff052ea41b5285bb324862"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// -------------------------------------------------------------------
// 2. ДАННЫЕ РАСПИСАНИЯ И НАВЫКОВ
// -------------------------------------------------------------------
const timetableVeronika = {
  1: ["Deutsch", "Mathe", "Erdkunde"],
  2: ["Kunst", "W. u. N.", "Musik"],
  3: ["Spanisch", "Geschichte", "Englisch"],
  4: ["Deutsch", "Mathe", "Sport"],
  5: ["Englisch", "Physik", "Spanisch"]
};

const timetableMilana = {
  1: ["Mathe", "Chemie", "Geschichte"],
  2: ["Spanisch", "Musik", "Deutsch"],
  3: ["Englisch", "Deutsch", "Mathe"],
  4: ["Spanisch", "W. u. N.", "Erdkunde"],
  5: ["Physik", "Englisch", "Klassenlehrerstunde"]
};

const dailyHabits = [
  { id: "ordnung", name: "Ordnung (Порядок)", max: 5, desc: "Arbeitsplatz & Zimmer aufgeräumt" },
  { id: "verhalten", name: "Verhalten (Поведение)", max: 5, desc: "Respektvoll und ruhig" },
  { id: "aktivitaet", name: "Meldung im Unterricht (Смелость / Активность)", max: 5, desc: "Hand heben, aktiv mitmachen" },
  { id: "lesen", name: "Bücher lesen (Чтение)", max: 5, desc: "Deutsch / Englisch lesen" },
  { id: "selbststaendigkeit", name: "Selbstständigkeit (Самостоятельность)", max: 5, desc: "Aufgaben ohne Erinnerung erledigen" },
  { id: "ehrlichkeit", name: "Ehrlichkeit (Честность)", max: 5, desc: "Offen und ehrlich sein" }
];

const isIndexPage = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/");
const isMilanaPage = window.location.pathname.includes("milana.html");

// Вспомогательные функции работы с датами без сдвига часовых поясов
function formatDateToYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

let selectedDate = formatDateToYYYYMMDD(new Date()); 
let selectedMonth = selectedDate.substring(0, 7);
let globalScores = {};

document.addEventListener("DOMContentLoaded", () => {
  if (isIndexPage) {
    listenIndexPageData();
  } else {
    const dateInput = document.getElementById("date-select");
    const monthInput = document.getElementById("month-select");

    if (dateInput) {
      dateInput.value = selectedDate;
      dateInput.addEventListener("change", (e) => {
        selectedDate = e.target.value;
        selectedMonth = selectedDate.substring(0, 7);
        if (monthInput) monthInput.value = selectedMonth;
        renderWeekPills();
        renderTasks();
      });
    }

    if (monthInput) {
      monthInput.value = selectedMonth;
      monthInput.addEventListener("change", (e) => {
        selectedMonth = e.target.value;
        calculateStudentTotals();
      });
    }

    renderWeekPills();
    listenStudentData();
  }
});

function getStudentContext() {
  const student = isMilanaPage ? "milana" : "veronika";
  const timetable = isMilanaPage ? timetableMilana : timetableVeronika;
  const dbPath = `scores/${student}`;
  return { student, timetable, dbPath };
}

// -------------------------------------------------------------------
// 3. СИНХРОНИЗАЦИЯ С FIREBASE
// -------------------------------------------------------------------
function listenStudentData() {
  const { dbPath } = getStudentContext();
  const studentRef = ref(db, dbPath);

  onValue(studentRef, (snapshot) => {
    globalScores = snapshot.val() || {};
    renderTasks();
  });
}

window.updateScore = function(dateStr, itemKey, val) {
  const { dbPath } = getStudentContext();
  const scoreRef = ref(db, `${dbPath}/${dateStr}/${itemKey}`);
  set(scoreRef, parseInt(val, 10));
};

function listenIndexPageData() {
  const allScoresRef = ref(db, 'scores');

  onValue(allScoresRef, (snapshot) => {
    const data = snapshot.val() || {};
    const veronikaScores = data.veronika || {};
    const milanaScores = data.milana || {};

    const currentMonthStr = formatDateToYYYYMMDD(new Date()).substring(0, 7);
    const todayStr = formatDateToYYYYMMDD(new Date());

    const vStats = getMonthStats(veronikaScores, timetableVeronika, currentMonthStr);
    const mStats = getMonthStats(milanaScores, timetableMilana, currentMonthStr);

    const vToday = getDayTotal(veronikaScores, todayStr);
    const mToday = getDayTotal(milanaScores, todayStr);

    const vPreview = document.getElementById("veronika-today-preview");
    const mPreview = document.getElementById("milana-today-preview");
    if (vPreview) vPreview.innerText = vToday;
    if (mPreview) mPreview.innerText = mToday;

    const totalAchieved = vStats.achieved + mStats.achieved;
    const totalMax = vStats.max + mStats.max;

    const teamTotalEl = document.getElementById("team-total-score");
    const teamPercentEl = document.getElementById("team-percent-text");
    const teamProgressBar = document.getElementById("team-progress-bar");

    if (teamTotalEl) teamTotalEl.innerText = `${totalAchieved} / ${totalMax}`;

    const percent = totalMax > 0 ? Math.round((totalAchieved / totalMax) * 100) : 0;
    if (teamPercentEl) teamPercentEl.innerText = `${percent}%`;
    if (teamProgressBar) teamProgressBar.style.width = `${percent}%`;
  });
}

// -------------------------------------------------------------------
// 4. ОТРЕСОВКА И РАСЧЕТЫ
// -------------------------------------------------------------------
function renderWeekPills() {
  const container = document.getElementById("week-pills-container");
  if (!container) return;

  container.innerHTML = "";

  const current = parseLocalDate(selectedDate);
  const dayOfWeek = current.getDay();
  const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(current);
  monday.setDate(current.getDate() + distToMonday);

  const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  for (let i = 0; i < 7; i++) {
    const tempDate = new Date(monday);
    tempDate.setDate(monday.getDate() + i);

    const dateStr = formatDateToYYYYMMDD(tempDate);
    const isSelected = dateStr === selectedDate;

    const pill = document.createElement("div");
    pill.className = `day-pill ${isSelected ? 'active' : ''}`;
    
    const dayNum = String(tempDate.getDate()).padStart(2, '0');
    const monthNum = String(tempDate.getMonth() + 1).padStart(2, '0');

    pill.innerHTML = `
      <div class="pill-name">${dayNames[i]}</div>
      <div class="pill-date">${dayNum}.${monthNum}</div>
    `;

    pill.addEventListener("click", () => {
      selectedDate = dateStr;
      const dateInput = document.getElementById("date-select");
      if (dateInput) dateInput.value = selectedDate;
      renderWeekPills();
      renderTasks();
    });

    container.appendChild(pill);
  }
}

function renderTasks() {
  const { timetable } = getStudentContext();
  const subjectsContainer = document.getElementById("subjects-container");
  const habitsContainer = document.getElementById("habits-container");

  if (!subjectsContainer || !habitsContainer) return;

  subjectsContainer.innerHTML = "";
  habitsContainer.innerHTML = "";

  const dateObj = parseLocalDate(selectedDate);
  const dayOfWeek = dateObj.getDay(); 
  const subjects = timetable[dayOfWeek] || [];
  const dayScores = globalScores[selectedDate] || {};

  // Предметы
  if (subjects.length === 0) {
    subjectsContainer.innerHTML = "<p style='color: #7f8c8d;'><em>Wochenende (Выходной день — уроков нет)</em></p>";
  } else {
    subjects.forEach(subject => {
      const savedVal = dayScores[subject] !== undefined ? dayScores[subject] : 0;
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <span class="item-title">${subject}</span>
          <select onchange="updateScore('${selectedDate}', '${subject}', this.value)">
            <option value="0" ${savedVal == 0 ? 'selected' : ''}>0 - Nicht erledigt</option>
            <option value="2" ${savedVal == 2 ? 'selected' : ''}>2 - Grobe Fehler</option>
            <option value="3" ${savedVal == 3 ? 'selected' : ''}>3 - Ohne Gemini / Papa</option>
            <option value="4" ${savedVal == 4 ? 'selected' : ''}>4 - Gut (Mit Unsicherheiten)</option>
            <option value="5" ${savedVal == 5 ? 'selected' : ''}>5 - Perfekt (Erklärfähig)</option>
          </select>
        </div>
        <div class="item-desc">5 = Hausaufgabe + Gemini + Papa-Prüfung verstanden</div>
      `;
      subjectsContainer.appendChild(row);
    });
  }

  // Привычки
  dailyHabits.forEach(habit => {
    const savedVal = dayScores[habit.id] !== undefined ? dayScores[habit.id] : 0;
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-main">
        <span class="item-title">${habit.name}</span>
        <select onchange="updateScore('${selectedDate}', '${habit.id}', this.value)">
          ${[0, 1, 2, 3, 4, 5].map(v => `<option value="${v}" ${savedVal == v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="item-desc">${habit.desc}</div>
    `;
    habitsContainer.appendChild(row);
  });

  calculateStudentTotals();
}

function calculateStudentTotals() {
  const { timetable } = getStudentContext();

  // --- 1. РАСЧЕТ ЗА ДЕНЬ ---
  const dayScores = globalScores[selectedDate] || {};
  const dateObj = parseLocalDate(selectedDate);
  const dayOfWeek = dateObj.getDay();
  const subjects = timetable[dayOfWeek] || [];

  let dailyMax = (subjects.length * 5) + (dailyHabits.length * 5);
  let dailyAchieved = 0;

  subjects.forEach(s => { dailyAchieved += dayScores[s] || 0; });
  dailyHabits.forEach(h => { dailyAchieved += dayScores[h.id] || 0; });

  const dailyScoreEl = document.getElementById("daily-score");
  const dailyProgressEl = document.getElementById("daily-progress");
  if (dailyScoreEl) dailyScoreEl.innerText = `${dailyAchieved} / ${dailyMax}`;
  if (dailyProgressEl) {
    const percent = dailyMax > 0 ? (dailyAchieved / dailyMax) * 100 : 0;
    dailyProgressEl.style.width = `${percent}%`;
  }

  // --- 2. РАСЧЕТ ЗА НЕДЕЛЮ ---
  const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(dateObj);
  monday.setDate(dateObj.getDate() + distToMonday);

  let weeklyAchieved = 0;
  let weeklyMax = 0;

  for (let i = 0; i < 7; i++) {
    const tempDate = new Date(monday);
    tempDate.setDate(monday.getDate() + i);
    const dateStr = formatDateToYYYYMMDD(tempDate);
    const dScores = globalScores[dateStr] || {};

    const dWeek = tempDate.getDay();
    const dSubjects = timetable[dWeek] || [];

    weeklyMax += (dSubjects.length * 5) + (dailyHabits.length * 5);
    dSubjects.forEach(s => { weeklyAchieved += dScores[s] || 0; });
    dailyHabits.forEach(h => { weeklyAchieved += dScores[h.id] || 0; });
  }

  const weeklyScoreEl = document.getElementById("weekly-score");
  if (weeklyScoreEl) weeklyScoreEl.innerText = `${weeklyAchieved} / ${weeklyMax}`;

  const weeklyPercent = weeklyMax > 0 ? Math.round((weeklyAchieved / weeklyMax) * 100) : 0;
  const weeklyPercentTextEl = document.getElementById("weekly-percent-text");
  const weeklyProgressBarEl = document.getElementById("weekly-progress");

  if (weeklyPercentTextEl) weeklyPercentTextEl.innerText = `${weeklyPercent}%`;
  if (weeklyProgressBarEl) {
    weeklyProgressBarEl.style.width = `${weeklyPercent}%`;
    if (weeklyPercent >= 70) {
      weeklyProgressBarEl.classList.remove("weekly-progress-low");
      weeklyProgressBarEl.classList.add("weekly-progress-success");
    } else {
      weeklyProgressBarEl.classList.remove("weekly-progress-success");
      weeklyProgressBarEl.classList.add("weekly-progress-low");
    }
  }

  // Бейджи недели
  const badgeBronze = document.getElementById("badge-bronze");
  const badgeSilber = document.getElementById("badge-silber");
  const badgeGold = document.getElementById("badge-gold");

  if (badgeBronze) badgeBronze.classList.toggle("active", weeklyPercent >= 70);
  if (badgeSilber) badgeSilber.classList.toggle("active", weeklyPercent >= 80);
  if (badgeGold) badgeGold.classList.toggle("active", weeklyPercent >= 90);

  // --- 3. РАСЧЕТ ЗА МЕСЯЦ ---
  const statsMonth = getMonthStats(globalScores, timetable, selectedMonth);
  const monthlyAchieved = statsMonth.achieved;
  const monthlyMax = statsMonth.max;

  const monthlyScoreEl = document.getElementById("monthly-score");
  if (monthlyScoreEl) monthlyScoreEl.innerText = `${monthlyAchieved} / ${monthlyMax}`;

  const monthlyPercent = monthlyMax > 0 ? Math.round((monthlyAchieved / monthlyMax) * 100) : 0;
  const monthlyPercentTextEl = document.getElementById("monthly-percent-text");
  const monthlyProgressBarEl = document.getElementById("monthly-progress");

  if (monthlyPercentTextEl) monthlyPercentTextEl.innerText = `${monthlyPercent}%`;
  if (monthlyProgressBarEl) {
    monthlyProgressBarEl.style.width = `${monthlyPercent}%`;
    if (monthlyPercent >= 70) {
      monthlyProgressBarEl.classList.remove("monthly-progress-low");
      monthlyProgressBarEl.classList.add("weekly-progress-success");
    } else {
      monthlyProgressBarEl.classList.remove("weekly-progress-success");
      monthlyProgressBarEl.classList.add("monthly-progress-low");
    }
  }

  // Бейджи месяца
  const mBadgeBronze = document.getElementById("monthly-badge-bronze");
  const mBadgeSilber = document.getElementById("monthly-badge-silber");
  const mBadgeGold = document.getElementById("monthly-badge-gold");

  if (mBadgeBronze) mBadgeBronze.classList.toggle("active", monthlyPercent >= 70);
  if (mBadgeSilber) mBadgeSilber.classList.toggle("active", monthlyPercent >= 80);
  if (mBadgeGold) mBadgeGold.classList.toggle("active", monthlyPercent >= 90);
}

function getMonthStats(scores, timetable, monthStr) {
  let achieved = 0;
  let max = 0;

  const [yearStr, mStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayFormatted = String(day).padStart(2, '0');
    const dateStr = `${monthStr}-${dayFormatted}`;
    
    const dObj = new Date(year, month - 1, day);
    const dWeek = dObj.getDay();
    const dSubjects = timetable[dWeek] || [];
    const dScores = scores[dateStr] || {};

    max += (dSubjects.length * 5) + (dailyHabits.length * 5);
    dSubjects.forEach(s => { achieved += dScores[s] || 0; });
    dailyHabits.forEach(h => { achieved += dScores[h.id] || 0; });
  }

  return { achieved, max };
}

function getDayTotal(scores, dateStr) {
  const dayScores = scores[dateStr] || {};
  let sum = 0;
  Object.values(dayScores).forEach(val => { sum += val; });
  return sum;
}