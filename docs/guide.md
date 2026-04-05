# AlphaKey Password Manager 확장프로그램 개발 가이드

## 브라우저 확장프로그램이란?

브라우저에 설치하는 작은 프로그램. 웹페이지 위에 기능을 추가하거나, 백그라운드에서 동작할 수 있다. 1Password, LastPass 같은 패스워드 매니저도 확장프로그램이다.

---

## 이 프로젝트에서 사용한 기술

| 기술 | 역할 | 왜 선택했는가 |
| --- | --- | --- |
| **WXT** | 확장프로그램 빌드 프레임워크 | Vite 기반, 핫 리로드, 멀티 브라우저 빌드를 한 번에 해줌 |
| **Manifest V3** | Chrome 확장프로그램 표준 규격 | Chrome/Edge의 현재 표준 (V2는 폐지 예정) |
| **React 18** | UI 프레임워크 | 설정 페이지, 팝업 UI 렌더링 |
| **TypeScript** | 언어 | 타입 안전성 |
| **chrome.storage** | 데이터 저장 | 확장프로그램 전용 로컬 스토리지 (localStorage와 다름) |

---

## 프로젝트 구조

```
alphakey-password-manager/
│
├── entrypoints/          ← 확장프로그램의 "진입점"들 (가장 중요)
│   ├── background.ts     ← 백그라운드 서비스 워커
│   ├── content.ts        ← 콘텐츠 스크립트
│   ├── popup/            ← 팝업 UI (아이콘 클릭 시)
│   └── options/          ← 설정 페이지
│
├── utils/                ← 공통 유틸리티
│   ├── storage.ts        ← 데이터 저장/조회 + URL 매칭
│   └── form-detector.ts  ← 폼 요소 자동 탐지
│
├── public/               ← 정적 파일 (아이콘 등)
├── wxt.config.ts         ← WXT 설정 (manifest.json 자동 생성)
├── package.json
└── .output/chrome-mv3/   ← 빌드 결과물 (이 폴더를 Chrome에 로드)
```

---

## 확장프로그램의 3가지 영역

확장프로그램은 **서로 다른 환경에서 실행되는 3개의 코드**로 구성된다. 이게 핵심이다.

```
┌─────────────────────────────────────────────────────────┐
│                    브라우저                                │
│                                                          │
│   ┌─────────────────┐                                    │
│   │  Background      │  항상 실행 (브라우저가 켜져있는 동안)   │
│   │  (Service Worker) │  → API 통신, URL 감시, 데이터 관리   │
│   └────────┬─────────┘                                    │
│            │ chrome.runtime.sendMessage()                  │
│            │ (서로 메시지를 주고받음)                         │
│   ┌────────┴─────────┐                                    │
│   │  Content Script   │  웹페이지마다 실행                   │
│   │                   │  → DOM 접근, 폼 탐지, 값 입력        │
│   └──────────────────┘                                    │
│                                                          │
│   ┌──────────────────┐   ┌──────────────────┐            │
│   │  Popup            │   │  Options          │            │
│   │  (아이콘 클릭)      │   │  (설정 페이지)     │            │
│   └──────────────────┘   └──────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### 왜 분리되어 있는가?

- **Content Script**는 웹페이지의 DOM에 접근할 수 있지만, 확장프로그램 API를 직접 쓸 수 없다
- **Background**는 확장프로그램 API를 쓸 수 있지만, 웹페이지 DOM에 접근할 수 없다
- 그래서 둘이 **메시지**로 통신한다

---

## 각 파일이 하는 일

### 1. `entrypoints/background.ts` — 두뇌

> 브라우저가 켜져있는 동안 백그라운드에서 항상 실행

**하는 일:**
- 탭의 URL이 바뀔 때마다 감지 (`chrome.tabs.onUpdated`)
- 바뀐 URL이 등록된 URL인지 비교
- 매칭되면 Content Script에 "이 페이지 로그인 페이지야" 메시지 전송
- Content Script가 발견한 폼 메타데이터를 저장소에 저장

**핵심 코드 흐름:**
```
탭 URL 변경 → findMatchingStep(url) → 매칭됨?
  → Yes: Content Script에 메시지 + 뱃지 ✓ 표시
  → No: 무시
```

### 2. `entrypoints/content.ts` — 손과 눈

> 웹페이지가 열릴 때마다 해당 페이지 안에서 실행

**하는 일:**
- 현재 URL이 등록된 URL인지 Background에 물어봄
- 매칭되면 `form-detector.ts`로 폼 요소(아이디/비밀번호/로그인 버튼) 탐지
- 찾은 결과를 Background에 보고 (→ 저장소에 저장됨)
- 토스트 팝업으로 감지 결과 표시
- 감지된 필드에 하이라이트 표시 (파란색=아이디, 빨간색=비밀번호, 초록색=버튼)

**SPA 대응:**
- `MutationObserver`로 DOM 변경 감시 → 새 폼 요소가 나타나면 재탐지
- URL 변경 감시 (SPA는 페이지 리로드 없이 URL이 바뀜)
- `popstate` 이벤트 감시 (뒤로가기/앞으로가기)

**핵심 코드 흐름:**
```
페이지 로드 → Background에 URL 체크 요청
  → 매칭됨: 토스트 "URL 감지"
  → 0.8초 후: detectLoginFormFields() 실행
  → 폼 발견: 토스트 "폼 감지 완료" + 하이라이트 + Background에 보고
```

### 3. `utils/form-detector.ts` — 폼 탐지 엔진

> Content Script가 호출하는 유틸리티

**폼 요소를 찾는 순서:**

1. **비밀번호 필드**: `input[type="password"]` 검색
2. **아이디 필드**: email, text, autocomplete="username" 등 다양한 셀렉터로 검색
3. **로그인 버튼**: 5단계 전략으로 검색
   - form 안의 submit 버튼
   - type="submit" 버튼
   - "로그인", "Log in", "확인", "다음" 텍스트를 가진 버튼
   - password 필드 근처의 버튼
   - username 필드 근처의 버튼

### 4. `utils/storage.ts` — 데이터 관리

> chrome.storage.local에 데이터를 저장/조회

**저장 구조:**
```
chrome.storage.local = {
  registeredApps: [
    {
      appId: "app-123",
      appName: "네이버",
      loginSteps: [
        {
          stepOrder: 1,
          urls: ["www.naver.com"],         ← 등록된 URL
          formFields: [                     ← 감지된 메타데이터
            { role: "username", selector: "#id", ... },
            { role: "password", selector: "#pw", ... },
            { role: "submit", selector: "#log\\.login", ... }
          ],
          detectedAt: "2026-04-05T..."
        }
      ]
    }
  ]
}
```

**URL 매칭 로직:**
- `www.naver.com`처럼 프로토콜 없이 입력해도 `https://www.naver.com/`과 매칭
- 호스트네임 비교 + startsWith 비교 조합

### 5. `entrypoints/popup/` — 팝업 UI

> 확장프로그램 아이콘 클릭 시 뜨는 작은 창

- 현재 탭 URL이 등록된 앱인지 표시
- 감지된 폼 필드 요약 표시
- "설정 페이지 열기" 버튼

### 6. `entrypoints/options/` — 설정 페이지

> 확장프로그램의 메인 관리 화면 (별도 탭으로 열림)

- SaaS 앱 추가/삭제
- 로그인 단계(Step) 관리 — 분리 로그인(Google 등) 대응
- 각 단계별 URL 등록
- 감지된 폼 메타데이터 조회/초기화

---

## 메시지 통신 흐름

Content Script와 Background는 직접 함수를 호출할 수 없다. **메시지**로 통신한다.

```
Content Script                    Background
     │                                │
     │── { type: 'CHECK_URL',  ─────→│  "이 URL 등록된 거야?"
     │     url: '...' }               │
     │                                │
     │←── { matched: true,    ───────│  "응, 네이버야"
     │      app: {...} }              │
     │                                │
     │── { type: 'FORM_DETECTED', ──→│  "폼 3개 찾았어"
     │     fields: [...] }            │
     │                                │── storage에 저장
     │                                │
```

이 패턴을 이해하면 확장프로그램 개발의 80%를 이해한 것이다.

---

## 빌드와 설치

### 개발 모드 (핫 리로드)
```bash
npm run dev
```
→ 코드 수정하면 자동으로 확장프로그램이 리로드됨

### 프로덕션 빌드
```bash
npm run build
```
→ `.output/chrome-mv3/` 폴더에 빌드 결과물 생성

### Chrome에 설치
1. `chrome://extensions` 접속
2. 우측 상단 "개발자 모드" ON
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `.output/chrome-mv3` 폴더 선택

### 코드 수정 후 반영
- `npm run dev` 중이면 자동 반영
- `npm run build`로 빌드한 경우: `chrome://extensions`에서 새로고침 버튼 클릭

---

## WXT가 해주는 것

WXT 없이 확장프로그램을 만들면:
- `manifest.json`을 직접 작성해야 함
- 파일 변경 시 수동으로 리로드해야 함
- 멀티 브라우저 빌드를 각각 해야 함

WXT가 해주는 것:
- `wxt.config.ts`에서 설정하면 `manifest.json` **자동 생성**
- `entrypoints/` 폴더 구조만 맞추면 **자동으로 content script, background 등록**
- `npm run dev`로 **핫 리로드** 지원
- Chrome, Edge, Safari, Firefox 빌드를 **한 번에** 처리

### WXT의 규칙

| 파일/폴더명 | WXT가 인식하는 역할 |
| --- | --- |
| `entrypoints/background.ts` | Service Worker로 등록 |
| `entrypoints/content.ts` | Content Script로 등록 |
| `entrypoints/popup/` | 팝업 UI로 등록 |
| `entrypoints/options/` | 설정 페이지로 등록 |
| `public/` | 정적 파일 복사 |

파일 이름이 곧 설정이다. `manifest.json`을 직접 건드릴 일이 거의 없다.

---

## 자주 쓰는 Chrome Extension API

| API | 용도 | 사용 가능 영역 |
| --- | --- | --- |
| `chrome.tabs.onUpdated` | 탭 URL 변경 감지 | Background |
| `chrome.tabs.sendMessage` | Background → Content Script 메시지 | Background |
| `chrome.runtime.sendMessage` | Content Script → Background 메시지 | Content Script, Popup, Options |
| `chrome.runtime.onMessage` | 메시지 수신 리스너 | 모든 영역 |
| `chrome.storage.local` | 데이터 저장/조회 | 모든 영역 |
| `chrome.action.setBadgeText` | 아이콘에 뱃지 표시 | Background |
| `chrome.notifications.create` | 시스템 알림 표시 | Background |
| `chrome.runtime.openOptionsPage` | 설정 페이지 열기 | Popup |

---

## 개발 시 디버깅 방법

### Background (Service Worker) 디버깅
1. `chrome://extensions` 접속
2. 확장프로그램 카드에서 "서비스 워커" 링크 클릭
3. DevTools가 열림 → Console 탭에서 로그 확인

### Content Script 디버깅
1. 웹페이지에서 F12 (개발자도구)
2. Console 탭에서 `[PM Content]`로 시작하는 로그 확인
3. Sources 탭 → Content scripts에서 브레이크포인트 설정 가능

### Popup / Options 디버깅
1. 팝업: 팝업 위에서 우클릭 → "검사"
2. 설정 페이지: 일반 웹페이지처럼 F12
