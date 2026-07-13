# 기술 스택

이 프로젝트는 다음 기술 스택을 사용합니다:
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

# 개발 워크플로우

1. 사용자 요구사항에 맞춰 `src/index.css`와 `tailwind.config.ts`의 테마 스타일을 조정합니다.
2. 사용자 요구사항에 따라 구현해야 할 페이지를 파악합니다.
3. 각 페이지에 필요한 기능을 정리하고, `pages` 폴더 아래에 해당 페이지용 폴더와 진입점 파일인 `Index.tsx`를 생성합니다.
4. `App.tsx`에서 라우팅을 설정하고, 이전 단계에서 생성한 `Index.tsx` 파일들을 import합니다.
5. 페이지 로직을 구현합니다. 요구사항이 간단한 경우 `Index.tsx` 내에서 페이지 전체를 직접 구현할 수 있습니다.
6. 요구사항이 복잡한 경우 페이지를 여러 컴포넌트로 분리합니다. 디렉토리 구조는 다음과 같아야 합니다:
    - `Index.tsx` (진입점)
    - `/components/` (컴포넌트)
    - `/hooks/` (훅)
    - `/stores/` (복잡한 컴포넌트 간 통신이 필요한 경우 상태 관리를 위해 `zustand` 사용)
7. 구현 후 `pnpm i`를 실행하여 의존성을 설치하고, `npm run lint` 및 `npx tsc --noEmit -p tsconfig.app.json --strict`를 실행하여 문제를 확인하고 수정합니다.

# 백엔드 연동
- 새로운 API 엔드포인트를 추가하거나 Supabase와 연동할 때, `src/api`에 해당 API 파일을 생성하고 관련 데이터 타입을 export합니다(예시는 `src/demo.ts` 참조; Supabase 연동 시 올바르게 구현되도록 주의).
- 프론트엔드와 Supabase를 연동할 때는 정의된 데이터 타입을 엄격히 준수합니다. 기존 타입을 수정하는 것은 가급적 피해야 하며, 수정이 필요한 경우 해당 타입을 참조하는 모든 파일을 확인해야 합니다.
