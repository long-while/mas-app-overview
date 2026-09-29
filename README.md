# Nalda 화면 미리보기

Nalda(마스토돈 앱) iOS · Android 프로토타입과 디자인 토큰을 한 페이지에서 보는 사이트입니다.

**보기:** https://long-while.github.io/mas-app-overview/

위쪽 막대에서 **보기**를 먼저 고르고, 그 보기에 필요한 설정(플랫폼, 테마, 글자 크기)을 고릅니다.

| 보기 | 내용 |
|---|---|
| 전체 화면 | 모든 화면을 한 페이지에. 왼쪽 목차(화면 묶음)를 누르면 그 묶음으로 이동하고, 스크롤하면 지금 보는 묶음이 표시됩니다. 오른쪽에 항상 보이는 스크롤 막대가 있습니다(휴대폰에서는 "목차" 버튼과 끌 수 있는 스크롤 막대). |
| 한 화면 | 화면 하나를 iOS / Android / 나란히로. 화면 목록이나 ‹ › (키보드 ← →)로 넘깁니다. |
| 아이콘 | `icons/`의 SVG 전부. INDEX.md의 표대로 묶고, 기본·채움 쌍을 함께 보여 줍니다. 16 / 20 / 24 / 32 크기, 검색(키 · 이름 · 파일 이름), 아이콘을 누르면 파일 이름 복사. 테마를 바꾸면 그 테마의 배경·글자색으로 그립니다. |
| 색상 | 테마 색 토큰 전부를 White · Dim · Black 열로. 이름은 Swift(`NaldaTheme.swift`) · Kotlin(`NaldaTheme.kt`) · 프로토타입 CSS 변수를 함께 적고, 뜻(주석)도 붙입니다. 고른 테마의 열이 강조됩니다. iOS와 Android 값이 다르면 "iOS ≠ Android", 프로토타입 값이 다르면 "프로토타입 값 다름" 표시. 이미지 뷰어 색, 아바타 자리표시 색, 프로토타입 CSS 고정 색도 있습니다. 이름이나 hex를 누르면 복사. |

- 고른 상태는 주소에 남으므로 링크를 그대로 공유할 수 있습니다. 예:
  - `?view=screen&p=both&theme=Dim&screen=chat`
  - `?sec=채팅` (전체 화면의 "채팅" 묶음)
  - `?view=icons&q=heart&isz=32`
  - `?view=colors&theme=Dim`
- 아이콘·색상 보기에서 `/`를 누르면 검색 칸으로 갑니다.
- 화면은 실제로 동작합니다(탭 이동, 좋아요, 글 작성 등).
- 사이트는 시스템의 라이트 / 다크 설정을 따릅니다.

이 저장소의 파일은 생성물입니다. 원본은 디자인 핸드오프 폴더의 `design/`, `icons/`, `swift/NaldaTheme.swift`, `android/NaldaTheme.kt`이고, `python tools/build-site.py <이 저장소 경로>`로 다시 만듭니다(`icons.json`, `tokens.json`, `overview-groups.json`도 이때 만들어집니다).
