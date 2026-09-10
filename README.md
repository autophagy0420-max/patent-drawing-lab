# Patent Drawing Lab v0.1

고등학교 지식재산교육용 특허도면 작성 지원 웹앱 프로토타입입니다.

## 핵심 원칙
- AI가 학생의 발명을 새로 설계하지 않음
- 원본 스케치 구조를 우선 보존
- 구조 분석 → 학생 확인/수정 → 선화 생성
- 참조부호는 AI 이미지에 굽지 않고 편집 가능한 웹 레이어로 배치
- 교육용 초안임을 명시

## 실행
```bash
npm install
npm run dev
```

## 배포
Vercel에서 이 폴더를 GitHub 저장소로 올린 뒤 Import Project 하면 됩니다.
Build command: `npm run build`
Output directory: `dist`

## API Key
앱 우측 상단 `API 설정`에서 사용자가 본인의 Gemini API Key를 입력합니다.
기본은 sessionStorage이며, 사용자가 명시적으로 선택할 때만 localStorage에 저장합니다.

주의: Google의 공식 SDK 문서는 프로덕션에서 클라이언트에 API Key를 노출하지 말고 서버 측 사용을 권고합니다.
이 프로토타입은 사용자가 자기 키를 직접 입력하는 BYOK 교육용 구조입니다. 학교 공용 PC에서는 '이 기기에서 기억하기'를 사용하지 마세요.

## 모델
- 구조 분석: gemini-2.5-flash
- 이미지 변환: gemini-3.1-flash-image

모델명은 향후 API 변경에 따라 수정할 수 있습니다.
