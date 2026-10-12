(function () {
  "use strict";

  var L = window.QuizLogic;
  var ALL = window.QUESTIONS || [];
  var LETTERS = ["A", "B", "C", "D"];
  var AREAS = [
    { key: "nat", name: "자연수" },
    { key: "int", name: "정수" },
    { key: "rat", name: "유리수" }
  ];
  var OPS = [
    { key: "add", name: "덧셈", sym: "+" },
    { key: "sub", name: "뺄셈", sym: "−" },
    { key: "mul", name: "곱셈", sym: "×" },
    { key: "div", name: "나눗셈", sym: "÷" }
  ];
  var SCREENS = ["home", "cat", "quiz", "result", "rank"];
  var CHECK = /[?&]check=1(&|$)/.test(location.search); // 점검용: 퀴즈 중 결과로 건너뛰기 버튼
  var LIMIT_MS = L.LIMIT_SEC * 1000;
  var KEYS = { records: "mathquiz.records.v1", muted: "mathquiz.muted.v1" };
  var APP_VERSION = "v4"; // 앱 파일을 고칠 때 sw.js 의 VERSION 과 같은 값으로 함께 올려요. 홈 화면 아래에 보여서 어떤 버전이 열려 있는지 알 수 있어요.
  var reloadPending = false; // 새 버전을 받았지만 퀴즈 중이라 홈으로 돌아올 때 다시 불러올 예정

  // pick: 카테고리 모드면 "int-mul" 같은 키, 영역 모드면 "int", 전체 모드면 null
  var state = {
    nick: "", mode: "category", pick: null, list: [], idx: 0, score: 0, answered: false,
    practice: false, answers: [], qStart: 0, timerId: null, shownSecs: -1, last: null
  };
  var store = { records: [], ok: true };
  var audio = { ctx: null, muted: false };
  var rankView = { mode: "category", pick: "nat-add" };
  var rankReturn = "home";

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function areaName(k) { return AREAS.filter(function (a) { return a.key === k; })[0].name; }
  function opName(k) { return OPS.filter(function (o) { return o.key === k; })[0].name; }
  // "category:int-mul" -> "정수 곱셈 (20문제)"
  function keyLabel(key) {
    var p = key.split(":");
    if (p[0] === "all") return "전체 (240문제)";
    if (p[0] === "area") return areaName(p[1]) + " 영역 (80문제)";
    var c = p[1].split("-");
    return areaName(c[0]) + " " + opName(c[1]) + " (20문제)";
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fmtDate(ms) {
    var d = new Date(ms);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  /* ---------- 수식 표시: "3/4" -> 위아래 분수, 음수 부호 강조 ---------- */
  // 분수 한 개를 만든다. 문제·보기·정답 표시·해설·개념이 모두 이 함수와 같은 CSS(.frac)를 써요.
  // 분수선은 border 가 아니라 별도 요소(.frac-bar)에 background: currentColor 로 그려요.
  function makeFrac(num, den) {
    var f = el("span", "frac");
    var bar = el("span", "frac-bar");
    bar.setAttribute("aria-hidden", "true");
    f.appendChild(el("span", "num", num));
    f.appendChild(bar);
    f.appendChild(el("span", "den", den));
    return f;
  }
  function renderMath(parent, text) {
    var re = /(−?)(\d+)(?:\/(\d+))?/g;
    var last = 0, m;
    parent.textContent = "";
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1]) parent.appendChild(el("span", "neg", "−"));
      if (m[3]) {
        parent.appendChild(makeFrac(m[2], m[3]));
      } else {
        parent.appendChild(document.createTextNode(m[2]));
      }
      last = re.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
    return parent;
  }
  // 스크린리더용 읽기 문자열
  function spoken(text) {
    return text
      .replace(/(\d+)\/(\d+)/g, "$2분의 $1")
      .replace(/−(?=\d)/g, "마이너스 ")
      .replace(/ − /g, " 빼기 ")
      .replace(/ \+ /g, " 더하기 ")
      .replace(/ × /g, " 곱하기 ")
      .replace(/ ÷ /g, " 나누기 ")
      .replace(/ = \?/, " 는?");
  }

  /* ---------- 저장소 (localStorage 가 막혀 있어도 게임은 동작) ---------- */
  function storageGet(key) {
    try { return window.localStorage.getItem(key); }
    catch (e) { store.ok = false; return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; }
    catch (e) { store.ok = false; return false; }
  }
  function showStoreNotice() {
    var text = "이 브라우저에서는 기록을 저장할 수 없어요. 게임은 할 수 있지만, 랭킹은 지금 켜 둔 동안만 보여요.";
    Array.prototype.forEach.call(document.querySelectorAll(".store-notice"), function (n) {
      n.textContent = text;
      n.hidden = store.ok;
    });
  }
  function loadStore() {
    var raw = storageGet(KEYS.records);
    if (raw) {
      try { store.records = L.sanitizeRecords(JSON.parse(raw)); }
      catch (e) { store.records = []; }
    }
    // 읽기만 되고 쓰기가 막힌 경우도 알아채도록 한 번 써 본다
    if (store.ok && !storageSet("mathquiz.probe", "1")) store.ok = false;
    if (store.ok) { try { window.localStorage.removeItem("mathquiz.probe"); } catch (e) { store.ok = false; } }
    audio.muted = storageGet(KEYS.muted) === "1";
    showStoreNotice();
  }
  function saveRecords() {
    storageSet(KEYS.records, JSON.stringify(store.records));
    showStoreNotice();
  }

  /* ---------- 효과음 (WebAudio, 파일 없이 소리를 만들어요) ---------- */
  function ensureAudio() {
    if (audio.ctx) return audio.ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audio.ctx = new AC();
    } catch (e) { audio.ctx = null; }
    return audio.ctx;
  }
  var SOUNDS = {
    correct: { type: "triangle", vol: 0.25, notes: [[660, 0, 0.1], [880, 0.1, 0.18]] },
    wrong: { type: "sawtooth", vol: 0.12, notes: [[220, 0, 0.18], [165, 0.16, 0.28]] },
    finish: { type: "triangle", vol: 0.25, notes: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.3]] }
  };
  function play(name) {
    if (audio.muted) return;
    var ctx = ensureAudio(), s = SOUNDS[name];
    if (!ctx || !s) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      var t0 = ctx.currentTime;
      s.notes.forEach(function (n) {
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = s.type;
        osc.frequency.value = n[0];
        gain.gain.setValueAtTime(0.0001, t0 + n[1]);
        gain.gain.exponentialRampToValueAtTime(s.vol, t0 + n[1] + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + n[1]);
        osc.stop(t0 + n[1] + n[2] + 0.02);
      });
    } catch (e) { /* 소리가 안 나도 게임은 계속돼요 */ }
  }
  function renderSoundButton() {
    var b = $("sound-btn");
    b.textContent = audio.muted ? "🔇" : "🔊";
    b.setAttribute("aria-pressed", String(audio.muted));
    b.setAttribute("aria-label", audio.muted ? "소리 켜기" : "소리 끄기");
  }
  function toggleSound() {
    audio.muted = !audio.muted;
    storageSet(KEYS.muted, audio.muted ? "1" : "0");
    showStoreNotice();
    renderSoundButton();
    if (!audio.muted) play("correct");
  }

  /* ---------- 화면 전환 ---------- */
  function go(name) {
    if (name === "home" && reloadPending) { reloadPending = false; location.reload(); return; }
    if (name !== "quiz") stopTimer();
    SCREENS.forEach(function (n) { $("screen-" + n).hidden = n !== name; });
    window.scrollTo(0, 0);
    var h = $("screen-" + name).querySelector("[data-focus]");
    if (h) h.focus({ preventScroll: true });
  }

  /* ---------- 1. 홈 ---------- */
  function selectedMode() {
    return document.querySelector('input[name="mode"]:checked').value;
  }
  function updateHomeButton() {
    $("home-go").textContent = selectedMode() === "all" ? "시작하기" : "다음";
  }
  function showNickError(msg) {
    var box = $("nick-error");
    box.textContent = msg || "";
    box.hidden = !msg;
    $("nick").setAttribute("aria-invalid", msg ? "true" : "false");
  }
  function onHomeSubmit(e) {
    e.preventDefault();
    var nick = $("nick").value.trim();
    if (!nick) {
      showNickError("이름을 먼저 적어 주세요!");
      $("nick").focus();
      return;
    }
    showNickError("");
    state.nick = nick;
    state.mode = selectedMode();
    if (state.mode === "all") start("all", null);
    else openCategories();
  }

  /* ---------- 2. 카테고리 선택 ---------- */
  function openCategories() {
    var byArea = state.mode === "area";
    $("cat-title").textContent = byArea ? "어느 영역을 풀까요?" : "어떤 계산을 풀까요?";
    $("cat-help").textContent = byArea
      ? "위에 있는 영역 이름을 눌러요. 그 영역의 80문제를 풀어요."
      : "카드 하나를 눌러요. 20문제를 풀어요.";
    var grid = $("cat-grid");
    grid.textContent = "";

    AREAS.forEach(function (a) {
      if (byArea) {
        var b = el("button", "col-head");
        b.type = "button";
        b.appendChild(el("span", "", a.name));
        b.appendChild(el("small", "", "80문제"));
        b.addEventListener("click", function () { start("area", a.key); });
        grid.appendChild(b);
      } else {
        grid.appendChild(el("div", "col-head", a.name));
      }
    });
    OPS.forEach(function (o) {
      AREAS.forEach(function (a) {
        var key = a.key + "-" + o.key;
        var c = el("button", "cat-card");
        c.type = "button";
        c.dataset.category = key;
        c.appendChild(el("span", "sym", o.sym));
        c.appendChild(el("span", "name", o.name));
        c.appendChild(el("small", "cnt", "20문제"));
        c.setAttribute("aria-label", a.name + " " + o.name + ", 20문제");
        if (byArea) c.disabled = true;
        else c.addEventListener("click", function () { start("category", key); });
        grid.appendChild(c);
      });
    });
    go("cat");
  }

  /* ---------- 3. 퀴즈 ---------- */
  function poolFor(mode, pick) {
    if (mode === "category") return ALL.filter(function (q) { return q.category === pick; });
    if (mode === "area") return ALL.filter(function (q) { return q.category.indexOf(pick + "-") === 0; });
    return ALL.slice();
  }
  function start(mode, pick) {
    state.mode = mode;
    state.pick = pick;
    begin(shuffle(poolFor(mode, pick)), false);
  }
  // practice: 틀린 문제 다시 풀기. 점수는 보여 주지만 랭킹에는 저장하지 않아요.
  function begin(list, practice) {
    state.list = list;
    state.practice = practice;
    state.idx = 0;
    state.score = 0;
    state.answers = [];
    state.last = null;
    ensureAudio(); // 버튼을 누른 순간에 만들어 두어야 소리가 나요
    go("quiz");
    $("skip").hidden = !CHECK;
    renderQuestion();
  }

  function stopTimer() {
    if (state.timerId !== null) { clearInterval(state.timerId); state.timerId = null; }
  }
  function startTimer() {
    stopTimer();
    state.qStart = Date.now();
    state.shownSecs = -1;
    state.timerId = setInterval(tick, 100);
    tick();
  }
  function tick() {
    var left = Math.max(0, LIMIT_MS - (Date.now() - state.qStart));
    var secs = Math.ceil(left / 1000);
    $("timer-fill").style.width = (left / LIMIT_MS * 100) + "%";
    if (secs !== state.shownSecs) {
      state.shownSecs = secs;
      $("timer-text").textContent = "⏱ " + secs + "초";
      $("timer").classList.toggle("low", secs <= 10);
    }
    if (left <= 0) finishQuestion(-1); // 시간 초과
  }

  function renderQuestion() {
    var q = state.list[state.idx], total = state.list.length;
    state.answered = false;
    $("score").textContent = "점수 " + state.score;
    $("progress-text").textContent = (state.idx + 1) + " / " + total + " 문제";
    var p = $("progress");
    p.setAttribute("aria-valuemax", String(total));
    p.setAttribute("aria-valuenow", String(state.idx + 1));
    $("bar").style.width = ((state.idx + 1) / total * 100) + "%";
    $("q-tag").textContent = q.area + " " + q.op + " · 난이도 " + q.level + (state.practice ? " · 연습" : "");

    var qt = $("q-text");
    renderMath(qt, q.question);
    qt.setAttribute("aria-label", spoken(q.question));

    var box = $("choices");
    box.textContent = "";
    q.choices.forEach(function (c, i) {
      var b = el("button", "choice");
      b.type = "button";
      b.setAttribute("aria-label", LETTERS[i] + ": " + spoken(c));
      b.appendChild(el("span", "letter", LETTERS[i]));
      b.appendChild(renderMath(el("span", "val"), c));
      b.appendChild(el("span", "mark"));
      b.addEventListener("click", function () { finishQuestion(i); });
      box.appendChild(b);
    });
    $("feedback").hidden = true;
    qt.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    startTimer();
  }

  // picked: 고른 보기 번호, 시간 초과면 -1
  function finishQuestion(picked) {
    if (state.answered) return;
    state.answered = true;
    stopTimer();
    var q = state.list[state.idx], timedOut = picked < 0;
    var ms = timedOut ? LIMIT_MS : Math.min(Date.now() - state.qStart, LIMIT_MS);
    var ok = !timedOut && picked === q.answerIndex;
    var pts = L.questionScore(ok, ms, L.LIMIT_SEC);
    state.score += pts;
    state.answers.push({ q: q, picked: picked, ok: ok, ms: ms, pts: pts });
    $("score").textContent = "점수 " + state.score;

    Array.prototype.forEach.call($("choices").children, function (b, k) {
      var mark = b.querySelector(".mark");
      b.disabled = true;
      if (k === q.answerIndex) {
        b.classList.add("correct");
        mark.textContent = "✓ 정답";
        b.setAttribute("aria-label", b.getAttribute("aria-label") + " (정답)");
      } else if (k === picked) {
        b.classList.add("wrong");
        mark.textContent = "✗ 내 답";
        b.setAttribute("aria-label", b.getAttribute("aria-label") + " (내가 고른 틀린 답)");
      } else {
        b.classList.add("dim");
      }
    });

    var fb = $("feedback");
    fb.className = "feedback " + (ok ? "ok" : "bad");
    $("fb-icon").textContent = ok ? "✓" : "✗";
    $("fb-title").textContent = ok ? "정답이에요!" : timedOut ? "시간이 다 됐어요!" : "아쉬워요. 다시 해 봐요!";
    $("fb-points").textContent = ok
      ? "+" + pts + "점 (기본 " + L.BASE_POINTS + "점 + 빠르기 보너스 " + (pts - L.BASE_POINTS) + "점)"
      : "이번 문제는 0점이에요. 감점은 없어요.";
    var ans = $("fb-answer");
    ans.textContent = "정답은 " + LETTERS[q.answerIndex] + "예요: ";
    ans.appendChild(renderMath(el("span"), q.choices[q.answerIndex]));
    renderMath($("fb-exp"), q.explanation);
    var concept = $("fb-concept");
    concept.textContent = "💡 ";
    concept.appendChild(renderMath(el("span"), q.concept));

    $("next").textContent = state.idx + 1 < state.list.length ? "다음" : "결과 보기";
    fb.hidden = false;
    fb.focus(); // 화면 안으로 스크롤되고, 스크린리더가 풀이를 읽어요
    play(ok ? "correct" : "wrong");
  }
  function next() {
    if (state.idx + 1 < state.list.length) {
      state.idx++;
      renderQuestion();
    } else {
      showResult(false);
    }
  }

  /* ---------- 4. 결과 ---------- */
  function newId() { return Date.now() + "-" + Math.random().toString(36).slice(2, 8); }
  function currentKey() { return L.rankKey(state.mode, state.pick); }

  // skipped: 점검용 건너뛰기. 기록을 저장하지 않아요.
  function showResult(skipped) {
    stopTimer();
    var total = state.list.length;
    var correct = state.answers.filter(function (a) { return a.ok; }).length;
    var timeMs = state.answers.reduce(function (s, a) { return s + a.ms; }, 0);
    var rankInfo = null;

    if (!state.practice && !skipped) {
      var rec = {
        id: newId(), nick: state.nick, key: currentKey(), label: keyLabel(currentKey()),
        score: state.score, correct: correct, total: total, timeMs: Math.round(timeMs), at: Date.now()
      };
      rankInfo = L.addRecord(store.records, rec, L.RECORD_CAP);
      store.records = rankInfo.records;
      saveRecords();
      state.last = rec;
    }

    $("r-who").textContent = state.nick + "님의 결과 · " + keyLabel(currentKey());
    $("r-score").textContent = state.score + "점";
    $("r-max").textContent = "만점 " + L.maxScore(total) + "점";
    var pct = correct / total * 100;
    $("r-msg").textContent = pct === 100 ? "모두 맞혔어요! 최고예요!"
      : pct >= 80 ? "정말 잘했어요!"
      : pct >= 50 ? "잘했어요! 조금만 더 해 봐요."
      : "괜찮아요. 또 해 보면 더 잘할 수 있어요!";
    $("r-correct").textContent = correct + " / " + total;
    $("r-time").textContent = L.formatTime(timeMs);
    if (rankInfo) {
      $("r-rank").textContent = rankInfo.rank + "위";
      $("r-rank-sub").textContent = rankInfo.kept ? "기록 " + rankInfo.total + "개 중" : "순위권 밖이라 저장하지 않았어요";
    } else {
      $("r-rank").textContent = "-";
      $("r-rank-sub").textContent = "";
    }
    var note = $("r-note");
    note.hidden = !(state.practice || skipped);
    note.textContent = skipped ? "점검용 건너뛰기라서 기록을 저장하지 않았어요."
      : "틀린 문제 연습이라서 랭킹에는 저장하지 않았어요.";
    $("retry-wrong").hidden = !state.answers.some(function (a) { return !a.ok; });
    $("result-rank").hidden = !rankInfo;
    showStoreNotice();
    go("result");
    if (!skipped) play("finish");
  }
  function retryWrong() {
    var wrong = state.answers.filter(function (a) { return !a.ok; }).map(function (a) { return a.q; });
    if (wrong.length) begin(shuffle(wrong), true);
  }

  /* ---------- 5. 랭킹 ---------- */
  function openRanking(fromScreen, key) {
    rankReturn = fromScreen;
    if (key) {
      var p = key.split(":");
      rankView = { mode: p[0], pick: p[1] || null };
    }
    renderRanking();
    go("rank");
  }
  function makeTab(parent, text, selected, onClick) {
    var b = el("button", "tab", text);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(selected));
    b.addEventListener("click", onClick);
    parent.appendChild(b);
  }
  function renderRanking() {
    var modes = [["category", "카테고리별"], ["area", "영역별"], ["all", "전체"]];
    var mbox = $("rank-modes"), sbox = $("rank-subs");
    mbox.textContent = "";
    sbox.textContent = "";
    modes.forEach(function (m) {
      makeTab(mbox, m[1], rankView.mode === m[0], function () {
        rankView.mode = m[0];
        rankView.pick = m[0] === "category" ? "nat-add" : m[0] === "area" ? "nat" : null;
        renderRanking();
      });
    });
    if (rankView.mode === "category") {
      OPS.forEach(function (o) {
        AREAS.forEach(function (a) {
          var k = a.key + "-" + o.key;
          makeTab(sbox, a.name + " " + o.name, rankView.pick === k, function () { rankView.pick = k; renderRanking(); });
        });
      });
    } else if (rankView.mode === "area") {
      AREAS.forEach(function (a) {
        makeTab(sbox, a.name, rankView.pick === a.key, function () { rankView.pick = a.key; renderRanking(); });
      });
    }
    sbox.hidden = rankView.mode === "all";

    var key = L.rankKey(rankView.mode, rankView.pick);
    var list = L.recordsFor(store.records, key);
    $("rank-heading").textContent = keyLabel(key) + " · 상위 10명";
    var box = $("rank-list");
    box.textContent = "";
    if (!list.length) {
      box.appendChild(el("p", "rank-empty", "아직 기록이 없어요. 첫 번째 주인공이 되어 봐요!"));
    } else {
      var table = el("table", "rank-table");
      var head = el("tr");
      ["순위", "이름", "점수", "정답", "시간"].forEach(function (h) { head.appendChild(el("th", "", h)); });
      table.appendChild(head);
      var lastId = state.last ? state.last.id : null;
      var addRow = function (r, rank) {
        var tr = el("tr", r.id === lastId ? "me" : "");
        var medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
        tr.appendChild(el("td", "n", medal ? medal + " " + rank : String(rank)));
        var who = el("td", "who", r.nick);
        who.appendChild(el("span", "when", fmtDate(r.at)));
        tr.appendChild(who);
        tr.appendChild(el("td", "num", r.score + "점"));
        tr.appendChild(el("td", "num", r.correct + "/" + r.total));
        tr.appendChild(el("td", "num", L.formatTime(r.timeMs)));
        table.appendChild(tr);
      };
      list.slice(0, 10).forEach(function (r, i) { addRow(r, i + 1); });
      var mineAt = lastId ? list.map(function (r) { return r.id; }).indexOf(lastId) : -1;
      if (mineAt >= 10) {
        var gap = el("tr", "gap");
        var gtd = el("td", "", "⋮");
        gtd.colSpan = 5;
        gap.appendChild(gtd);
        table.appendChild(gap);
        addRow(list[mineAt], mineAt + 1);
      }
      box.appendChild(table);
    }
    showStoreNotice();
  }
  function resetRecords() {
    if (!window.confirm("모든 랭킹 기록을 지울까요? 지운 기록은 되돌릴 수 없어요.")) return;
    store.records = [];
    state.last = null;
    saveRecords();
    renderRanking();
  }

  /* ---------- 이벤트 ---------- */
  function init() {
    $("app-version").textContent = "앱 버전 " + APP_VERSION;
    loadStore();
    renderSoundButton();
    $("sound-btn").addEventListener("click", toggleSound);
    if (!ALL.length) {
      showNickError("문제 파일(questions.js)을 찾지 못했어요. index.html과 같은 폴더에 있는지 확인해 주세요.");
      $("home-go").disabled = true;
      return;
    }
    $("home-form").addEventListener("submit", onHomeSubmit);
    $("nick").addEventListener("input", function () { if (this.value.trim()) showNickError(""); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (r) {
      r.addEventListener("change", updateHomeButton);
    });
    updateHomeButton();
    $("home-rank").addEventListener("click", function () { openRanking("home"); });
    $("cat-back").addEventListener("click", function () { go("home"); });
    $("quit").addEventListener("click", function () {
      if (window.confirm("퀴즈를 그만할까요?")) go("home");
    });
    $("next").addEventListener("click", next);
    $("skip").addEventListener("click", function () { showResult(true); });
    $("retry").addEventListener("click", function () { start(state.mode, state.pick); });
    $("retry-wrong").addEventListener("click", retryWrong);
    $("result-rank").addEventListener("click", function () {
      openRanking("result", state.last ? state.last.key : currentKey());
    });
    $("to-home").addEventListener("click", function () { go("home"); });
    $("rank-back").addEventListener("click", function () { go(rankReturn); });
    $("rank-reset").addEventListener("click", resetRecords);
    document.addEventListener("keydown", function (e) {
      if ($("screen-quiz").hidden || state.answered || e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key.toUpperCase(), i = LETTERS.indexOf(k);
      if (i < 0 && k >= "1" && k <= "4") i = Number(k) - 1;
      if (i >= 0) finishQuestion(i);
    });
    go("home");
  }

  // 오프라인 실행용 서비스 워커. file:// 로 열었을 땐 지원되지 않으니 건너뛰어요(게임은 그대로 동작).
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    // 이미 설치된 앱이 새 버전을 받으면(첫 설치는 제외) 홈 화면에서 바로 다시 불러와요.
    // 퀴즈를 푸는 중이면 진행을 잃지 않도록 홈으로 돌아올 때 다시 불러와요.
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController) { hadController = true; return; }
      if (!$("screen-home").hidden) location.reload();
      else reloadPending = true;
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* 실패해도 게임은 계속돼요 */ });
    });
  }

  init();
  registerServiceWorker();
})();
