// ============================================================
// HeuLing — GAS API Client v4
// ============================================================
import { GAS_API_URL, GASResponse, CSFormData, DemoFormData, UpdateFormData, WithdrawFormData } from '@/lib/index';

function getUserEmail(): string {
  return localStorage.getItem('heuling_user_email') || '';
}

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<GASResponse<T>> {
  const email = getUserEmail();
  const searchParams = new URLSearchParams({ action, email, ...params });
  const url = `${GAS_API_URL}?${searchParams.toString()}`;
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<GASResponse<T>>;
}

async function gasPost<T>(payload: Record<string, unknown>): Promise<GASResponse<T>> {
  const email = getUserEmail();
  const resp = await fetch(GAS_API_URL, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify({ ...payload, email }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<GASResponse<T>>;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 릴리즈 노트 타입 ────────────────────────────────────────
export interface ReleaseItem {
  product: string;
  version: string;
  date: string;
  pageUrl: string;
  category: 'Web' | 'Engine' | 'OnPremise' | 'Infra' | 'Other';
}

// ── 병원 제품 타입 (확장) ────────────────────────────────────
export interface HospitalProduct {
  제품명: string;
  버전?: string;
  라이선스?: string;
  만료일?: string;
  상태?: string;
  설치일?: string;
  설치유형?: string;
  제품유형?: string;   // On-premise / Cloud
  필터분류?: string;   // 정상/과제/데모/기타
  IP?: string;
  원격?: string;
  원격번호?: string;
  담당자?: string;
  고객담당자?: string;
  연락처?: string;
  설치장소?: string;
  지역?: string;
  관리코드?: string;
  최신버전?: string;    // Confluence 릴리즈 캐시에서 조회
  최신버전URL?: string; // Confluence 페이지 링크
  [key: string]: unknown;
}

export interface HospitalListItem {
  hospitalName: string;
  region: string;
  manager?: string;
  isOverseas?: boolean;
  products: HospitalProduct[];
}

// ============================================================
export const api = {
  // ── [1] 병원 조회 ──────────────────────────────────────────
  getHospitalList: (region: 'domestic' | 'overseas' = 'domestic') =>
    gasGet<HospitalListItem[]>('getHospitalList', { region }),

  getHospitalDetail: (hospitalName: string, region: 'domestic' | 'overseas' = 'domestic') =>
    gasGet('getHospitalDetail', { hospitalName, region }),

  searchHospital: (keyword: string, region: 'domestic' | 'overseas' = 'domestic') =>
    gasGet<{ hospitalName: string; region: string }[]>('searchHospital', { keyword, region }),

  // ── [2] CS 등록 ────────────────────────────────────────────
  getProductList: (hospitalName: string, region: 'domestic' | 'overseas' = 'domestic') =>
    gasGet<string[]>('getProductList', { hospitalName, region }),

  submitCS: async (formData: CSFormData) => {
    const photoUrls: string[] = [];
    if (formData.photos && formData.photos.length > 0) {
      for (const photo of formData.photos) {
        const base64 = await fileToBase64(photo.file);
        const uploadRes = await gasPost<{ fileUrl: string }>({
          action: 'uploadPhoto',
          base64,
          fileName: photo.file.name,
          mimeType: photo.file.type,
          category: `CS_${photo.category.toUpperCase()}`,
        });
        if (uploadRes.success && uploadRes.data) {
          photoUrls.push(uploadRes.data.fileUrl);
        }
      }
    }
    return gasPost({ action: 'submitCS', ...formData, photoUrls });
  },

  createIssue: (payload: {
    hospitalName: string;
    productName: string;
    followUpPlan: string;
    dueDate: string;
    assigneeEmail: string;
  }) => gasPost({ action: 'createIssue', ...payload }),

  addContact: (payload: {
    hospitalName: string;
    name: string;
    department: string;
    phone: string;
  }) => gasPost({ action: 'addContact', ...payload }),

  // ── [3] 신규 데모 등록 ─────────────────────────────────────
  registerDemo: async (formData: DemoFormData) => {
    // AA열: 설치확인서 첨부 업로드
    const photoUrls: string[] = [];
    if (formData.photos && formData.photos.length > 0) {
      for (const photo of formData.photos) {
        const base64 = await fileToBase64(photo.file as File);
        const uploadRes = await gasPost<{ fileUrl: string }>({
          action: 'uploadPhoto',
          base64,
          fileName: photo.name,
          mimeType: (photo.file as File).type,
          category: `DEMO_CERT`,
        });
        if (uploadRes.success && uploadRes.data) {
          photoUrls.push(uploadRes.data.fileUrl);
        }
      }
    }
    // AB열: 설치및셋팅사진 업로드
    const installPhotoUrls: string[] = [];
    if (formData.installPhotos && formData.installPhotos.length > 0) {
      for (const photo of formData.installPhotos) {
        const base64 = await fileToBase64(photo.file as File);
        const uploadRes = await gasPost<{ fileUrl: string }>({
          action: 'uploadPhoto',
          base64,
          fileName: photo.name,
          mimeType: (photo.file as File).type,
          category: `DEMO_${photo.category.toUpperCase()}`,
        });
        if (uploadRes.success && uploadRes.data) {
          installPhotoUrls.push(uploadRes.data.fileUrl);
        }
      }
    }
    const { photos: _p, installPhotos: _ip, ...rest } = formData;
    return gasPost({ action: 'registerDemo', ...rest, photoUrls, installPhotoUrls });
  },

  generateDocument: (type: string, hospitalName: string, productName: string) =>
    gasGet('generateDocument', { type, hospitalName, productName }),

  // ── [4] 업데이트 ───────────────────────────────────────────
  updateLicense: (formData: UpdateFormData) =>
    gasPost({ action: 'updateLicense', ...formData }),

  updateProduct: (formData: UpdateFormData) =>
    gasPost({ action: 'updateProduct', ...formData }),

  updateLicenseWithPhotos: async (formData: UpdateFormData, photos: { category: string; file: File }[]) => {
    const photoUrls: string[] = [];
    for (const photo of photos) {
      const base64 = await fileToBase64(photo.file);
      const uploadRes = await gasPost<{ fileUrl: string }>({
        action: 'uploadPhoto', base64,
        fileName: photo.file.name,
        mimeType: photo.file.type,
        category: `UPDATE_${photo.category.toUpperCase()}`,
      });
      if (uploadRes.success && uploadRes.data) photoUrls.push(uploadRes.data.fileUrl);
    }
    return gasPost({ action: 'updateLicense', ...formData, photoUrls });
  },

  updateProductWithPhotos: async (formData: UpdateFormData, photos: { category: string; file: File }[]) => {
    const photoUrls: string[] = [];
    for (const photo of photos) {
      const base64 = await fileToBase64(photo.file);
      const uploadRes = await gasPost<{ fileUrl: string }>({
        action: 'uploadPhoto', base64,
        fileName: photo.file.name,
        mimeType: photo.file.type,
        category: `UPDATE_${photo.category.toUpperCase()}`,
      });
      if (uploadRes.success && uploadRes.data) photoUrls.push(uploadRes.data.fileUrl);
    }
    return gasPost({ action: 'updateProduct', ...formData, photoUrls });
  },

  // ── [5] 철수 ───────────────────────────────────────────────
  getDemoList: () =>
    gasGet<Record<string, unknown>[]>('getDemoList'),

  getDomesticList: (filter: 'demo' | 'commercial' | 'all', period: '1month' | 'all') =>
    gasGet<Record<string, unknown>[]>('getDomesticList', { filter, period }),

  updateDomesticRow: (payload: Record<string, unknown>) =>
    gasPost({ action: 'updateDomesticRow', ...payload }),

  deleteDomesticRow: (rowIndex: number) =>
    gasPost({ action: 'deleteDomesticRow', rowIndex }),

  withdrawDemo: async (formData: WithdrawFormData) => {
    const photoUrls: string[] = [];
    if (formData.photos && formData.photos.length > 0) {
      for (const photo of formData.photos) {
        const base64 = await fileToBase64(photo.file);
        const uploadRes = await gasPost<{ fileUrl: string }>({
          action: 'uploadPhoto', base64,
          fileName: photo.file.name,
          mimeType: photo.file.type,
          category: 'WITHDRAW',
        });
        if (uploadRes.success && uploadRes.data) photoUrls.push(uploadRes.data.fileUrl);
      }
    }
    return gasPost({ action: 'withdrawDemo', ...formData, photoUrls });
  },

  // ── [6] 내 할일 ────────────────────────────────────────────
  getMyIssues: () =>
    gasGet('getMyIssues', { email: getUserEmail() }),

  completeIssue: (rowIndex: number) =>
    gasPost({ action: 'completeIssue', rowIndex }),

  delegateIssue: (rowIndex: number, newAssigneeEmail: string, followUpPlan: string) =>
    gasPost({ action: 'delegateIssue', rowIndex, newAssigneeEmail, followUpPlan }),

  getStaffList: () =>
    gasGet<{ name: string; email: string }[]>('getStaffList'),

  // ── [매뉴얼] ──────────────────────────────────────────────
  getQuickGuides: () =>
    gasGet<{ folder: string; files: { name: string; url: string; mimeType: string }[] }[]>('getQuickGuides'),

  getUpdateManuals: () =>
    gasGet<{ name: string; url: string; mimeType: string }[]>('getUpdateManuals'),

  // ── [v9] 공지사항 & 엔지니어 공유 ────────────────────────────
  getNotices: (type: 'notice' | 'engineer' | 'all' = 'all') =>
    gasGet<{
      no: string; 항목: string; type: 'notice' | 'engineer';
      날짜: string; 최상단노출: boolean; 병원명: string;
      작성자: string; 구분: string; 내용: string; 상세내용: string;
    }[]>('getNotices', { type }),

  // ── [Confluence] 릴리즈 노트 ────────────────────────────────
  getReleaseNotes: () =>
    gasGet<ReleaseItem[]>('getReleaseNotes'),

  // ── [v6] 직원 등록/조회 ────────────────────────────────────
  getOrRegisterStaff: (email: string, name: string) =>
    gasGet<{ name: string; email: string; role: '관리자' | '일반'; dept: string; isNew: boolean }>('getOrRegisterStaff', { email, name }),

  // ── [v6] 내가 한 일 ───────────────────────────────────────
  getMyHistory: () =>
    gasGet<{
      cs: {
        type: 'cs'; rowIndex: number;
        병원명: string; 접수일: string; 처리완료일?: string; 요청유형: string;
        접수내용: string; 처리사항: string; CS상태: string; csStatus?: string; 제품명: string; 담당자: string;
        버전?: string; 처리내용서술형?: string; 비고?: string; 코드분류?: string; 대응방식?: string;
      }[];
      demo: {
        type: 'demo'; rowIndex: number;
        병원명: string; 제품명: string; 버전: string;
        설치일: string; 만료일: string; 상태: string; 설치장소: string; 담당자: string;
      }[];
    }>('getMyHistory'),

  // ── [v7] CS 이력 조회 (상태 필터) ───────────────────────
  getCSHistory: (csStatus?: string) =>
    gasGet<{
      rowIndex: number; 병원명: string; 접수일: string; 처리완료일?: string;
      요청유형: string; 접수내용: string; 처리사항: string; CS상태: string;
      제품명: string; 담당자: string;
      버전?: string; 처리내용서술형?: string; 비고?: string; 코드분류?: string; 대응방식?: string;
    }[]>('getCSHistory', csStatus ? { csStatus } : {}),

  // ── [v6] 수정 횟수 조회 ────────────────────────────────────
  getEditCount: (sheetType: 'cs' | 'demo', rowIndex: number) =>
    gasGet<{ count: number }>('getEditCount', { sheetType, rowIndex: String(rowIndex) }),

  // ── [v6/v7] CS 수정 (무제한) ─────────────────────────────
  // ── [v7] CS 수정 (전체 필드 + 사진) ─────────────────────
  updateCSRecord: async (payload: {
    rowIndex: number; email: string;
    병원명?: string; 제품명?: string; 요청유형?: string;
    접수내용?: string; 처리사항?: string; 접수일?: string;
    csStatus?: string;
    처리내용서술형?: string;
    대응방식?: string; 코드분류?: string;
    newPhotos?: { category: string; file: File }[];
    remainingUrls?: string[];
  }) => {
    // 새 사진 Drive 업로드
    const newUrls: string[] = [];
    if (payload.newPhotos && payload.newPhotos.length > 0) {
      for (const photo of payload.newPhotos) {
        const base64 = await fileToBase64(photo.file);
        const res = await gasPost<{ fileUrl: string }>({
          action: 'uploadPhoto', base64,
          fileName: photo.file.name, mimeType: photo.file.type,
          category: `CS_${photo.category.toUpperCase()}`,
        });
        if (res.success && res.data) newUrls.push(res.data.fileUrl);
      }
    }
    const photoUrls = payload.remainingUrls !== undefined
      ? [...payload.remainingUrls, ...newUrls]
      : undefined;
    return gasPost<{ updated: boolean }>({
      action: 'updateCSRecord',
      rowIndex: payload.rowIndex,
      email: payload.email,
      병원명: payload.병원명,
      제품명: payload.제품명,
      요청유형: payload.요청유형,
      접수내용: payload.접수내용,
      처리사항: payload.처리사항,
      접수일: payload.접수일,
      csStatus: payload.csStatus,
      처리내용서술형: payload.처리내용서술형,
      대응방식: payload.대응방식,
      코드분류: payload.코드분류,
      ...(photoUrls !== undefined ? { photoUrls } : {}),
    });
  },

  // ── [v7] CS 상태 변경 ─────────────────────────────────────
  updateCSStatus: (rowIndex: number, csStatus: string) =>
    gasPost<{ updated: boolean; csStatus: string }>({ action: 'updateCSStatus', rowIndex, csStatus }),

  // ── [v7] CS 삭제 ──────────────────────────────────────────
  deleteCSRecord: (rowIndex: number) =>
    gasPost<{ deleted: boolean }>({ action: 'deleteCSRecord', rowIndex }),

  // ── [v6] 데모 수정 ────────────────────────────────────────
  updateDemoRecord: (payload: {
    rowIndex: number;
    병원명?: string; 제품명?: string; 버전?: string;
    설치장소?: string; 만료일?: string; IP?: string; 원격?: string;
  }) => gasPost<{ updated: boolean; editCount: number; remaining: number }>({ action: 'updateDemoRecord', ...payload }),

  // ── [영수증] ──────────────────────────────────────────────
  uploadReceipt: async (
    date: string, amount: string, memo: string, file: File,
    payMethod: string,   // F열: 결제수단
    subCat1: string,     // G열: 하위분류
    subCat2: string,     // H열: 세부분류
    detailMemo: string,  // I열: 세부메모
  ) => {
    const base64 = await fileToBase64(file);
    return gasPost<{ fileId: string; fileUrl: string }>({
      action: 'uploadReceipt',
      date, amount, memo,
      payMethod, subCat1, subCat2, detailMemo,
      fileName: file.name,
      mimeType: file.type,
      fileBase64: base64,
    });
  },

  getReceipts: (yearMonth?: string) =>
    gasGet<{
      date: string; amount: string; memo: string; category: string;
      fileId: string; fileUrl: string; fileName: string; rowIndex: number;
    }[]>('getReceipts', yearMonth ? { yearMonth } : {}),

  generateReceiptPDF: (yearMonth: string) =>
    gasPost<{ pdfUrl: string; fileName: string }>({
      action: 'generateReceiptPDF', yearMonth,
    }),

  deleteReceipt: (rowIndex: number) =>
    gasPost<void>({ action: 'deleteReceipt', rowIndex }),

  // ── 설치 및 운영 적격성 확인서 ───────────────────────────
  createQualificationReport: (payload: Record<string, unknown>) =>
    gasPost<{ rowIndex: number }>({ ...payload, action: 'createQualificationReport' }),

  generateQualificationPDF: (payload: Record<string, unknown>) =>
    gasPost<{ pdfUrl: string }>({ ...payload, action: 'generateQualificationPDF' }),

  // ── 설치환경 정보요청서: 영업/TE 역할 분리 ───────────────
  /** 영업 담당자: A+B+C 저장 → 상태=영업완료 */
  saveInstallDraft: (payload: Record<string, unknown>) =>
    gasPost<{ rowIndex: number; status: string }>({ ...payload, action: 'saveInstallDraft' }),

  /** TE: 영업완료 목록 조회 */
  getInstallDrafts: () =>
    gasGet<Array<{
      rowIndex: number; no: number; 병원명: string; 작성일: string;
      영업담당자: string; 제품명: string; 버전: string; 설치유형: string;
      서버위치: string; IT담당자: string; PACS담당자: string; 설치일정: string;
    }>>('getInstallDrafts'),

  /** TE: D+E 이어서 저장 */
  continueInstallRequest: (payload: Record<string, unknown>) =>
    gasPost<{ rowIndex: number; status: string }>({ ...payload, action: 'continueInstallRequest' }),
};
