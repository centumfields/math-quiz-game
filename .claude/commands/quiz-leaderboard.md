---
description: 순위 시스템 관리 — 랭킹 규칙 점검, 리더보드 계산, 기록 정리 시뮬레이션
---

수학 연산 퀴즈의 순위(랭킹) 시스템을 점검하고 관리해 주세요. 인자: $ARGUMENTS

## 규칙 (기준은 `logic.js`)

- 점수: 정답이면 `10 + round(5 × 남은시간/30초)`, 오답·시간초과는 0점.
- 순위: 점수 높은 순 → 총 소요 시간 짧은 순 → `at`이 빠른 순(`compareRecords`).
- 랭킹은 모드별로 따로 셉니다: `category:<카테고리>`, `area:<영역>`, `all`(`rankKey`).
- 모드별로 상위 100개(`RECORD_CAP`)만 보관합니다(`addRecord`).
- "틀린 문제만 다시" 연습 플레이와 `?check=1`의 결과 건너뛰기는 저장되지 않습니다.
- 규칙을 바꿔야 하면 `logic.js`에서 고치고 `tests.js`에 테스트를 추가합니다. 앱 파일을 바꾸면 `sw.js`의 `VERSION`과 `app.js`의 `APP_VERSION`을 같은 값으로 올립니다.

## 1. 규칙 점검

1. `logic.js`와 `tests.js`를 읽어 위 규칙이 코드와 테스트에 모두 반영돼 있는지 확인합니다.
2. 테스트를 실행합니다. Node가 없으므로 헤드리스 Edge로 `test.html`을 엽니다(하네스 파일은 프로젝트 밖에).
   ```powershell
   msedge --headless=new --allow-file-access-from-files --virtual-time-budget=5000 --dump-dom "file:///C:/Users/user/OneDrive/Desktop/Vibe Coding/Study-03/test.html"
   ```
3. 점수 경계값(0초, 15초, 30초 남음, 반올림)과 동점 처리(점수 같음 → 시간 → `at`), 상위 100개 컷오프에 대한 테스트가 있는지 보고하고, 빠진 것은 추가 테스트를 제안합니다.

## 2. 리더보드 계산 (기록 파일이 인자로 주어졌을 때)

기록은 브라우저 `localStorage`의 `mathquiz.records.v1`에 있어 CLI에서 직접 읽을 수 없습니다. 인자로 내보낸 JSON 파일 경로를 받으면 그 파일로 계산하고, 없으면 내보내는 방법을 안내합니다.

```js
copy(localStorage.getItem("mathquiz.records.v1"))
```

- `sanitizeRecords`와 같은 기준으로 걸러 제외한 항목 수를 알려 줍니다.
- 인자에 모드가 있으면(`all`, `area:int`, `category:int-mul` 등) 그 모드만, 없으면 `all`과 모드별 1위를 보여 줍니다.
- 각 순위표는 상위 10위까지 `순위 | 닉네임 | 점수 | 정답/문항 | 소요 시간 | 일시` 열로 출력합니다. 시간은 `formatTime` 방식(초 단위)으로 보여 줍니다.
- 별도 스크립트(스크래치패드, `python`은 `%LOCALAPPDATA%\Programs\Python\Python313\python.exe`)로 `logic.js`와 같은 정렬을 구현해 계산하고, 동점 처리 결과가 `logic.js`와 일치하는지 확인합니다.

## 3. 기록 정리 시뮬레이션 (요청 시에만)

- 모드별 100개 초과분, 닉네임 길이 10자 초과, 점수와 정답 수가 맞지 않는 기록(점수 > 만점, 정답 0개인데 점수 > 0 등)을 찾아 목록으로 보여 줍니다.
- 정리한 결과는 **새 JSON 파일(스크래치패드)**로만 저장하고 원본은 건드리지 않습니다. 브라우저에 되돌리려면 콘솔에서 `localStorage.setItem("mathquiz.records.v1", '<JSON>')`를 실행하도록 안내합니다. 브라우저 저장소를 직접 지우거나 바꾸지 마세요.

## 4. 요약

| 항목 | 결과 | 비고 |
|---|---|---|
| 규칙 ↔ 코드 ↔ 테스트 일치 | | |
| 단위 테스트 | | |
| 리더보드 계산 | | |
| 이상 기록 | | |

사용자가 요청하기 전에는 프로젝트 파일과 기록 원본을 수정하지 마세요.
