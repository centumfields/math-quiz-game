#!/usr/bin/env python3
"""수학 연산 4지선다 문제 생성기. 정답은 fractions.Fraction 으로 직접 계산한다.

실행: python gen_questions.py  ->  questions.js (window.QUESTIONS = [...])
"""
import json
import os
import random
from fractions import Fraction
from math import gcd

SEED = 20260101
MINUS = "−"  # 유니코드 마이너스(−)

AREAS = [("nat", "자연수"), ("int", "정수"), ("rat", "유리수")]
OPS = [("add", "덧셈", "+"), ("sub", "뺄셈", MINUS), ("mul", "곱셈", "×"), ("div", "나눗셈", "÷")]
LEVELS = [("하", 7), ("중", 8), ("상", 5)]


# ---------- 표기 ----------
def fmt(x):
    x = Fraction(x)
    body = str(abs(x.numerator)) if x.denominator == 1 else f"{abs(x.numerator)}/{x.denominator}"
    return (MINUS if x < 0 else "") + body


def paren(x):
    s = fmt(x)
    return f"({s})" if Fraction(x) < 0 else s


def raw(n, d):
    """약분하지 않은 분수 표기 (풀이 설명용)."""
    return (MINUS if n < 0 else "") + f"{abs(n)}/{d}"


def paren_raw(n, d):
    s = raw(n, d)
    return f"({s})" if n < 0 else s


def lcm(a, b):
    return a * b // gcd(a, b)


def calc(op, a, b):
    return {"add": a + b, "sub": a - b, "mul": a * b, "div": a / b}[op]


# ---------- 오답 선택 ----------
def pick_distractors(ans, specific, fallback, valid):
    seen = {fmt(ans)}
    out = []

    def take(x):
        x = Fraction(x)
        if not valid(x):
            return
        s = fmt(x)
        if s in seen:
            return
        seen.add(s)
        out.append(x)

    spec = list(specific)
    random.shuffle(spec)
    for x in spec:
        if len(out) == 3:
            break
        take(x)
    tries = 0
    while len(out) < 3:
        take(fallback())
        tries += 1
        assert tries < 1000, "오답을 채우지 못했어요"
    return out


def digits_op(a, b, f):
    res, p = 0, 1
    while a > 0 or b > 0:
        res += f(a % 10, b % 10) * p
        a //= 10
        b //= 10
        p *= 10
    return res


# ---------- 자연수 ----------
def nat_operands(op, lv):
    r = random.randint
    if op == "add":
        lo, hi = {"하": (11, 49), "중": (100, 899), "상": (1000, 9999)}[lv]
        return r(lo, hi), r(lo, hi)
    if op == "sub":
        if lv == "하":
            a = r(20, 99)
            return a, r(10, a - 1)
        if lv == "중":
            a = r(300, 999)
            return a, r(100, a - 50)
        a = r(2000, 9999)
        return a, r(1000, a - 100)
    if op == "mul":
        if lv == "하":
            return r(2, 9), r(2, 9)
        if lv == "중":
            return r(12, 99), r(3, 9)
        return r(12, 99), r(11, 99)
    (blo, bhi), (qlo, qhi) = {"하": ((2, 9), (2, 9)), "중": ((3, 12), (11, 60)), "상": ((12, 25), (21, 99))}[lv]
    b, q = r(blo, bhi), r(qlo, qhi)
    return b * q, b


def nat_distractors(op, a, b, ans):
    if op == "add":
        spec = [digits_op(a, b, lambda x, y: (x + y) % 10),  # 받아올림 누락
                ans - 10, ans + 10, ans - 100, ans + 100, ans + 1, ans - 1]
    elif op == "sub":
        spec = [digits_op(a, b, lambda x, y: abs(x - y)),  # 받아내림 누락(큰 수에서 작은 수를 뺌)
                a + b, ans - 10, ans + 10, ans + 1, ans - 1, ans + 100]
    elif op == "mul":
        spec = [ans + a, ans - a, ans + b, ans - b, ans + 10, ans - 10, a + b]
        if b >= 10:
            spec.append(a * (b % 10) + a * (b // 10))  # 자리 올림(0 채우기) 누락
    else:
        spec = [ans + 1, ans - 1, ans + 10, ans - 10, a - b, a * b]
    return pick_distractors(
        Fraction(ans), spec,
        lambda: ans + random.choice([-1, 1]) * random.randint(1, 12),
        lambda x: x > 0 and x.denominator == 1)


# ---------- 정수 ----------
def int_operands(op, lv):
    r = random.randint
    while True:
        if op in ("add", "sub"):
            lo, hi = {"하": (1, 9), "중": (10, 60), "상": (61, 300)}[lv]
            a, b = r(lo, hi), r(lo, hi)
        elif op == "mul":
            (alo, ahi), (blo, bhi) = {"하": ((2, 9), (2, 9)), "중": ((11, 30), (2, 9)), "상": ((12, 50), (11, 30))}[lv]
            a, b = r(alo, ahi), r(blo, bhi)
            if random.random() < 0.5:
                a, b = b, a
        else:
            (blo, bhi), (qlo, qhi) = {"하": ((2, 6), (2, 9)), "중": ((3, 12), (6, 30)), "상": ((11, 25), (12, 60))}[lv]
            b, q = r(blo, bhi), r(qlo, qhi)
            a = b * q
        sa, sb = random.choice([1, -1]), random.choice([1, -1])
        if sa == 1 and sb == 1:
            continue  # 음수가 섞이도록
        a, b = a * sa, b * sb
        if calc(op, Fraction(a), Fraction(b)) == 0:
            continue
        return a, b


def int_distractors(op, a, b, ans):
    aa, ab = abs(a), abs(b)
    if op == "add":
        spec = [-ans, aa + ab, -(aa + ab), a - b, abs(aa - ab), -abs(aa - ab), ans + 1, ans - 1]
    elif op == "sub":
        spec = [-ans, a + b, -(a + b), a - ab, aa - ab, ans + 1, ans - 1]
    elif op == "mul":
        spec = [-ans, a + b, ans + aa, ans - aa, ans + ab, ans - ab, ans + 10, ans - 10]
    else:
        spec = [-ans, ans + 1, ans - 1, abs(ans) + 1, a - b, a * b]
    return pick_distractors(
        Fraction(ans), spec,
        lambda: ans + random.choice([-1, 1]) * random.randint(1, 12),
        lambda x: x != 0 and x.denominator == 1 and abs(x) < 10 ** 6)


# ---------- 유리수 ----------
def rand_frac(d, improper):
    hi = 2 * d - 1 if improper else d - 1
    while True:
        n = random.randint(1, hi)
        if gcd(n, d) == 1:
            return Fraction(n, d)


def rat_operands(op, lv):
    while True:
        if lv == "하":
            d1 = random.choice([2, 3, 4, 5, 6, 8, 10])
            d2 = d1 * random.choice([m for m in (1, 2, 3) if d1 * m <= 12])
            a, b = rand_frac(d1, False), rand_frac(d2, False)
            if random.random() < 0.5:
                a, b = b, a
            if op == "sub":
                if a == b:
                    continue
                if a < b:
                    a, b = b, a
        else:
            lo, hi, improper, pneg = (2, 9, False, 0.3) if lv == "중" else (3, 15, True, 0.5)
            d1, d2 = random.randint(lo, hi), random.randint(lo, hi)
            if op in ("add", "sub") and (d1 % d2 == 0 or d2 % d1 == 0):
                continue  # 통분이 필요하도록
            a, b = rand_frac(d1, improper), rand_frac(d2, improper)
            if random.random() < pneg:
                a = -a
            if random.random() < pneg:
                b = -b
        ans = calc(op, a, b)
        if ans == 0 or abs(ans) >= 100:
            continue
        return a, b


def rat_distractors(op, a, b, ans):
    n1, d1, n2, d2 = a.numerator, a.denominator, b.numerator, b.denominator
    L = lcm(d1, d2)
    spec = [-ans, ans + Fraction(1, L), ans - Fraction(1, L)]
    if op == "add":
        spec += [Fraction(n1 + n2, d1 + d2),  # 분모끼리도 더함 / 통분 안 함
                 Fraction(n1 + n2, L),  # 분모만 통분하고 분자는 그대로
                 a - b, a * b]
    elif op == "sub":
        spec += [Fraction(n1 - n2, d1 + d2), Fraction(n1 - n2, L), a + b, Fraction(n1 - n2, d1 * d2)]
    elif op == "mul":
        spec += [a + b, Fraction(n1 * n2, L), Fraction(n1 * n2, d1 + d2), a / b]
    else:
        spec += [a * b,  # 역수 미적용
                 b / a,  # 역수를 앞의 수에 적용
                 a + b, Fraction(n1 * n2, d1 + d2)]
    return pick_distractors(
        ans, spec,
        lambda: ans + random.choice([-1, 1]) * Fraction(random.randint(1, 3), L),
        lambda x: abs(x) < 1000)


# ---------- 풀이 / 개념 ----------
def explain(area, op, a, b, ans):
    A, B, R = fmt(a), paren(b), fmt(ans)
    if area == "nat":
        x, y, z = int(a), int(b), int(ans)
        if op == "add":
            return f"{x} + {y} = {z}. 일의 자리부터 차례로 더하고, 10이 넘으면 윗자리로 받아올려요."
        if op == "sub":
            return f"{x} {MINUS} {y} = {z}. 일의 자리에서 뺄 수 없으면 윗자리에서 10을 받아내려 계산해요."
        if op == "mul":
            if y >= 10:
                t = y // 10 * 10
                return (f"{x} × {y} = {x} × ({t} + {y % 10}) = {x * t} + {x * (y % 10)} = {z}. "
                        "곱하는 수를 자리별로 나눠 곱한 뒤 더해요.")
            return f"{x} × {y} = {z}. {x}씩 {y}번 더한 것과 같아요."
        return f"{x} ÷ {y} = {z}. {y} × {z} = {x}이니까 나눗셈은 곱셈을 거꾸로 생각하면 돼요."
    if area == "int":
        if op == "add":
            tail = ("음수끼리 더하면 절댓값을 더한 뒤 음수 부호를 붙여요." if a < 0 and b < 0
                    else "부호가 다르면 절댓값의 차를 구하고, 절댓값이 큰 쪽의 부호를 붙여요.")
            return f"{A} + {B} = {R}. {tail}"
        if op == "sub":
            return f"{A} {MINUS} {B} = {A} + {paren(-b)} = {R}. 빼는 수의 부호를 바꿔서 더하기로 바꿔요."
        same = (a < 0) == (b < 0)
        tail = "부호가 같으면 결과는 양수예요." if same else "부호가 다르면 결과는 음수예요."
        sym = "×" if op == "mul" else "÷"
        return f"{A} {sym} {B} = {R}. 절댓값끼리 계산한 뒤 부호를 정해요. {tail}"
    n1, d1, n2, d2 = a.numerator, a.denominator, b.numerator, b.denominator
    if op in ("add", "sub"):
        L = lcm(d1, d2)
        x1, x2 = n1 * (L // d1), n2 * (L // d2)
        n = x1 + x2 if op == "add" else x1 - x2
        sym = "+" if op == "add" else MINUS
        head = "분모가 같으니 분자끼리 계산해요" if d1 == d2 else f"통분(분모 {L})해서 계산해요"
        rawres = raw(n, L)
        tail = f" 기약분수로 나타내면 {R}." if rawres != R else ""
        return f"{head}: {raw(x1, L)} {sym} {paren_raw(x2, L)} = {rawres}.{tail}"
    if op == "mul":
        rawres = raw(n1 * n2, d1 * d2)
        tail = f" 약분해서 기약분수로 나타내면 {R}." if rawres != R else " 이미 기약분수예요."
        return f"분자끼리, 분모끼리 곱해요: {rawres}.{tail}"
    return f"나누는 수의 역수를 곱해요: {A} × {paren(1 / b)} = {R}."


def concept(area, op, a, b, lv):
    if area == "nat":
        return {
            "add": "일의 자리부터 더하고, 10이 넘으면 윗자리로 받아올려요",
            "sub": "일의 자리에서 뺄 수 없으면 윗자리에서 받아내려 계산해요",
            "mul": "곱셈은 같은 수를 여러 번 더한 것과 같아요" if lv == "하" else "큰 수는 자리별로 나눠 곱한 뒤 더해요",
            "div": "나눗셈은 곱셈의 거꾸로예요: 나누는 수와 곱해서 나누어지는 수가 되는 수를 찾아요",
        }[op]
    if area == "int":
        if op == "add":
            return ("음수와 음수를 더하면 절댓값을 더하고 음수 부호를 붙여요" if a < 0 and b < 0
                    else "부호가 다른 두 수를 더하면 절댓값이 큰 쪽의 부호를 따라요")
        if op == "sub":
            return "빼기는 빼는 수의 부호를 바꿔서 더하기로 바꿀 수 있어요"
        if op == "mul":
            return "음수와 음수를 곱하면 양수가 돼요" if a < 0 and b < 0 else "양수와 음수를 곱하면 음수가 돼요"
        return "음수를 음수로 나누면 양수가 돼요" if a < 0 and b < 0 else "부호가 다른 두 수를 나누면 음수가 돼요"
    same_den = a.denominator == b.denominator
    return {
        "add": "분모가 같으면 분자끼리 더해요" if same_den else "분모가 다르면 통분해서 더해요",
        "sub": "분모가 같으면 분자끼리 빼요" if same_den else "분모가 다르면 통분해서 빼요",
        "mul": "분수의 곱셈은 분자끼리, 분모끼리 곱하고 약분해요",
        "div": "분수로 나눌 때는 나누는 수의 역수를 곱해요",
    }[op]


# ---------- 생성 ----------
def make_operands(area, op, lv):
    if area == "nat":
        a, b = nat_operands(op, lv)
        return Fraction(a), Fraction(b)
    if area == "int":
        a, b = int_operands(op, lv)
        return Fraction(a), Fraction(b)
    return rat_operands(op, lv)


def make_distractors(area, op, a, b, ans):
    if area == "nat":
        return nat_distractors(op, int(a), int(b), int(ans))
    if area == "int":
        return int_distractors(op, int(a), int(b), int(ans))
    return rat_distractors(op, a, b, ans)


def build():
    random.seed(SEED)
    questions, seen, qid = [], set(), 1
    for akey, aname in AREAS:
        for okey, oname, sym in OPS:
            positions = [0, 1, 2, 3] * 5
            random.shuffle(positions)
            for lv, cnt in LEVELS:
                for _ in range(cnt):
                    while True:
                        a, b = make_operands(akey, okey, lv)
                        text = f"{fmt(a)} {sym} {paren(b)} = ?"
                        if text not in seen:
                            seen.add(text)
                            break
                    ans = calc(okey, a, b)
                    choices = [fmt(w) for w in make_distractors(akey, okey, a, b, ans)]
                    pos = positions.pop()
                    choices.insert(pos, fmt(ans))
                    questions.append({
                        "id": qid,
                        "area": aname,
                        "op": oname,
                        "category": f"{akey}-{okey}",
                        "level": lv,
                        "question": text,
                        "choices": choices,
                        "answerIndex": pos,
                        "explanation": explain(akey, okey, a, b, ans),
                        "concept": concept(akey, okey, a, b, lv),
                    })
                    qid += 1
    return questions


def main():
    questions = build()
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "questions.js")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("// 자동 생성 파일 (gen_questions.py). 직접 수정하지 마세요.\n")
        f.write("window.QUESTIONS = ")
        f.write(json.dumps(questions, ensure_ascii=False, indent=2))
        f.write(";\n")
    print(f"{len(questions)}문제를 {out} 에 저장했어요.")


if __name__ == "__main__":
    main()
