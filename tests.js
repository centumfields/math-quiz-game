/* 점수 계산 · 랭킹 정렬 테스트.
 * Node:    node tests.js
 * 브라우저: test.html 을 열기 (서버 불필요) */
(function () {
  "use strict";
  var isNode = typeof module === "object" && module.exports;
  var L = isNode ? require("./logic.js") : window.QuizLogic;
  var results = [];

  function test(name, fn) {
    try { fn(); results.push({ name: name, ok: true }); }
    catch (e) { results.push({ name: name, ok: false, msg: e.message }); }
  }
  function eq(actual, expected, what) {
    var a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) throw new Error((what || "값") + ": 기대 " + b + " / 실제 " + a);
  }
  function rec(id, score, timeMs, at, key) {
    return { id: id, nick: id, key: key || "category:int-mul", label: "", score: score, correct: 0, total: 20, timeMs: timeMs, at: at };
  }
  function ids(list) { return list.map(function (r) { return r.id; }); }

  /* ----- 점수 ----- */
  test("오답은 0점 (감점 없음)", function () {
    eq(L.questionScore(false, 0), 0, "즉시 오답");
    eq(L.questionScore(false, 29000), 0, "늦은 오답");
  });
  test("즉시 정답은 15점 (10 + 보너스 5)", function () { eq(L.questionScore(true, 0), 15); });
  test("30초에 정답은 10점 (보너스 0)", function () { eq(L.questionScore(true, 30000), 10); });
  test("제한 시간을 넘겨도 10점 밑으로 내려가지 않음", function () { eq(L.questionScore(true, 45000), 10); });
  test("보너스는 남은 시간에 비례 (반올림)", function () {
    eq(L.bonusFor(0), 5, "0초");
    eq(L.bonusFor(6000), 4, "6초 (남은 80%)");
    eq(L.bonusFor(12000), 3, "12초 (남은 60%)");
    eq(L.bonusFor(15000), 3, "15초 (2.5 → 3)");
    eq(L.bonusFor(24000), 1, "24초 (남은 20%)");
    eq(L.bonusFor(30000), 0, "30초");
  });
  test("비정상 시간 값도 안전하게 처리", function () {
    eq(L.bonusFor(-500), 5, "음수는 최대 보너스");
    eq(L.bonusFor(NaN), 0, "NaN 은 보너스 없음");
  });
  test("20문제 만점은 300점, 80문제 1200, 240문제 3600", function () {
    eq(L.maxScore(20), 300);
    eq(L.maxScore(80), 1200);
    eq(L.maxScore(240), 3600);
    var total = 0, i;
    for (i = 0; i < 20; i++) total += L.questionScore(true, 0);
    eq(total, 300, "20문제 전부 즉시 정답");
  });
  test("20문제 전부 정답이지만 모두 30초 근처면 200점", function () {
    var total = 0, i;
    for (i = 0; i < 20; i++) total += L.questionScore(true, 30000);
    eq(total, 200);
  });

  /* ----- 랭킹 정렬 ----- */
  test("점수 높은 순", function () {
    eq(ids(L.sortRecords([rec("a", 100, 1, 1), rec("b", 250, 1, 2), rec("c", 180, 1, 3)])), ["b", "c", "a"]);
  });
  test("동점이면 소요 시간 짧은 순", function () {
    eq(ids(L.sortRecords([rec("a", 200, 90000, 1), rec("b", 200, 60000, 2), rec("c", 200, 75000, 3)])), ["b", "c", "a"]);
  });
  test("점수·시간이 같으면 먼저 달성한 순", function () {
    eq(ids(L.sortRecords([rec("late", 200, 60000, 50), rec("early", 200, 60000, 10), rec("mid", 200, 60000, 30)])), ["early", "mid", "late"]);
  });
  test("점수가 시간보다 우선", function () {
    eq(ids(L.sortRecords([rec("fast", 100, 1000, 1), rec("high", 101, 999999, 2)])), ["high", "fast"]);
  });
  test("정렬해도 원본 배열은 바뀌지 않음", function () {
    var src = [rec("a", 1, 1, 1), rec("b", 2, 1, 2)];
    L.sortRecords(src);
    eq(ids(src), ["a", "b"]);
  });

  /* ----- 랭킹 종류 · 순위 · 저장 개수 ----- */
  test("랭킹 키: 카테고리 / 영역 / 전체", function () {
    eq(L.rankKey("category", "int-mul"), "category:int-mul");
    eq(L.rankKey("area", "rat"), "area:rat");
    eq(L.rankKey("all", null), "all");
  });
  test("recordsFor 는 해당 종류만 정렬해서 돌려줌", function () {
    var all = [rec("a", 100, 1, 1, "all"), rec("b", 200, 1, 2, "category:nat-add"), rec("c", 300, 1, 3, "all")];
    eq(ids(L.recordsFor(all, "all")), ["c", "a"]);
  });
  test("addRecord: 내 순위와 전체 기록 수", function () {
    var base = [rec("a", 300, 1, 1), rec("b", 200, 1, 2), rec("c", 100, 1, 3)];
    var me = rec("me", 250, 1, 4);
    var r = L.addRecord(base, me, 100);
    eq(r.rank, 2, "순위");
    eq(r.total, 4, "전체");
    eq(r.kept, true, "저장 여부");
    eq(r.records.length, 4, "저장된 개수");
  });
  test("addRecord: 동점이면 먼저 달성한 사람이 앞, 새 기록은 뒤", function () {
    var base = [rec("old", 200, 60000, 1)];
    var r = L.addRecord(base, rec("me", 200, 60000, 2), 100);
    eq(r.rank, 2);
  });
  test("addRecord: 다른 종류의 기록은 순위에 영향 없음", function () {
    var base = [rec("x", 999, 1, 1, "category:nat-add")];
    var r = L.addRecord(base, rec("me", 10, 1, 2, "category:int-mul"), 100);
    eq(r.rank, 1);
    eq(r.total, 1);
    eq(r.records.length, 2, "다른 종류 기록은 그대로 보존");
  });
  test("addRecord: 종류별 상한(cap)을 넘으면 꼴찌부터 제거", function () {
    var base = [rec("a", 300, 1, 1), rec("b", 200, 1, 2), rec("c", 100, 1, 3)];
    var r = L.addRecord(base, rec("me", 50, 1, 4), 3);
    eq(r.rank, 4, "순위는 상한 이전 기준");
    eq(r.kept, false, "저장 안 됨");
    eq(ids(L.recordsFor(r.records, "category:int-mul")), ["a", "b", "c"]);
  });
  test("addRecord: 원본 배열은 바뀌지 않음", function () {
    var base = [rec("a", 300, 1, 1)];
    L.addRecord(base, rec("me", 10, 1, 2), 100);
    eq(base.length, 1);
  });

  /* ----- 저장값 방어 · 표시 ----- */
  test("sanitizeRecords: 망가진 값은 버림", function () {
    var out = L.sanitizeRecords([rec("ok", 1, 1, 1), null, "x", { nick: 1 }, { nick: "n", key: "k", score: "abc", correct: 0, total: 1, timeMs: 1, at: 1 }]);
    eq(ids(out), ["ok"]);
    eq(L.sanitizeRecords("garbage"), []);
    eq(L.sanitizeRecords(null), []);
  });
  test("formatTime", function () {
    eq(L.formatTime(45230), "45.2초");
    eq(L.formatTime(60000), "1분 00초");
    eq(L.formatTime(125900), "2분 05초");
  });

  /* ----- 추가 경계값 ----- */
  test("bonusFor: limitSec 를 직접 넘기면 그 기준으로 계산", function () {
    eq(L.bonusFor(5000, 10), 3, "10초 중 5초 (2.5 → 3)");
    eq(L.bonusFor(10000, 10), 0, "10초 중 10초");
    eq(L.questionScore(true, 0, 10), 15, "즉시 정답");
  });
  test("addRecord: 정확히 cap 번째 순위면 저장됨", function () {
    var base = [rec("a", 300, 1, 1), rec("b", 200, 1, 2)];
    var r = L.addRecord(base, rec("me", 100, 1, 3), 3);
    eq(r.rank, 3, "순위");
    eq(r.kept, true, "저장 여부");
    eq(ids(L.recordsFor(r.records, "category:int-mul")), ["a", "b", "me"]);
  });
  test("addRecord: cap 초과 시 새 기록이 상위면 기존 꼴찌가 밀려남", function () {
    var base = [rec("a", 300, 1, 1), rec("b", 200, 1, 2), rec("c", 100, 1, 3)];
    var r = L.addRecord(base, rec("me", 250, 1, 4), 3);
    eq(r.rank, 2, "순위");
    eq(r.kept, true, "저장 여부");
    eq(ids(L.recordsFor(r.records, "category:int-mul")), ["a", "me", "b"]);
  });
  test("sanitizeRecords: 닉네임은 10자로 자르고 id 가 없으면 만들어 줌", function () {
    var out = L.sanitizeRecords([{ nick: "열두글자가넘는닉네임입니다", key: "all", score: 10, correct: 1, total: 1, timeMs: 1000, at: 7 }]);
    eq(out.length, 1, "개수");
    eq(out[0].nick, "열두글자가넘는닉네임", "닉네임");
    eq(out[0].nick.length, 10, "길이");
    eq(out[0].id, "7-0", "대체 id");
    eq(out[0].label, "", "label 기본값");
  });
  test("sanitizeRecords: 숫자 문자열은 숫자로 바꾸고 Infinity 는 버림", function () {
    var good = { nick: "n", key: "all", score: "50", correct: "4", total: "5", timeMs: "9000", at: "1" };
    var bad = { nick: "n", key: "all", score: Infinity, correct: 0, total: 1, timeMs: 1, at: 1 };
    var out = L.sanitizeRecords([good, bad]);
    eq(out.length, 1, "개수");
    eq(out[0].score, 50, "score");
  });
  test("formatTime: 0 · 음수 · 경계", function () {
    eq(L.formatTime(0), "0.0초");
    eq(L.formatTime(-500), "0.0초", "음수는 0 으로");
    eq(L.formatTime(59900), "59.9초");
    eq(L.formatTime(3600000), "60분 00초");
  });

  test("RECORD_CAP 은 100", function () { eq(L.RECORD_CAP, 100); });

  /* ----- 결과 출력 ----- */
  var failed = results.filter(function (r) { return !r.ok; });
  var lines = results.map(function (r) { return (r.ok ? "PASS " : "FAIL ") + r.name + (r.ok ? "" : "  → " + r.msg); });
  lines.push("", (results.length - failed.length) + " / " + results.length + " 통과" + (failed.length ? " (실패 " + failed.length + ")" : ""));
  var text = lines.join("\n");

  if (isNode) {
    console.log(text);
    process.exit(failed.length ? 1 : 0);
  } else {
    var pre = document.getElementById("out");
    pre.textContent = text;
    document.title = failed.length ? "FAIL" : "PASS";
    document.body.className = failed.length ? "fail" : "pass";
  }
})();
