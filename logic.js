/* 점수 계산 · 랭킹 정렬 등 화면과 상관없는 순수 로직.
 * 브라우저에서는 window.QuizLogic, Node에서는 require("./logic.js") 로 쓴다. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.QuizLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BASE_POINTS = 10;  // 정답 기본 점수
  var MAX_BONUS = 5;     // 속도 보너스 최대
  var LIMIT_SEC = 30;    // 문제당 제한 시간

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // 남은 시간에 비례한 보너스 0~5점 (반올림)
  function bonusFor(elapsedMs, limitSec) {
    var limitMs = (limitSec || LIMIT_SEC) * 1000;
    if (!isFinite(elapsedMs)) return 0;
    return Math.round(MAX_BONUS * clamp(1 - elapsedMs / limitMs, 0, 1));
  }
  // 정답이면 10 + 보너스, 오답·시간 초과는 0점(감점 없음)
  function questionScore(correct, elapsedMs, limitSec) {
    return correct ? BASE_POINTS + bonusFor(elapsedMs, limitSec) : 0;
  }
  function maxScore(questionCount) { return questionCount * (BASE_POINTS + MAX_BONUS); }

  /* ---------- 랭킹 ---------- */
  // 점수 높은 순 → 소요 시간 짧은 순 → 먼저 달성한 순
  function compareRecords(a, b) {
    return (b.score - a.score) || (a.timeMs - b.timeMs) || (a.at - b.at);
  }
  function sortRecords(records) { return records.slice().sort(compareRecords); }

  // 랭킹은 종류별로 따로 센다: "category:int-mul" / "area:int" / "all"
  function rankKey(mode, pick) { return mode === "all" ? "all" : mode + ":" + pick; }
  function recordsFor(records, key) {
    return sortRecords(records.filter(function (r) { return r.key === key; }));
  }

  // 새 기록을 넣고 {records, rank, total, kept} 를 돌려준다. 종류별로 상위 cap개만 남긴다.
  function addRecord(records, rec, cap) {
    var same = [], others = [];
    records.forEach(function (r) { (r.key === rec.key ? same : others).push(r); });
    same.push(rec);
    same.sort(compareRecords);
    var rank = same.indexOf(rec) + 1, total = same.length;
    if (cap && same.length > cap) same = same.slice(0, cap);
    return { records: others.concat(same), rank: rank, total: total, kept: same.indexOf(rec) >= 0 };
  }

  // localStorage 에서 읽은 값이 망가져 있어도 게임이 멈추지 않게 걸러낸다.
  function sanitizeRecords(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.forEach(function (r, i) {
      if (!r || typeof r !== "object") return;
      var score = Number(r.score), correct = Number(r.correct), total = Number(r.total);
      var timeMs = Number(r.timeMs), at = Number(r.at);
      if (typeof r.nick !== "string" || typeof r.key !== "string") return;
      if (![score, correct, total, timeMs, at].every(isFinite)) return;
      out.push({
        id: typeof r.id === "string" ? r.id : at + "-" + i,
        nick: r.nick.slice(0, 10), key: r.key, label: typeof r.label === "string" ? r.label : "",
        score: score, correct: correct, total: total, timeMs: timeMs, at: at
      });
    });
    return out;
  }

  /* ---------- 표시용 ---------- */
  function formatTime(ms) {
    var s = Math.max(0, ms) / 1000;
    if (s < 60) return s.toFixed(1) + "초";
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + "분 " + (r < 10 ? "0" : "") + r + "초";
  }

  return {
    BASE_POINTS: BASE_POINTS, MAX_BONUS: MAX_BONUS, LIMIT_SEC: LIMIT_SEC,
    bonusFor: bonusFor, questionScore: questionScore, maxScore: maxScore,
    compareRecords: compareRecords, sortRecords: sortRecords, rankKey: rankKey,
    recordsFor: recordsFor, addRecord: addRecord, sanitizeRecords: sanitizeRecords,
    formatTime: formatTime
  };
});
