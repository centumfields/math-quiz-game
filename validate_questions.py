#!/usr/bin/env python3
"""questions.js 검증. 하나라도 실패하면 종료 코드 1."""
import json
import os
import re
import sys
from collections import Counter, defaultdict
from fractions import Fraction

MINUS = "−"
AREAS = {"nat": "자연수", "int": "정수", "rat": "유리수"}
OPS = {"add": "덧셈", "sub": "뺄셈", "mul": "곱셈", "div": "나눗셈"}
SYMS = {"+": "add", MINUS: "sub", "×": "mul", "÷": "div"}
CATEGORIES = [f"{a}-{o}" for a in AREAS for o in OPS]
LEVEL_COUNTS = {"하": 7, "중": 8, "상": 5}
FIELDS = ["id", "area", "op", "category", "level", "question", "choices", "answerIndex", "explanation", "concept"]
EXPR = re.compile(rf"^(.+?) ([+{MINUS}×÷]) (.+) = \?$")


def fmt(x):
    x = Fraction(x)
    body = str(abs(x.numerator)) if x.denominator == 1 else f"{abs(x.numerator)}/{x.denominator}"
    return (MINUS if x < 0 else "") + body


def parse_num(s):
    s = s.strip()
    if s.startswith("(") and s.endswith(")"):
        s = s[1:-1]
    return Fraction(s.replace(MINUS, "-"))


def parse_question(text):
    m = EXPR.match(text)
    if not m:
        raise ValueError(f"문제식 형식 오류: {text!r}")
    return parse_num(m.group(1)), SYMS[m.group(2)], parse_num(m.group(3))


def calc(op, a, b):
    return {"add": a + b, "sub": a - b, "mul": a * b, "div": a / b}[op]


def load(path):
    text = open(path, encoding="utf-8").read()
    i = text.index("window.QUESTIONS =") + len("window.QUESTIONS =")
    return json.loads(text[i:].strip().rstrip(";"))


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "questions.js")
    qs = load(path)
    fails = defaultdict(list)  # 검사 번호 -> 메시지

    # 1. 개수 / 구조
    if len(qs) != 240:
        fails[1].append(f"총 {len(qs)}문제 (240 아님)")
    by_cat = defaultdict(list)
    for q in qs:
        missing = [f for f in FIELDS if f not in q]
        if missing:
            fails[1].append(f"id={q.get('id')} 필드 누락 {missing}")
            continue
        by_cat[q["category"]].append(q)
        if q["category"] not in CATEGORIES:
            fails[1].append(f"id={q['id']} 알 수 없는 category {q['category']}")
        elif (AREAS[q["category"][:3]], OPS[q["category"][4:]]) != (q["area"], q["op"]):
            fails[1].append(f"id={q['id']} area/op 가 category 와 다름")
        if not (isinstance(q["choices"], list) and len(q["choices"]) == 4
                and all(isinstance(c, str) for c in q["choices"])):
            fails[1].append(f"id={q['id']} choices 는 문자열 4개여야 해요")
        if q["answerIndex"] not in (0, 1, 2, 3):
            fails[1].append(f"id={q['id']} answerIndex 범위 오류")
    if len({q["id"] for q in qs}) != len(qs):
        fails[1].append("id 중복")
    for cat in CATEGORIES:
        items = by_cat.get(cat, [])
        if len(items) != 20:
            fails[1].append(f"{cat}: {len(items)}문제 (20 아님)")
        lv = Counter(q["level"] for q in items)
        if dict(lv) != LEVEL_COUNTS:
            fails[1].append(f"{cat}: 난이도 {dict(lv)} (7/8/5 아님)")

    # 2~4. 정답 재계산, 보기, 영역별 규칙
    for q in qs:
        if any(f not in q for f in FIELDS) or q["category"] not in CATEGORIES:
            continue
        try:
            a, op, b = parse_question(q["question"])
        except (ValueError, ZeroDivisionError) as e:
            fails[2].append(f"id={q['id']} {e}")
            continue
        area = q["category"][:3]
        if op != q["category"][4:]:
            fails[2].append(f"id={q['id']} 연산 기호가 category 와 다름")
        if b == 0 and op == "div":
            fails[2].append(f"id={q['id']} 0으로 나눔")
            continue
        want = calc(op, a, b)
        try:
            got = [parse_num(c) for c in q["choices"]]
        except ValueError:
            fails[2].append(f"id={q['id']} 보기 파싱 실패 {q['choices']}")
            continue
        if got[q["answerIndex"]] != want:
            fails[2].append(f"id={q['id']} {q['question']} 정답 {fmt(want)} != 보기 {q['choices'][q['answerIndex']]}")
        if sum(1 for g in got if g == want) != 1:
            fails[2].append(f"id={q['id']} 정답과 같은 값이 보기에 {sum(1 for g in got if g == want)}번 나와요")
        if len(set(q["choices"])) != 4 or len(set(got)) != 4:
            fails[3].append(f"id={q['id']} 보기 중복 {q['choices']}")
        if any("-" in c for c in q["choices"]) or "-" in q["question"]:
            fails[3].append(f"id={q['id']} ASCII 하이픈(-) 사용 (유니코드 − 로 통일)")
        if area == "rat":
            for c, g in zip(q["choices"], got):
                if c != fmt(g):
                    fails[4].append(f"id={q['id']} 기약분수 아님/표기 오류: {c}")
        else:
            if a.denominator != 1 or b.denominator != 1 or any(g.denominator != 1 for g in got):
                fails[4].append(f"id={q['id']} 정수 영역에 분수가 있어요")
            if area == "nat" and (a <= 0 or b <= 0 or any(g <= 0 for g in got)):
                fails[4].append(f"id={q['id']} 자연수 영역에 0 이하 수가 있어요")
            if area == "int" and a >= 0 and b >= 0:
                fails[4].append(f"id={q['id']} 정수 문제에 음수가 없어요")
        if op == "div" and area == "nat" and (a % b != 0 or want.denominator != 1):
            fails[4].append(f"id={q['id']} 자연수 나눗셈이 나누어떨어지지 않아요")

    # 3. 정답 위치 A~D 각 5회
    for cat in CATEGORIES:
        pos = Counter(q["answerIndex"] for q in by_cat.get(cat, []))
        if any(pos.get(i, 0) != 5 for i in range(4)):
            fails[3].append(f"{cat}: 정답 위치 {dict(sorted(pos.items()))} (각 5회 아님)")

    # 5. 문제 문장 중복
    dup = [t for t, n in Counter(q.get("question") for q in qs).items() if n > 1]
    fails[5] += [f"중복 문제: {t}" for t in dup]

    names = {
        1: "총 240문제 · 카테고리당 20 · 난이도 7/8/5",
        2: "문제식 재계산 = 정답 보기",
        3: "보기 중복 없음 · 정답 위치 A~D 각 5회",
        4: "유리수 기약분수 · 자연수 나눗셈 정수 몫",
        5: "문제 문장 중복 없음",
    }
    print("## 검증 결과\n")
    print("| # | 검사 항목 | 결과 | 실패 수 |")
    print("|---|-----------|------|---------|")
    for i in range(1, 6):
        print(f"| {i} | {names[i]} | {'FAIL' if fails[i] else 'PASS'} | {len(fails[i])} |")

    print("\n## 카테고리별 요약\n")
    print("| 카테고리 | 문제수 | 하/중/상 | 정답 위치 A/B/C/D |")
    print("|----------|--------|----------|-------------------|")
    for cat in CATEGORIES:
        items = by_cat.get(cat, [])
        lv = Counter(q["level"] for q in items)
        pos = Counter(q["answerIndex"] for q in items)
        print(f"| {cat} | {len(items)} | {lv['하']}/{lv['중']}/{lv['상']} | "
              f"{pos[0]}/{pos[1]}/{pos[2]}/{pos[3]} |")

    print("\n## 카테고리별 샘플 (하 1문제 + 상 1문제)\n")
    for cat in CATEGORIES:
        items = by_cat.get(cat, [])
        if not items:
            continue
        for q in (items[0], items[-1]):
            print(f"[{cat} · {q['level']}] #{q['id']}  {q['question']}")
            print("   " + "   ".join(f"{'ABCD'[i]}) {c}" for i, c in enumerate(q["choices"])))
            print(f"   정답: {'ABCD'[q['answerIndex']]}  | 풀이: {q['explanation']}")
            print(f"   개념: {q['concept']}")
        print()

    total = sum(len(v) for v in fails.values())
    if total:
        print(f"실패 {total}건:")
        for i in sorted(fails):
            for m in fails[i][:10]:
                print(f"  [검사 {i}] {m}")
        sys.exit(1)
    print("모든 검증을 통과했어요.")


if __name__ == "__main__":
    main()
