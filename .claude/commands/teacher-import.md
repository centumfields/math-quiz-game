---
description: 학생들이 내보낸 기록 JSON 여러 개를 검증·병합해 선생님용 통합 기록(teacher-data/records.json)으로 저장
---

여러 학생의 플레이 기록 파일을 하나로 합쳐 주세요. 이후 `/teacher-*` 명령들은 모두 이 결과를 읽습니다. 인자(내보낸 JSON 파일 경로들, 공백으로 구분): $ARGUMENTS

## 배경

- 기록은 각 학생 기기의 브라우저 `localStorage`(`mathquiz.records.v1`)에만 있어 CLI에서 직접 읽을 수 없습니다. 학생이 브라우저 콘솔에서 `copy(localStorage.getItem("mathquiz.records.v1"))`을 실행해 JSON 파일로 저장해 보내야 합니다. 인자가 없으면 이 방법을 안내하고, 이미 `teacher-data/records.json`이 있으면 그 파일의 현황만 보여 주고 끝냅니다.
- 한 기록의 필드: `id, nick, key, label, score, correct, total, timeMs, at`. `key`는 `category:int-mul` / `area:int` / `all`.
- 학생 식별자는 **닉네임뿐**입니다. 서로 다른 기기에서 같은 닉네임이 나오면 같은 학생으로 합쳐지므로, 그런 경우를 보고합니다.

## 절차

1. 인자의 각 파일을 읽습니다. 파일이 없거나 JSON이 아니면 그 파일은 제외하고 이유를 보고합니다(전부 실패하면 중단).
2. `logic.js`의 `sanitizeRecords`와 같은 기준으로 거릅니다: `nick`·`key`는 문자열, `score/correct/total/timeMs/at`은 유한한 수. 닉네임은 10자로 자릅니다.
3. 추가로 이상 기록을 표시합니다(제외하지는 않고 `flag`만 붙임): 점수 > `total × 15`, `correct > total`, `correct == 0`인데 `score > 0`, `key`가 형식에 맞지 않음, `timeMs < 0`.
4. 중복 제거: `nick`, `key`, `at`, `score`, `timeMs`가 모두 같은 기록은 한 번만 남깁니다(같은 파일을 두 번 받은 경우 방지).
5. 결과를 `teacher-data/records.json`(UTF-8, 들여쓰기 2칸)에 저장합니다. 폴더가 없으면 만들고, 기존 파일이 있으면 `teacher-data/records.<YYYYMMDD-HHMMSS>.bak.json`으로 먼저 복사합니다. **이 폴더 밖의 프로젝트 파일은 수정하지 않습니다.**
6. **검증:** 저장한 파일을 다시 읽어 개수가 메모리의 개수와 같아야 합니다. 다르면 중단하고 보고합니다.

## 보고

- 읽은 파일 수/제외한 파일(이유), 읽은 기록 수 → 걸러진 수 → 중복 제거 수 → 최종 수.
- 학생(닉네임) 수와 닉네임별 기록 수, 이상 기록 목록(`id`, 닉네임, 이유), 같은 닉네임이 여러 파일에서 나온 경우.
- 학생 개인 정보가 들어 있으므로 `teacher-data/`는 커밋하지 않습니다(`.gitignore` 확인).

계산용 스크립트는 스크래치패드에 두고, Python은 `%LOCALAPPDATA%\Programs\Python\Python313\python.exe`를 `PYTHONIOENCODING=utf-8`로 씁니다(Node 없음). 커밋·푸시는 요청 전에는 하지 않습니다.
