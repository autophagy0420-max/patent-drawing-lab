# Patent Drawing Lab v0.3 — AI 도면부호 초안

v0.1의 UI/교육 흐름은 유지하고, Gemini API 호출을 브라우저에서 Vercel Serverless API로 옮긴 버전입니다.

## 변경점
- 학생 API Key 입력 UI 제거
- sessionStorage/localStorage API Key 저장 제거
- 브라우저의 `GoogleGenAI` 직접 호출 제거
- `/api/analyze` : 스케치 구조 분석
- `/api/generate-image` : 특허도면 이미지 생성
- `/api/describe` : 도면의 간단한 설명/부호 설명
- 서버에서만 `process.env.GEMINI_API_KEY` 사용
- 이미지 생성 중 버튼 비활성화로 중복 호출 방지

## Vercel 환경변수
Vercel → Project Settings → Environment Variables:

`GEMINI_API_KEY = 실제 Gemini API Key`

Production에 적용하고 Redeploy 하세요.

## 배포
GitHub 저장소의 기존 파일을 이 버전으로 교체/커밋하면 Vercel이 자동 재배포합니다.

## 로컬 실행 주의
`vite dev`만 실행하면 Vercel `/api/*` 함수가 동작하지 않습니다.
로컬에서 서버리스 함수까지 시험하려면 Vercel CLI의 `vercel dev`를 사용하거나 Vercel Preview/Production에서 테스트하세요.

## 모델
- 분석/설명: `gemini-2.5-flash`
- 이미지: `gemini-3.1-flash-image`

이미지 모델/API 형식은 2026-09-10 Google 공식 Gemini 문서의 `models.generateContent` 이미지 입력/출력 예시에 맞췄습니다.

## 보안
API Key는 클라이언트 번들에 포함되지 않습니다. `VITE_GEMINI_API_KEY`, `NEXT_PUBLIC_*` 등을 사용하지 마세요.


## v0.3 추가 기능
- 구조 분석 시 AI가 `추천 도면부호`, `부호 사용 권장 여부`, `판단 근거`를 함께 제안
- STEP 3을 `구성 확인 및 도면부호 초안`으로 개편
- 학생이 추천 부호/구성요소명을 직접 수정 가능
- 불필요한 구성요소 제외/삭제 및 새 구성요소 추가 가능
- 중복 도면부호 검증
- 이미지 생성 프롬프트에서 문자·숫자·한글·도면부호 생성을 강하게 금지
- 최종 도면부호는 이미지 픽셀이 아니라 앱의 편집 가능한 오버레이에서 처리

권장 수업 흐름:
`AI 추천 → 학생 검토·수정 → 학생 확정 → 순수 특허 선화 생성 → 최종 부호 배치`
