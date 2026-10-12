---
description: 문제 데이터 재생성·검증, 단위 테스트, 캐시 버전 일치 여부를 한 번에 점검
---

수학 연산 퀴즈 프로젝트의 상태를 아래 순서대로 점검하고, 마지막에 결과를 표로 요약해 주세요. 인자가 있으면 참고하세요: $ARGUMENTS

## 1. 문제 데이터 재생성 및 검증

`python`은 Microsoft Store 스텁일 수 있으므로 실제 인터프리터를 사용합니다.

```powershell
$py = "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
& $py gen_questions.py
& $py validate_questions.py
```

- `validate_questions.py`가 종료 코드 1이면 실패한 검사 항목을 그대로 보고합니다.
- `questions.js`는 직접 수정하지 말고, 문제가 있으면 `gen_questions.py`를 고친 뒤 두 스크립트를 다시 실행합니다.
- 확인할 것: 12개 카테고리 × 20문항 = 240문항, 난이도 하/중/상 = 7/8/5, 정답 위치 A–D 각 5개, 유리수 정답·보기는 기약분수, 마이너스는 `−`(U+2212).

## 1-1. 전체 문제 정답 정확성 검증 (독립 재계산)

`validate_questions.py`의 결과를 그대로 믿지 말고, **별도의 일회용 스크립트**로 240문항 전부를 다시 계산해 교차 검증합니다. 스크립트는 프로젝트 밖(스크래치패드)에 두고, `questions.js`를 읽기만 합니다(`window.QUESTIONS = ` 뒤의 JSON 배열을 파싱).

각 문항(`id`, `question`, `choices`, `answerIndex`, `explanation`)에 대해 다음을 검사합니다.

1. `question`(`"a op b = ?"`, 음수 둘째 피연산자는 괄호, `−`는 U+2212)을 직접 파싱해 `fractions.Fraction`으로 정확히 계산합니다. 연산자는 `+`, `−`, `×`, `÷`를 모두 처리하고, 0으로 나누는 문항이 없는지도 봅니다.
2. `choices[answerIndex]`의 값이 재계산한 정답과 정확히 같은지 확인합니다.
3. 나머지 보기 3개는 정답과 다르고, 보기 4개가 서로 중복되지 않는지 확인합니다. 보기가 모두 같은 수 표기 형식(정수/분수)인지도 봅니다.
4. 유리수 문항은 정답과 보기가 모두 기약분수이고, 분모가 1인 `"n/1"`이나 음수 분모가 없는지 확인합니다.
5. `explanation`이 `"<question 식> = <정답>"`으로 시작하고, 그 정답이 재계산 값과 같은지 확인합니다.
6. 카테고리별 문항 수 20, 난이도 7/8/5, `answerIndex` 0–3이 각 5개인지 다시 셉니다.
7. `id`가 1–240으로 유일하고, `category`가 `area`/`op`와 일치하는지 확인합니다.

보고 형식:
- 총 검사 문항 수, 통과 수, 실패 수.
- 실패 문항은 `id`, `question`, 기대 정답, 실제 표시된 정답, 어긋난 검사 번호를 목록으로 모두 나열합니다.
- 전부 통과하면 "240문항 모두 정답 확인"이라고 명확히 말합니다.
- 실패가 있으면 `questions.js`를 직접 고치지 말고 `gen_questions.py`의 원인을 찾아 수정안을 제시합니다.

## 2. 단위 테스트 (점수 + 랭킹)

Node가 설치되어 있지 않으므로 `node tests.js`는 시도하지 않습니다. 브라우저에서 `test.html`을 여는 방식으로 확인하거나, 헤드리스 Edge로 실행합니다(하네스 파일은 프로젝트 밖에 두기).

```powershell
msedge --headless=new --allow-file-access-from-files --virtual-time-budget=5000 --dump-dom "file:///C:/Users/user/OneDrive/Desktop/Vibe Coding/Study-03/test.html"
```

- 통과/실패 개수를 보고하고, 실패 시 해당 테스트 이름을 알려 줍니다.

## 3. 버전 일치 확인

`sw.js`의 `VERSION`과 `app.js`의 `APP_VERSION`이 같은 값인지 확인합니다.

- 두 값이 다르면 불일치를 알리고 맞추도록 제안합니다.
- 앱 파일(`index.html`, `style.css`, `app.js`, `logic.js`, `questions.js` 등)이 `sw.js`의 `VERSION`이 마지막으로 바뀐 시점보다 나중에 수정됐다면, 버전을 올려야 할 수 있음을 알려 줍니다.
- 앱에 필요한 파일이 `sw.js`의 `ASSETS`에 모두 들어 있는지도 확인합니다.

## 4. 요약

| 항목 | 결과 | 비고 |
|---|---|---|
| 데이터 재생성 | | |
| 데이터 검증 | | |
| 전체 정답 재계산 (240문항) | | |
| 단위 테스트 | | |
| 버전 일치 | | |

실패한 항목이 있으면 원인과 수정 방향을 한두 줄로 덧붙이세요. 사용자가 요청하기 전에는 파일을 수정하지 마세요.
