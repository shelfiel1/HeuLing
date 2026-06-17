// ============================================================
// HeuLing — 설치 및 운영 적격성 확인서
// ============================================================
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { TopBar, PageWrapper } from '@/components/Layout';
import { api } from '@/api/gasClient';
import { ROUTE_PATHS } from '@/lib/index';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Plus, Trash2, X, CheckCircle2, ChevronDown, ClipboardList } from 'lucide-react';

// ── 타입 선택 ────────────────────────────────────────────────
const DEVICE_TYPES = ['Standalone', 'On-Premise win', 'On-premise Web', 'Cloud', '모바일'] as const;
const INSTALL_TYPES = ['신규설치', '업데이트 설치', '장애대응'] as const;
const PHOTO_CATS = ['네트워크설정', '설치위치', '기타특이사항'] as const;

// ── 설치 적격성 항목 (기본값: P 또는 N) ────────────────────
const INSTALL_CHECKS = [
  { key: 'serverPC',   label: '서버 PC 정상동작 확인',   desc: '서버 PC가 정상적으로 부팅이 되는지 확인',            default: 'P', options: ['P','F','N'] },
  { key: 'clientPC',   label: '클라이언트 PC 정상 동작 확인', desc: '클라이언트 PC가 정상적으로 부팅이 되는지 확인',  default: 'N', options: ['P','F','N'] },
  { key: 'monitor',    label: '모니터 정상 출력',         desc: '모니터가 정상적으로 화면을 출력하는지 확인',          default: 'P', options: ['P','F','N'] },
  { key: 'network',    label: '네트워크 정상 확인',       desc: '네트워크가 정상적으로 동작하는지 확인',               default: 'P', options: ['P','F','N'] },
  { key: 'internet',   label: '인터넷 가능 여부',         desc: '인터넷 연결이 가능한지 확인',                         default: 'N', options: ['P','F','N'] },
  { key: 'manual',     label: '사용자 매뉴얼 제공 확인',  desc: '고객에게 사용자 매뉴얼을 제공하였는가?',              default: 'P', options: ['P','F','N'] },
  { key: 'labeling',   label: '제품정보(라벨링) 확인',    desc: '제품명, 버전, 제조원, UDI 등 라벨 정보가 일치하는가?', default: 'P', options: ['P','F','N'] },
  { key: 'integrity',  label: '무결성 검증',              desc: '배포 전후 고유 해시키 값 변경이 일어났는가?',          default: 'P', options: ['P','F','N'] },
] as const;

// ── Cloud 타입 설치 적격성 기본값 (서버/클라이언트/모니터/네트워크/인터넷/매뉴얼 → N)
const CLOUD_INSTALL_DEFAULTS: Record<string, string> = {
  serverPC: 'N', clientPC: 'N', monitor: 'N', network: 'N',
  internet: 'N', manual: 'N', labeling: 'P', integrity: 'P',
};
const DEFAULT_INSTALL_DEFAULTS: Record<string, string> = Object.fromEntries(
  INSTALL_CHECKS.map(c => [c.key, c.default])
);

// ── 운영 적격성 항목 (기본값: 모두 P) ──────────────────────
const OPERATION_CHECKS = [
  { key: 'account',   label: '계정생성 여부',          desc: '계정이 정상적으로 생성됨',                             default: 'P', options: ['P','F','N'] },
  { key: 'launch',    label: '제품 실행 여부',          desc: '제품이 정상적으로 실행됨',                             default: 'P', options: ['P','F','N'] },
  { key: 'viewer',    label: '뷰어 표시 여부',          desc: '뷰어에서 영상이 정상적으로 표시됨',                    default: 'P', options: ['P','F','N'] },
  { key: 'analysisManual', label: '분석정상여부(수동)', desc: '수동 분석이 정상적으로 완료됨',                        default: 'P', options: ['P','F','N'] },
  { key: 'analysisAuto',   label: '분석정상여부(자동)', desc: 'PACS를 통한 자동 분석이 정상적으로 완료됨',            default: 'P', options: ['P','F','N'] },
  { key: 'pacsReport', label: 'PACS 리포트 전송 여부', desc: '리포트가 정상적으로 PACS로 전송됨',                   default: 'P', options: ['P','F','N'] },
] as const;

// ── 보안환경 항목 (기본값: 모두 P, PF만) ───────────────────
const SECURITY_CHECKS = [
  { key: 'access',    label: '서버실/운영실 출입통제 여부', desc: '현장 확인 및 담당자 인터뷰 (출입 권한자만 접근 가능하고 출입기록이 유지됨)',     default: 'P', options: ['P','F'] },
  { key: 'cctv',      label: 'CCTV, 출입기록 관리',       desc: 'CCTV 설치 여부 및 출입기록 확인 (30일 이상 출입기록 보관)',                        default: 'P', options: ['P','F'] },
  { key: 'lock',      label: '장비의 잠금 보호조치 여부',  desc: '육안 확인 및 담당자 인터뷰 (장비가 잠금장치 또는 물리적 보호함에 보관)',          default: 'P', options: ['P','F'] },
  { key: 'netSeg',    label: '네트워크 분리 구조 확인',    desc: '네트워크 구성 확인 및 담당자 인터뷰 (진료망·외부망 분리 또는 방화벽 통제)',       default: 'P', options: ['P','F'] },
] as const;

// ── 제품 모델 데이터 하드코딩 (UDI 제외 — 스크린샷 기준, 행 6,7,10,11,12,14,15,16,17) ──
const HEURON_PRODUCT_DATA: { name: string; model: string; type: string; version: string }[] = [
  { name: 'Heuron NI',              model: 'PD-NQC01', type: 'On-premise Web',   version: '1.0.1.x' },
  { name: 'Heuron NI',              model: 'PD-NQC02', type: 'Cloud',            version: '1.0.1.x' },
  { name: 'Heuron NI',              model: 'PD-NQC03', type: 'On-premise Win',   version: '1.0.1.x' },
  { name: 'Heuron AD',              model: 'AD-ADC01', type: 'On-premise Web',   version: '1.0.4.x' },
  { name: 'Heuron AD',              model: 'AD-P01',   type: 'On-premise Web',   version: '1.0.4.x' },
  { name: 'Heuron Brain PET',       model: 'AD-BPC03', type: 'On-premise Win',   version: '1.0.1.x' },
  { name: 'Heuron ELVO',            model: 'ST-ELX01', type: 'On-premise Web',   version: '1.0.0.x' },
  { name: 'Heuron ELVO',            model: 'ST-ELX02', type: 'Cloud',            version: '1.0.0.x' },
  { name: 'Heuron ELVO',            model: 'ST-ELX03', type: 'On-premise Win',   version: '1.0.0.x' },
  { name: 'Heuron StroCare Suite™', model: 'ST-STX01', type: 'On-premise Web',   version: '1.0.5.x' },
  { name: 'Heuron StroCare Suite™', model: 'ST-STX02', type: 'Cloud',            version: '1.0.5.x' },
  { name: 'Heuron StroCare Suite™', model: 'ST-STX04', type: 'On-premise/Cloud', version: '1.0.5.x' },
  { name: 'Heuron StroCare Suite™', model: 'ST-STT01', type: 'On-premise/Cloud', version: '1.0.5.x' },
  { name: 'Heuron StroCare Suite™', model: 'ST-STC01', type: 'On-premise/Cloud', version: '1.0.5.x' },
  { name: 'Heuron CTP',             model: 'ST-CPC01', type: 'On-premise Web',   version: '1.0.3.x' },
  { name: 'Heuron CTP',             model: 'ST-CPC02', type: 'Cloud',            version: '1.0.3.x' },
  { name: 'Heuron CTP',             model: 'ST-CPC04', type: 'On-premise/Cloud', version: '1.0.3.x' },
  { name: 'Heuron NM',              model: 'PD-NMC01', type: 'On-premise/Cloud', version: '1.0.0.x' },
  { name: 'Heuron CTA',             model: 'ST-CAX01', type: 'On-premise/Cloud', version: '1.0.1.x' },
  { name: 'Heuron PD',              model: 'PD-PNX01', type: 'On-premise/Cloud', version: '1.0.0.x' },
];
const HEURON_PRODUCT_NAMES = [...new Set(HEURON_PRODUCT_DATA.map(p => p.name))];

// ── PFN 버튼 컴포넌트 ────────────────────────────────────────
function PFNButtons({
  value, onChange, options
}: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  const COLOR: Record<string, string> = {
    P: 'bg-green-500 text-white border-green-500',
    F: 'bg-red-500 text-white border-red-500',
    N: 'bg-gray-400 text-white border-gray-400',
  };
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'w-10 h-8 rounded-lg text-xs font-bold border transition-all',
            value === opt ? COLOR[opt] : 'bg-muted text-muted-foreground border-border'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── 자동완성 드롭다운 ────────────────────────────────────────
function AutoCompleteInput({
  value, onChange, suggestions, placeholder
}: { value: string; onChange: (v: string) => void; suggestions: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value);
  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 h-11 border border-border focus-within:border-primary transition-colors">
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <button key={s} type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors"
              onMouseDown={() => { onChange(s); setOpen(false); }}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 섹션 종합판정 자동 계산 ────────────────────────────────
function computeVerdict(checks: Record<string, string>): 'Pass' | 'Fail' {
  return Object.values(checks).some(v => v === 'F') ? 'Fail' : 'Pass';
}

// ── 메인 페이지 ─────────────────────────────────────────────
export default function QualificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 기본 정보
  const [hospitalName, setHospitalName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Record<string, unknown> | null>(null);
  const [productList, setProductList] = useState<Record<string, unknown>[]>([]);
  const [productOpen, setProductOpen] = useState(false);

  // ── 하드코딩 제품 선택 ────────────────────────────────────
  const [hcProductName, setHcProductName] = useState('');
  const [hcModel, setHcModel] = useState<{ name: string; model: string; type: string; version: string } | null>(null);
  const hcModels = HEURON_PRODUCT_DATA.filter(p => p.name === hcProductName);

  // 수동 입력 필드
  const [udi, setUdi] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [deviceType, setDeviceType] = useState('On-premise Web');
  const [installType, setInstallType] = useState('신규설치');
  const [writeDate] = useState(() => new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g,'.').replace('.',''));

  // 설치 적격성 초기값
  const initInstall = Object.fromEntries(INSTALL_CHECKS.map(c => [c.key, c.default]));
  const [installChecks, setInstallChecks] = useState<Record<string, string>>(initInstall);

  // 운영 적격성 초기값
  const initOp = Object.fromEntries(OPERATION_CHECKS.map(c => [c.key, c.default]));
  const [opChecks, setOpChecks] = useState<Record<string, string>>(initOp);

  // 보안환경 초기값
  const initSec = Object.fromEntries(SECURITY_CHECKS.map(c => [c.key, c.default]));
  const [secChecks, setSecChecks] = useState<Record<string, string>>(initSec);

  // 특이사항
  const [issues, setIssues] = useState<{ problem: string; action: string }[]>([{ problem: '', action: '' }]);

  // 비고
  const [remarks, setRemarks] = useState('');

  // 사진
  const [photos, setPhotos] = useState<{ category: string; file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoCategory, setPhotoCategory] = useState<typeof PHOTO_CATS[number]>('네트워크설정');

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resultPdfUrl, setResultPdfUrl] = useState('');

  // ── 병원 목록 ─────────────────────────────────────────────
  const { data: hospitals = [] } = useQuery({
    queryKey: ['hospitals-simple'],
    queryFn: async () => {
      const res = await api.getHospitalList();
      return res.data?.map((h: { hospitalName: string }) => h.hospitalName) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── 병원 선택 시 제품정보 로드 ────────────────────────────
  const handleHospitalSelect = async (name: string) => {
    setHospitalName(name);
    setSelectedProduct(null);
    setProductList([]);
    if (!name) return;
    try {
      const res = await api.getHospitalDetail(name);
      const prods = res.data?.products || [];
      setProductList(prods);
      if (prods.length === 1) {
        setSelectedProduct(prods[0]);
      } else if (prods.length > 1) {
        setProductOpen(true);
      }
    } catch { /* silent */ }
  };

  // 제품 선택
  const handleProductSelect = (prod: Record<string, unknown>) => {
    setSelectedProduct(prod);
    setProductOpen(false);
  };

  // 파생값
  const prodName  = (selectedProduct?.['제품명'] as string) || '';
  const prodVer   = (selectedProduct?.['버전'] as string) || '';
  const prodIP    = (selectedProduct?.['IP'] as string) || '';
  const prodLoc   = (selectedProduct?.['설치장소'] as string) || '';
  const custId    = (selectedProduct?.['고객담당자'] as string) || '';
  const custPhone = (selectedProduct?.['연락처'] as string) || '';

  // ── 종합판정 ──────────────────────────────────────────────
  const installVerdict  = computeVerdict(installChecks);
  const opVerdict       = computeVerdict(opChecks);
  const secVerdict      = computeVerdict(secChecks);

  // ── 사진 처리 ─────────────────────────────────────────────
  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const preview = URL.createObjectURL(file);
      setPhotos(prev => [...prev, { category: photoCategory, file, preview }]);
    });
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_,i) => i !== idx); });
  };

  // ── 특이사항 행 ───────────────────────────────────────────
  const addIssueRow    = () => setIssues(prev => [...prev, { problem: '', action: '' }]);
  const removeIssueRow = (i: number) => setIssues(prev => prev.filter((_,j) => j !== i));
  const updateIssue    = (i: number, key: 'problem' | 'action', val: string) =>
    setIssues(prev => prev.map((r, j) => j === i ? { ...r, [key]: val } : r));

  // ── 저장 mutation ─────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      // 사진 base64 변환
      const photoPayloads = await Promise.all(photos.map(async p => {
        const reader = new FileReader();
        const b64: string = await new Promise((res, rej) => {
          reader.onload = () => res((reader.result as string).split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(p.file);
        });
        return { category: p.category, fileName: p.file.name, mimeType: p.file.type, base64: b64 };
      }));

      // 1. 이력 저장
      const payload = {
        action: 'createQualificationReport',
        hospitalName,
        productName: prodName,
        version: prodVer,
        udi, serialNo,
        ip: prodIP,
        deviceType,
        installType,
        location: prodLoc,
        custId, custPhone,
        writeDate,
        writerName: user?.name || '',
        writerEmail: user?.email || '',
        installChecks,
        opChecks,
        secChecks,
        installVerdict,
        opVerdict,
        secVerdict,
        issues,
        remarks,
        photos: photoPayloads,
      };
      const saveRes = await api.createQualificationReport(payload);
      if (!saveRes.success) throw new Error(saveRes.error || '저장 실패');
      const rowIndex = saveRes.data?.rowIndex;

      // 2. PDF 생성
      const pdfRes = await api.generateQualificationPDF({
        action: 'generateQualificationPDF',
        rowIndex,
        hospitalName, productName: prodName, version: prodVer,
        udi, serialNo, ip: prodIP, deviceType, installType,
        location: prodLoc, custId, custPhone, writeDate,
        writerName: user?.name || '',
        installChecks, opChecks, secChecks,
        installVerdict, opVerdict, secVerdict,
        issues, remarks,
      });
      if (!pdfRes.success) throw new Error(pdfRes.error || 'PDF 생성 실패');
      return pdfRes.data?.pdfUrl as string;
    },
    onSuccess: (pdfUrl) => {
      setResultPdfUrl(pdfUrl);
      setShowModal(false);
      setIsSuccess(true);
    },
    onError: (err: Error) => {
      setShowModal(false);
      alert(`저장 실패: ${err.message}`);
    },
  });

  // ── 성공 화면 ─────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-1">저장 완료!</p>
          <p className="text-sm text-muted-foreground">설치 및 운영 적격성 확인서가 저장되었습니다</p>
        </div>
        {resultPdfUrl && (
          <a href={resultPdfUrl} target="_blank" rel="noreferrer"
             className="w-full max-w-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-medium">
            📄 PDF 보기
          </a>
        )}
        <Button variant="outline" className="w-full max-w-sm" onClick={() => navigate(ROUTE_PATHS.SERVICE_REPORT)}>
          확인서 목록으로
        </Button>
      </div>
    );
  }

  // ── 메인 폼 ───────────────────────────────────────────────
  return (
    <>
      <TopBar title="설치 및 운영 적격성 확인서" showBack />
      <PageWrapper>
        <div className="px-4 py-4 space-y-5 max-w-lg mx-auto">

          {/* ─ 기본 정보 ─ */}
          <section className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              기본 정보
              <span className="text-xs text-muted-foreground font-normal ml-auto">제품현황에서 자동 불러오기</span>
            </h2>

            {/* 병원명 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">병원명 *</label>
              <AutoCompleteInput
                value={hospitalName}
                onChange={handleHospitalSelect}
                suggestions={hospitals}
                placeholder="병원명 검색..."
              />
            </div>

            {/* 제품명 선택 (하드코딩) */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">제품명 선택 *</label>
              <div className="flex flex-wrap gap-1.5">
                {HEURON_PRODUCT_NAMES.map(n => (
                  <button key={n} type="button"
                    onClick={() => { setHcProductName(n); setHcModel(null); }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition',
                      hcProductName === n
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    )}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* 모델 선택 (제품명 선택 후 표시) */}
            {hcProductName && hcModels.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">모델 선택</label>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="px-2 py-1.5 text-left text-blue-800 font-semibold border border-blue-100">모델명</th>
                        <th className="px-2 py-1.5 text-left text-blue-800 font-semibold border border-blue-100">유형</th>
                        <th className="px-2 py-1.5 text-left text-blue-800 font-semibold border border-blue-100">버전</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hcModels.map((m, i) => (
                        <tr key={i}
                          onClick={() => setHcModel(m)}
                          className={cn(
                            'cursor-pointer border-b border-gray-100 transition',
                            hcModel?.model === m.model
                              ? 'bg-blue-100 font-bold'
                              : 'hover:bg-gray-50'
                          )}>
                          <td className="px-2 py-1.5 border border-gray-100 text-blue-700 font-medium">{m.model}</td>
                          <td className="px-2 py-1.5 border border-gray-100">{m.type}</td>
                          <td className="px-2 py-1.5 border border-gray-100">{m.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hcModel && (
                  <p className="text-[10px] text-green-600 mt-1">
                    ✅ 선택됨: {hcModel.name} / {hcModel.model} ({hcModel.type}) v{hcModel.version}
                  </p>
                )}
              </div>
            )}

            {/* 제품 선택 (복수 제품일 경우) */}
            {productList.length > 1 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">제품 선택 *</label>
                <div className="flex flex-wrap gap-2">
                  {productList.map((p, i) => (
                    <button key={i} type="button"
                      onClick={() => handleProductSelect(p)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                        selectedProduct === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-foreground'
                      )}>
                      {p['제품명'] as string}{p['버전'] ? ` v${p['버전']}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 자동 로드된 정보 표시 */}
            {selectedProduct && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '제품명',    value: prodName },
                  { label: '버전',      value: prodVer  },
                  { label: 'IP 주소',   value: prodIP   },
                  { label: '설치장소',  value: prodLoc  },
                  { label: '고객 ID',   value: custId   },
                  { label: '고객 연락처', value: custPhone },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-xs font-medium text-foreground mt-0.5 break-words">{value || '-'}</p>
                  </div>
                ))}
              </div>
            )}

            {/* UDI / 시리얼 번호 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">UDI 정보</label>
                <input
                  className="w-full bg-muted/60 rounded-xl px-3 h-10 text-sm border border-border outline-none focus:border-primary transition-colors"
                  placeholder="(01) 0880..."
                  value={udi}
                  onChange={e => setUdi(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">시리얼 번호</label>
                <input
                  className="w-full bg-muted/60 rounded-xl px-3 h-10 text-sm border border-border outline-none focus:border-primary transition-colors"
                  placeholder="ACC260601C01"
                  value={serialNo}
                  onChange={e => setSerialNo(e.target.value)}
                />
              </div>
            </div>

            {/* 작성자 / 작성일 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">작성자</label>
                <div className="bg-muted/40 rounded-xl px-3 py-2.5 text-sm text-foreground">{user?.name || '-'}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">작성일</label>
                <div className="bg-muted/40 rounded-xl px-3 py-2.5 text-sm text-foreground">{writeDate}</div>
              </div>
            </div>
          </section>

          {/* ─ 타입 선택 ─ */}
          <section className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h2 className="text-sm font-bold text-foreground">설치 타입 / 유형</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">타입</label>
              <div className="flex flex-wrap gap-2">
                {DEVICE_TYPES.map(t => (
                  <button key={t} type="button"
                    onClick={() => setDeviceType(t)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      deviceType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-foreground'
                    )}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">설치 유형</label>
              <div className="flex flex-wrap gap-2">
                {INSTALL_TYPES.map(t => (
                  <button key={t} type="button"
                    onClick={() => setInstallType(t)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      installType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-foreground'
                    )}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ─ 설치 적격성 평가 ─ */}
          <section className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h2 className="text-sm font-bold text-foreground">
              설치 적격성 평가
              <span className="ml-2 text-xs font-normal text-muted-foreground">P: Pass · F: Fail · N: N/A</span>
            </h2>
            <div className="space-y-3">
              {INSTALL_CHECKS.map(({ key, label, desc, options }) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                  </div>
                  <PFNButtons
                    value={installChecks[key]}
                    onChange={v => setInstallChecks(prev => ({ ...prev, [key]: v }))}
                    options={options as readonly string[]}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-bold text-foreground">종합판정</span>
              <span className={cn(
                'px-4 py-1 rounded-full text-sm font-bold',
                installVerdict === 'Pass' ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
              )}>{installVerdict}</span>
            </div>
          </section>

          {/* ─ 운영 적격성 평가 ─ */}
          <section className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h2 className="text-sm font-bold text-foreground">
              운영 적격성 평가
              <span className="ml-2 text-xs font-normal text-muted-foreground">P: Pass · F: Fail · N: N/A</span>
            </h2>
            <div className="space-y-3">
              {OPERATION_CHECKS.map(({ key, label, desc, options }) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                  </div>
                  <PFNButtons
                    value={opChecks[key]}
                    onChange={v => setOpChecks(prev => ({ ...prev, [key]: v }))}
                    options={options as readonly string[]}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-bold text-foreground">종합판정</span>
              <span className={cn(
                'px-4 py-1 rounded-full text-sm font-bold',
                opVerdict === 'Pass' ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
              )}>{opVerdict}</span>
            </div>
          </section>

          {/* ─ 보안환경 점검 ─ */}
          <section className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h2 className="text-sm font-bold text-foreground">
              물리적·기술적 보안환경 점검
              <span className="ml-2 text-xs font-normal text-muted-foreground">P: Pass · F: Fail</span>
            </h2>
            <div className="space-y-3">
              {SECURITY_CHECKS.map(({ key, label, desc, options }) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                  </div>
                  <PFNButtons
                    value={secChecks[key]}
                    onChange={v => setSecChecks(prev => ({ ...prev, [key]: v }))}
                    options={options as readonly string[]}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-bold text-foreground">종합판정</span>
              <span className={cn(
                'px-4 py-1 rounded-full text-sm font-bold',
                secVerdict === 'Pass' ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
              )}>{secVerdict}</span>
            </div>
          </section>

          {/* ─ 특이사항 및 조치내용 ─ */}
          <section className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">특이사항 및 조치내용</h2>
              <button type="button" onClick={addIssueRow}
                className="flex items-center gap-1 text-xs text-primary font-medium">
                <Plus className="w-3.5 h-3.5" />행 추가
              </button>
            </div>
            {issues.map((row, i) => (
              <div key={i} className="bg-muted/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">#{i+1}</span>
                  {issues.length > 1 && (
                    <button type="button" onClick={() => removeIssueRow(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">문제 항목</label>
                  <input
                    className="w-full bg-background rounded-lg px-2.5 h-9 text-sm border border-border outline-none focus:border-primary mt-1"
                    placeholder="문제 항목 입력"
                    value={row.problem}
                    onChange={e => updateIssue(i, 'problem', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">조치 내용</label>
                  <Textarea
                    className="w-full bg-background rounded-lg px-2.5 py-2 text-sm border border-border outline-none focus:border-primary mt-1 resize-none"
                    rows={2}
                    placeholder="조치 내용 입력"
                    value={row.action}
                    onChange={e => updateIssue(i, 'action', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </section>

          {/* ─ 비고 ─ */}
          <section className="bg-card rounded-2xl p-4 border border-border">
            <h2 className="text-sm font-bold text-foreground mb-2">비고</h2>
            <Textarea
              className="w-full bg-muted/60 rounded-xl px-3 py-2.5 text-sm border border-border outline-none focus:border-primary resize-none"
              rows={3}
              placeholder="기타 특이사항을 자유롭게 입력하세요"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </section>

          {/* ─ 사진 첨부 ─ */}
          <section className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              첨부자료 (사진)
            </h2>

            {/* 카테고리 선택 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">촬영 카테고리</label>
              <div className="flex gap-2 flex-wrap">
                {PHOTO_CATS.map(cat => (
                  <button key={cat} type="button"
                    onClick={() => setPhotoCategory(cat)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      photoCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-foreground'
                    )}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 추가 버튼 */}
            <button type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-muted/60 border-2 border-dashed border-border rounded-xl py-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Camera className="w-4 h-4" />
              [{photoCategory}] 사진 추가
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoAdd}
            />

            {/* 미리보기 */}
            {photos.length > 0 && (
              <div className="space-y-3">
                {PHOTO_CATS.filter(cat => photos.some(p => p.category === cat)).map(cat => (
                  <div key={cat}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">📷 {cat}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {photos.filter(p => p.category === cat).map((p, idx) => {
                        const absIdx = photos.indexOf(p);
                        return (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                            <img src={p.preview} alt={cat} className="w-full h-full object-cover" />
                            <button type="button"
                              onClick={() => removePhoto(absIdx)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─ 저장 버튼 ─ */}
          <Button
            className="w-full h-12 rounded-2xl text-base font-bold"
            onClick={() => {
              if (!hospitalName) { alert('병원명을 입력하세요.'); return; }
              setShowModal(true);
            }}
          >
            저장 및 PDF 생성
          </Button>

        </div>
      </PageWrapper>

      {/* ─ 확인 모달 ─ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-foreground">이 내용으로 저장하시겠습니까?</h3>
            <div className="space-y-1.5 text-sm text-foreground">
              <div className="flex justify-between"><span className="text-muted-foreground">병원명</span><span className="font-medium">{hospitalName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">제품명</span><span className="font-medium">{prodName || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">버전</span><span className="font-medium">{prodVer || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">설치유형</span><span className="font-medium">{installType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">설치적격</span>
                <span className={cn('font-bold', installVerdict === 'Pass' ? 'text-green-600' : 'text-red-600')}>{installVerdict}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">운영적격</span>
                <span className={cn('font-bold', opVerdict === 'Pass' ? 'text-green-600' : 'text-red-600')}>{opVerdict}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">보안환경</span>
                <span className={cn('font-bold', secVerdict === 'Pass' ? 'text-green-600' : 'text-red-600')}>{secVerdict}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">첨부사진</span><span className="font-medium">{photos.length}장</span></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowModal(false)}>취소</Button>
              <Button className="flex-1 rounded-xl" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? '저장 중...' : '저장하기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
