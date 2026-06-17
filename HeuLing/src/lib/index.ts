// ============================================================
// HeuLing — Routes, Types, Constants
// ============================================================

// ── 라우트 상수 ──────────────────────────────────────────────
export const ROUTE_PATHS = {
  HOME:       '/',
  LOGIN:      '/login',
  HOSPITALS:  '/hospitals',
  HOSPITAL_DETAIL: '/hospitals/:id',
  CS_FORM:    '/cs/new',
  DEMO_FORM:  '/demo/new',
  UPDATE_FORM:'/update',
  WITHDRAW:   '/withdraw',
  MY_ISSUES:  '/my-issues',
  RECEIPTS:   '/my-issues/receipts',
  RELEASES:        '/releases',
  NOTICES:         '/notices',
  SERVICE_REPORT:    '/service-report',
  INSTALL_REQUEST:   '/install-request',
  QUALIFICATION:     '/qualification',
} as const;

// ── GAS API ──────────────────────────────────────────────────
// 배포 후 실제 GAS Web App URL로 교체하세요
export const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbxAQ7GpuxxKagrQHcq8AGiDYKO8aOGwHRztlc8-J8c9jsSWtfxUg6csVD6sYLcEiJfQ1w/exec';

// ── 요청유형 ──────────────────────────────────────────────────
export const REQUEST_TYPES = [
  '장애',
  '트러블슈팅',
  '라이선스업데이트',
  '제품업데이트',
  '문의',
  '기타',
] as const;

export type RequestType = typeof REQUEST_TYPES[number];

// ── 제품 상태 ──────────────────────────────────────────────────
export type ProductStatus = '데모' | '정상' | '회수' | '만료예정' | '만료';

// ── 업데이트 유형 ──────────────────────────────────────────────
export const UPDATE_TYPES = ['라이선스 업데이트', '제품 업데이트'] as const;
export type UpdateType = typeof UPDATE_TYPES[number];

// ── 사진 카테고리 ──────────────────────────────────────────────
export const PHOTO_CATEGORIES = {
  CS_BEFORE:    '접수전',
  CS_DURING:    '처리중',
  CS_AFTER:     '처리완료',
  DEMO_INSTALL: '설치위치',
  DEMO_SETTING: '셋팅값',
  DEMO_IP:      'IP',
  DEMO_ETC:     '기타',
  WITHDRAW:     '철수',
} as const;

// ── 직원 목록 ──────────────────────────────────────────────────
export const HEURON_DOMAIN = '@iheuron.com';

// ── 타입 정의 ──────────────────────────────────────────────────
export interface Product {
  병원명: string;
  제품명: string;
  버전?: string;
  IP?: string;
  만료일?: string;
  상태?: ProductStatus;
  설치일?: string;
  설치담당자?: string;
  [key: string]: unknown;
}

export interface Hospital {
  hospitalName: string;
  products: Product[];
}

export interface HospitalDetail {
  hospitalName: string;
  products: Product[];
  contacts: Contact[];
  csHistory: CSRecord[];
}

export interface Contact {
  병원명: string;
  이름: string;
  부서?: string;
  연락처: string;
  [key: string]: unknown;
}

export interface CSRecord {
  접수일시: string;
  병원명: string;
  제품명: string;
  요청유형: RequestType;
  접수내용?: string;
  확인사항?: string;
  처리및조치사항?: string;
  향후대응계획?: string;
  담당자?: string;
  사진URL?: string;
  이슈담당자?: string;
  이슈상태?: string;
  rowIndex?: number;
  [key: string]: unknown;
}

export interface CSFormData {
  hospitalName: string;
  productName?: string;
  requestType?: RequestType | string;
  description?: string;
  // v8: 20열 매핑 필드
  reqDate?: string;
  custInfo?: string;
  descriptionDetail?: string;
  codeType?: string;
  productVersion?: string;
  responseMethod?: string;
  csStatus?: string;
  actionSummary?: string;
  actionDetail?: string;
  remarks?: string;
  feedbackApplied?: string;
  handlerName?: string;
  // 레거시 호환 필드
  checkDetails?: string;
  actionTaken?: string;
  followUpPlan?: string;
  dueDate?: string;
  assigneeEmail?: string;
  newContact?: {
    name: string;
    department: string;
    phone: string;
  };
  photos?: { category: string; file: File }[];
}

export interface DemoFormData {
  hospitalName: string;       // C: 사이트이름
  region?: string;            // B: 행정구분
  installType?: string;       // D: 설치유형
  contractType?: string;      // E: 계약유형
  productType?: string;       // F: 제품유형
  productName: string;        // G: 제품명
  version: string;            // H: 버전
  licenseType?: string;       // I: 라이선스유형
  installDate: string;        // J: 최초설치날짜
  expiryDate?: string;        // K: 라이선스만료일
  handlerName?: string;       // L: 주담당자 (로그인 자동)
  ip?: string;                // M: IP주소
  linkMethod?: string;        // N: 연동방식
  deviceMaker?: string;       // O: 장비제조사
  linkDetail?: string;        // P: 상세연동내역
  userInfo?: string;          // Q: 사용자/담당자정보
  location?: string;          // R: 설치장소
  pacsVendor?: string;        // S: PACS업체정보
  remoteAvailable?: string;   // T: 원격가능
  mgmtCode?: string;          // U: 관리코드
  installCert?: string;       // V: 설치확인서 (PDF URL 등)
  memo?: string;              // W: 비고
  remoteNumber?: string;      // Z: 원격번호
  photos?: { category: string; file: File | Blob; name: string }[];         // AA: 설치확인서 첨부
  installPhotos?: { category: string; file: File | Blob; name: string }[];  // AB: 설치및셋팅사진
}

export interface UpdateFormData {
  updateType: UpdateType;
  hospitalName: string;
  productName: string;
  details: string;
  newVersion?: string;
  newExpiry?: string;
}

export interface WithdrawFormData {
  hospitalName: string;
  productName: string;
  reason: string;
  withdrawDate: string;
  photos?: { category: string; file: File }[];
}

export interface StaffMember {
  name: string;
  email: string;
}

export interface GASResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error?: string | null;
}

export interface OfflineQueueItem {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

// ── 상태별 스타일 ──────────────────────────────────────────────
export function getStatusStyle(status?: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case '정상':       return { bg: 'bg-green-500/15', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' };
    case '데모':       return { bg: 'bg-primary/15',   text: 'text-primary',                       dot: 'bg-primary' };
    case '만료예정':   return { bg: 'bg-yellow-500/15',text: 'text-yellow-600 dark:text-yellow-400',dot: 'bg-yellow-500' };
    case '만료':       return { bg: 'bg-destructive/15',text: 'text-destructive',                  dot: 'bg-destructive' };
    case '회수':       return { bg: 'bg-muted',        text: 'text-muted-foreground',              dot: 'bg-muted-foreground' };
    default:           return { bg: 'bg-muted',        text: 'text-muted-foreground',              dot: 'bg-muted-foreground' };
  }
}

export function getRequestTypeStyle(type?: string): { bg: string; text: string } {
  switch (type) {
    case '장애':           return { bg: 'bg-destructive/15', text: 'text-destructive' };
    case '트러블슈팅':     return { bg: 'bg-yellow-500/15',  text: 'text-yellow-600 dark:text-yellow-400' };
    case '라이선스업데이트': return { bg: 'bg-primary/15',   text: 'text-primary' };
    case '제품업데이트':   return { bg: 'bg-accent/20',      text: 'text-accent-foreground' };
    case '문의':           return { bg: 'bg-secondary',      text: 'text-secondary-foreground' };
    default:               return { bg: 'bg-muted',          text: 'text-muted-foreground' };
  }
}
