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

확장프로그램은 **서로 다른 환경에서 실행되는 3개의 코드**로 구성됨

```
┌─────────────────────────────────────────────────────────┐
│                    브라우저                                │
│                                                          │
│   ┌─────────────────┐                                    │
│   │  Background      │  항상 실행 (브라우저가 켜져있는 동안)     │
│   │  (Service Worker) │  → API 통신, URL 감시, 데이터 관리    │
│   └────────┬─────────┘                                   │
│            │ chrome.runtime.sendMessage()                │
│            │ (서로 메시지를 주고받음)                         │
│   ┌────────┴─────────┐                                   │
│   │  Content Script   │  웹페이지마다 실행                   │
│   │                   │  → DOM 접근, 폼 탐지, 값 입력        │
│   └──────────────────┘                                   │
│                                                          │
│   ┌──────────────────┐   ┌──────────────────┐            │
│   │  Popup            │   │  Options          │          │
│   │  (아이콘 클릭)      │   │  (설정 페이지)     │            │
│   └──────────────────┘   └──────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### 왜 분리되어 있음?

- **Content Script**는 웹페이지의 DOM에 접근할 수 있지만 확장프로그램 API를 직접 쓸 수 없음
- **Background**는 확장프로그램 API를 쓸 수 있지만 웹페이지 DOM에 접근할 수 없음
- 그래서 둘이 **메시지**로 통신



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

파일 이름이 곧 설정 `manifest.json`을 직접 건드릴 일이 거의 없음

---

## Chrome에서 확장 프로그램 테스트하기

개발 빌드를 Chrome에 직접 로드하여 테스트할 수 있음

### 1. 빌드

```bash
# 개발 모드 (핫 리로드 지원함)
npm run dev

# 또는 프로덕션 빌드
npm run build
```

실행하면 `.output/chrome-mv3/` 디렉토리에 빌드 결과물이 생성됨

### 2. Chrome에 로드

1. Chrome 주소창에 `chrome://extensions` 입력 후 접속
2. 우측 상단의 **개발자 모드** 토글을 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 버튼 클릭
4. 프로젝트의 `.output/chrome-mv3/` 폴더를 선택

### 3. 테스트

- 로드 후 확장 프로그램 목록에 AlphaKey가 표시됨
- `npm run dev`로 실행 중이면 코드 변경 시 자동으로 리로드도 됨
- 수동으로 리로드하려면 확장 프로그램 카드의 새로고침(🔄) 버튼을 클릭

### 4. 옵션 페이지 접속

- 확장 프로그램 카드의 **세부정보** → **확장 프로그램 옵션** 클릭
- 또는 주소창에 `chrome-extension://<확장프로그램ID>/options.html` 입력
