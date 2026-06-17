// ══════════════════════════════════════════════════════════════════
// Index.tsx — 점검 서비스 확인서 v2
// 병원 자동완성 | 제품 드롭다운 | 로그인 자동입력 | 점검유형 선택
// 고객 이메일 발송 | 확인 모달 | 사진 첨부
// ══════════════════════════════════════════════════════════════════
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/api/gasClient';
import type { HospitalProduct } from '@/api/gasClient';
import { GAS_API_URL, ROUTE_PATHS } from '@/lib/index';

const GAS_URL = GAS_API_URL;

// ── 상수 ──────────────────────────────────────────────────────────
const INSP_TYPES = ['정기점검', 'CS점검', '비정기점검'] as const;
type InspType = typeof INSP_TYPES[number];

type PFN = 'P' | 'F' | 'N' | '';
interface InspectionResult { [item: string]: PFN; 종합판정?: 'Pass' | 'Fail' | '' }
interface IssueRow { 문제항목: string; 조치내용: string; 비고: string }

const INS_ITEMS = [
  '소프트웨어 버전 확인', '서버/클라이언트 정상 동작', '네트워크 연결 상태',
  '제품 실행 및 분석 기능', 'PACS 리포트 전송', '로그 및 오류 이력 확인',
  '데이터 백업 상태', '라이선스 유효성',
];
const SEC_ITEMS = [
  '서버실 출입 통제', '네트워크 분리 여부', '바이러스 백신 운용', '계정 및 접근권한 관리',
];
const SYS_TYPES = ['Standalone', 'On-Premise Win', 'On-Premise Web', 'Cloud'];
const NEXT_DATE_OPTS = ['1개월 후', '3개월 후', '6개월 후', '12개월 후', '직접 입력'];
const ISSUE_OPTS = ['없음', '소프트웨어 오류', '네트워크 문제', '라이선스 만료 임박', 'PACS 연동 오류', '성능 저하', '기타'];
const ACTION_OPTS = ['조치 완료', '현장 처리 완료', '원격 지원 완료', '모니터링 중', '추가 방문 필요', '기타'];

// ── GAS 호출 ──────────────────────────────────────────────────────
async function callGAS(action: string, payload: object = {}) {
  const email = localStorage.getItem('heuling_user_email') || '';
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, email, ...payload }),
  });
  return res.json() as Promise<{ success: boolean; data?: any; error?: string }>;
}

// ── 공통 스타일 ────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500 bg-white';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-blue-50 px-4 py-2.5 border-b border-gray-100">
        <h3 className="text-sm font-bold text-blue-800">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// ── 병원 자동완성 ──────────────────────────────────────────────────
function HospitalAutoComplete({ value, onChange, onSelect, hospitals }: {
  value: string; onChange: (v: string) => void;
  onSelect: (name: string) => void; hospitals: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = value.trim()
    ? hospitals.filter(h => h.includes(value)).slice(0, 12)
    : hospitals.slice(0, 12);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="입력하면 자동완성 ↓  예) 홍성 → 홍성의료원"
        className={inputCls}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(h => (
            <li key={h}
              onMouseDown={() => { onChange(h); onSelect(h); setOpen(false); }}
              className="px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0">
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 제품 드롭다운 ──────────────────────────────────────────────────
function ProductDropdown({ value, onChange, onSelect, products, disabled }: {
  value: string; onChange: (v: string) => void;
  onSelect: (p: HospitalProduct) => void;
  products: HospitalProduct[]; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = value.trim() ? products.filter(p => p.제품명.includes(value)) : products;

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => !disabled && setOpen(true)}
        placeholder={disabled ? '병원을 먼저 선택하세요' : '제품 선택 ↓'}
        disabled={disabled}
        className={`${inputCls} ${disabled ? 'bg-gray-50 text-gray-400' : ''}`}
      />
      {!disabled && open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((p, i) => (
            <li key={i}
              onMouseDown={() => { onChange(p.제품명); onSelect(p); setOpen(false); }}
              className="px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-0">
              <div className="text-sm font-medium text-gray-800">{p.제품명}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {p.설치장소 && `📍 ${p.설치장소}  `}
                {p.연락처 && `📞 ${p.연락처}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 터치 선택 드롭다운 (비고 외 텍스트 선택용) ──────────────────────
function PickerDropdown({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${inputCls} text-left flex items-center justify-between ${!value ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <span className="truncate">{value || placeholder || '선택'}</span>
        <span className="text-gray-400 ml-2 shrink-0">▼</span>
      </button>
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {options.map(opt => (
            <li key={opt}
              onMouseDown={() => { onChange(opt); setOpen(false); }}
              className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-0
                ${value === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── PFN 버튼 ──────────────────────────────────────────────────────
function PFNSelect({ value, onChange }: { value: PFN; onChange: (v: PFN) => void }) {
  return (
    <div className="flex gap-1">
      {(['P', 'F', 'N'] as PFN[]).map(v => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`w-8 h-7 rounded text-xs font-bold transition
            ${value === v
              ? v === 'P' ? 'bg-green-500 text-white' : v === 'F' ? 'bg-red-500 text-white' : 'bg-gray-400 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {v}
        </button>
      ))}
    </div>
  );
}

// ── 서명 패드 ──────────────────────────────────────────────────────
function SignaturePad({ label, onSave, onClear, saved }: {
  label: string; onSave: (dataUrl: string) => void;
  onClear: () => void; saved: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); drawing.current = true; lastPos.current = getPos(e);
  };
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    lastPos.current = pos;
  };
  const endDraw = () => { drawing.current = false; };
  const handleClear = () => {
    canvasRef.current!.getContext('2d')!.clearRect(0, 0, 600, 180);
    onClear();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <div className={`border-2 rounded-xl overflow-hidden ${saved ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white'}`}>
        <canvas ref={canvasRef} width={600} height={180}
          className="w-full touch-none cursor-crosshair" style={{ display: 'block' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      </div>
      {saved && <p className="text-xs text-green-600 font-medium">✅ 서명 저장됨</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleClear}
          className="flex-1 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
          지우기
        </button>
        <button type="button" onClick={() => onSave(canvasRef.current!.toDataURL('image/png'))}
          className="flex-1 py-1.5 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800">
          서명 확인
        </button>
      </div>
    </div>
  );
}

// ── 확인 모달 ──────────────────────────────────────────────────────
function ConfirmModal({ open, onConfirm, onCancel, data }: {
  open: boolean; onConfirm: () => void; onCancel: () => void;
  data: { hospital: string; inspType: string; inspDate: string; product: string; custEmail: string; inspector: string };
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-6 space-y-4">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto sm:hidden" />
        <h3 className="text-base font-bold text-gray-800 text-center">📤 이 내용으로 저장하시겠습니까?</h3>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <Row label="병원명" value={data.hospital} />
          <Row label="점검 유형" value={data.inspType} />
          <Row label="제품명" value={data.product || '—'} />
          <Row label="점검일자" value={data.inspDate} />
          <Row label="점검자" value={data.inspector} />
          {data.custEmail && <Row label="고객 이메일" value={data.custEmail} highlight />}
        </div>
        {data.custEmail
          ? <p className="text-xs text-center text-blue-600 bg-blue-50 rounded-xl px-3 py-2">
              📧 저장 완료 후 위 이메일로 PDF가 자동 발송됩니다
            </p>
          : <p className="text-xs text-center text-gray-400">
              고객 이메일 미입력 — 이메일 발송 없이 저장만 됩니다
            </p>
        }
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50">
            취소
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800">
            ✅ 확인, 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`font-medium text-right break-all ${highlight ? 'text-blue-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 메인 페이지
// ══════════════════════════════════════════════════════════════════
export default function ServiceReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── 기본정보 ────────────────────────────────────────────────────
  const [inspType,       setInspType]       = useState<InspType>('정기점검');
  const [hospital,       setHospital]       = useState('');
  const [product,        setProduct]        = useState('');
  const [sysType,        setSysType]        = useState('On-Premise Web');
  const [custName,       setCustName]       = useState('');
  const [custPhone,      setCustPhone]      = useState('');
  const [custEmail,      setCustEmail]      = useState('');
  const [location,       setLocation]       = useState('');
  const [inspDate,       setInspDate]       = useState(new Date().toISOString().slice(0, 10));
  const [nextDateMode,   setNextDateMode]   = useState('6개월 후');
  const [nextDateCustom, setNextDateCustom] = useState('');
  const [inspector,      setInspector]      = useState('');
  const [myEmail,        setMyEmail]        = useState('');

  // ── 병원/제품 ────────────────────────────────────────────────────
  const [hospitalProducts,  setHospitalProducts]  = useState<HospitalProduct[]>([]);
  const [loadingProducts,   setLoadingProducts]   = useState(false);

  // ── 점검항목 ─────────────────────────────────────────────────────
  const [insResults, setInsResults] = useState<InspectionResult>(
    () => Object.fromEntries(INS_ITEMS.map(k => [k, 'P' as PFN]))
  );
  const [insJudge, setInsJudge] = useState<'Pass' | 'Fail' | ''>('');
  const [secResults, setSecResults] = useState<InspectionResult>(
    () => Object.fromEntries(SEC_ITEMS.map(k => [k, 'N' as PFN]))
  );
  const [secJudge, setSecJudge] = useState<'Pass' | 'Fail' | ''>('');

  // ── 특이사항 + 사진 ──────────────────────────────────────────────
  const [issues, setIssues] = useState<IssueRow[]>([{ 문제항목: '없음', 조치내용: '', 비고: '' }]);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

  // ── 서명 ─────────────────────────────────────────────────────────
  const [inspSign, setInspSign] = useState('');
  const [custSign,  setCustSign]  = useState('');

  // ── 상태 ─────────────────────────────────────────────────────────
  const [step,        setStep]        = useState<1 | 2 | 3 | 4>(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState('');
  const [pdfUrl,      setPdfUrl]      = useState('');
  const [emailSent,   setEmailSent]   = useState(false);

  // 로그인 자동입력
  useEffect(() => {
    if (user) { setInspector(user.name); setMyEmail(user.email); }
  }, [user]);

  // 병원 목록
  const { data: hospitals = [] } = useQuery({
    queryKey: ['hospitals-simple'],
    queryFn: async () => {
      const res = await api.getHospitalList();
      return res.data?.map(h => h.hospitalName) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 병원 선택
  const handleHospitalSelect = useCallback(async (name: string) => {
    setHospital(name);
    setProduct(''); setHospitalProducts([]);
    setCustPhone(''); setLocation(''); setCustName('');
    setLoadingProducts(true);
    try {
      const res = await api.getHospitalDetail(name);
      const prods: HospitalProduct[] = (res.data as any)?.products || [];
      setHospitalProducts(prods);
      if (prods.length === 1) {
        setProduct(prods[0].제품명);
        if (prods[0].연락처)     setCustPhone(String(prods[0].연락처));
        if (prods[0].설치장소)   setLocation(String(prods[0].설치장소));
        if (prods[0].고객담당자) setCustName(String(prods[0].고객담당자));
      }
    } catch { /* ignore */ } finally { setLoadingProducts(false); }
  }, []);

  // 제품 선택
  const handleProductSelect = useCallback((p: HospitalProduct) => {
    setProduct(p.제품명);
    if (p.연락처)     setCustPhone(String(p.연락처));
    if (p.설치장소)   setLocation(String(p.설치장소));
    if (p.고객담당자) setCustName(String(p.고객담당자));
  }, []);

  // 특이사항
  const addIssue    = () => setIssues(p => [...p, { 문제항목: '', 조치내용: '', 비고: '' }]);
  const removeIssue = (i: number) => setIssues(p => p.filter((_, idx) => idx !== i));
  const updateIssue = (i: number, key: keyof IssueRow, val: string) =>
    setIssues(p => p.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  // 사진 추가/삭제
  const addPhotos = (files: FileList) => {
    const newPhotos = Array.from(files).map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };
  const removePhoto = (i: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const nextDate = nextDateMode === '직접 입력' ? nextDateCustom : nextDateMode;

  // ── 저장 실행 ────────────────────────────────────────────────────
  const doSubmit = useCallback(async () => {
    setShowConfirm(false);
    setLoading(true);
    setMsg('서비스확인서 저장 중...');
    try {
      // 사진 업로드
      const photoUrls: string[] = [];
      for (const p of photos) {
        const base64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(p.file);
        });
        const up = await callGAS('uploadPhoto', {
          base64, fileName: p.file.name, mimeType: p.file.type, category: 'SVC_REPORT',
        });
        if (up.success && up.data?.fileUrl) photoUrls.push(up.data.fileUrl);
      }

      // 서비스확인서 저장
      const createRes = await callGAS('createServiceReport', {
        점검유형: inspType, 병원명: hospital, 제품명: product,
        시스템타입: sysType, 고객이름: custName, 고객연락처: custPhone,
        고객이메일: custEmail, 설치장소: location, 점검일자: inspDate,
        정기점검결과: { ...insResults, 종합판정: insJudge },
        보안환경결과: { ...secResults, 종합판정: secJudge },
        특이사항: issues, 사진URLs: photoUrls,
        다음점검예정일: nextDate, 점검자명: inspector,
        점검자이메일: myEmail,
        점검자서명Base64: inspSign.split(',')[1] ?? inspSign,
        고객서명Base64:   custSign.split(',')[1] ?? custSign,
      });
      if (!createRes.success) throw new Error(createRes.error);
      const rowIndex = createRes.data.rowIndex;

      // PDF 생성
      setMsg('PDF 생성 중...');
      const pdfRes = await callGAS('generateServiceReportPDF', { rowIndex });
      if (!pdfRes.success) throw new Error(pdfRes.error);
      const generatedPdfUrl = pdfRes.data.pdfUrl;
      setPdfUrl(generatedPdfUrl);

      // 고객 이메일 발송
      if (custEmail) {
        setMsg('고객 이메일 발송 중...');
        const mailRes = await callGAS('sendServiceReportEmail', {
          rowIndex, custEmail, pdfUrl: generatedPdfUrl,
          병원명: hospital, 점검유형: inspType,
          점검일자: inspDate, 점검자명: inspector,
        });
        setEmailSent(mailRes.success);
      }

      setStep(4); setMsg('');
    } catch (err: any) {
      setMsg('❌ 오류: ' + err.message);
    } finally { setLoading(false); }
  }, [hospital, product, sysType, custName, custPhone, custEmail, location,
      inspDate, insResults, insJudge, secResults, secJudge, issues, nextDate,
      inspector, myEmail, inspSign, custSign, inspType, photos]);

  const handleSubmitClick = () => {
    if (!hospital)  { setMsg('❌ 병원명을 입력하세요'); return; }
    if (!inspSign)  { setMsg('❌ 점검자 서명을 완료하세요'); return; }
    if (!custSign)  { setMsg('❌ 고객 서명을 완료하세요'); return; }
    setMsg(''); setShowConfirm(true);
  };

  const resetAll = () => {
    setStep(1); setHospital(''); setProduct('');
    setSysType('On-Premise Web'); setCustName(''); setCustPhone('');
    setCustEmail(''); setLocation('');
    setInspDate(new Date().toISOString().slice(0, 10));
    setNextDateMode('6개월 후'); setNextDateCustom('');
    setInspSign(''); setCustSign(''); setPdfUrl(''); setEmailSent(false);
    setInsJudge(''); setSecJudge('');
    setInsResults(Object.fromEntries(INS_ITEMS.map(k => [k, 'P' as PFN])));
    setSecResults(Object.fromEntries(SEC_ITEMS.map(k => [k, 'N' as PFN])));
    setIssues([{ 문제항목: '없음', 조치내용: '', 비고: '' }]);
    setPhotos([]); setHospitalProducts([]); setInspType('정기점검');
  };

  const typeColor = inspType === '정기점검' ? 'bg-blue-700'
    : inspType === 'CS점검' ? 'bg-orange-500' : 'bg-purple-600';
  const typeBadge = inspType === '정기점검' ? 'bg-blue-100 text-blue-700'
    : inspType === 'CS점검' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 확인 모달 */}
      <ConfirmModal
        open={showConfirm} onConfirm={doSubmit} onCancel={() => setShowConfirm(false)}
        data={{ hospital, inspType, inspDate, product, custEmail, inspector }}
      />

      {/* 헤더 */}
      <div className="bg-blue-800 text-white px-4 py-4 sticky top-0 z-10 shadow">
        <h1 className="text-lg font-bold">📋 점검 서비스 확인서</h1>
        <div className="flex gap-1 mt-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${step >= s ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] mt-0.5 text-white/70">
          <span>기본정보</span><span>점검항목</span><span>서명</span>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">

        {/* 설치환경 정보요청서 바로가기 */}
        {step === 1 && (
          <button onClick={() => navigate(ROUTE_PATHS.INSTALL_REQUEST)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition active:scale-[0.98]">
            <span className="text-lg">📋</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">설치환경 정보요청서</p>
              <p className="text-xs text-slate-400">Installation Environment Request</p>
            </div>
            <span className="text-slate-400 text-sm">→</span>
          </button>
        )}

        {/* 설치 및 운영 적격성 확인서 바로가기 */}
        {step === 1 && (
          <button onClick={() => navigate(ROUTE_PATHS.QUALIFICATION)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-900 text-white rounded-xl hover:bg-blue-800 transition active:scale-[0.98]">
            <span className="text-lg">✅</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">설치 및 운영 적격성 확인서</p>
              <p className="text-xs text-blue-300">Installation &amp; Operation Qualification</p>
            </div>
            <span className="text-blue-400 text-sm">→</span>
          </button>
        )}

        {/* ════ STEP 1: 기본정보 ════ */}
        {step === 1 && (
          <div className="space-y-3">
            {/* 점검 유형 */}
            <SectionCard title="점검 유형 선택 *">
              <div className="flex gap-2">
                {INSP_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setInspType(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition
                      ${inspType === t
                        ? t === '정기점검' ? 'bg-blue-700 text-white border-blue-700'
                          : t === 'CS점검' ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* 기본정보 */}
            <SectionCard title="1. 기본정보">
              {/* 병원명 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">병원명 *</label>
                <HospitalAutoComplete
                  value={hospital} onChange={setHospital}
                  onSelect={handleHospitalSelect} hospitals={hospitals}
                />
                {loadingProducts && <p className="text-xs text-blue-500 mt-1">📦 제품 정보 불러오는 중...</p>}
              </div>

              {/* 제품명 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">제품명</label>
                <ProductDropdown
                  value={product} onChange={setProduct}
                  onSelect={handleProductSelect}
                  products={hospitalProducts} disabled={!hospital}
                />
              </div>

              {/* 시스템 타입 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">시스템 타입</label>
                <div className="flex flex-wrap gap-2">
                  {SYS_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setSysType(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                        ${sysType === t ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 고객 이름 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  고객 이름 (담당){custName && <span className="ml-1 text-blue-500">✓ 자동입력</span>}
                </label>
                <input value={custName} onChange={e => setCustName(e.target.value)}
                  placeholder="예) 권은주" className={inputCls} />
              </div>

              {/* 고객 연락처 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  고객 연락처{custPhone && <span className="ml-1 text-blue-500">✓ 자동입력</span>}
                </label>
                <input type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)}
                  placeholder="010-0000-0000" className={inputCls} />
              </div>

              {/* 고객 이메일 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  고객 이메일
                  <span className="ml-1 text-green-600 font-medium">← 입력 시 PDF 자동 발송</span>
                </label>
                <input type="email" value={custEmail} onChange={e => setCustEmail(e.target.value)}
                  placeholder="customer@hospital.com" className={inputCls} />
              </div>

              {/* 설치 장소 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  설치 장소{location && <span className="ml-1 text-blue-500">✓ 자동입력</span>}
                </label>
                <input value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="예) 영상의학과 접수" className={inputCls} />
              </div>

              {/* 점검 일자 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">점검 일자</label>
                <input type="date" value={inspDate} onChange={e => setInspDate(e.target.value)} className={inputCls} />
              </div>

              {/* 다음 점검 예정일 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">다음 점검 예정일</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {NEXT_DATE_OPTS.map(opt => (
                    <button key={opt} type="button" onClick={() => setNextDateMode(opt)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                        ${nextDateMode === opt ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                {nextDateMode === '직접 입력' && (
                  <input type="date" value={nextDateCustom}
                    onChange={e => setNextDateCustom(e.target.value)} className={inputCls} />
                )}
              </div>

              {/* 점검자 성명 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  점검자 성명 * <span className="text-blue-500">✓ 로그인 자동입력</span>
                </label>
                <input value={inspector} onChange={e => setInspector(e.target.value)}
                  placeholder="예) 김성환" className={inputCls} />
              </div>

              {/* 담당자 이메일 (읽기 전용) */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  담당자 이메일 <span className="text-blue-500">✓ 로그인 자동입력</span>
                </label>
                <input type="email" value={myEmail} readOnly
                  className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`} />
              </div>
            </SectionCard>

            <button
              onClick={() => {
                if (!hospital || !inspector) { setMsg('❌ 병원명, 점검자 성명은 필수입니다'); return; }
                setMsg(''); setStep(2);
              }}
              className="w-full py-3 rounded-xl bg-blue-700 text-white font-bold text-sm hover:bg-blue-800">
              다음 → 점검항목 입력
            </button>
            {msg && <p className="text-sm text-center text-red-500">{msg}</p>}
          </div>
        )}

        {/* ════ STEP 2: 점검항목 ════ */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${typeColor}`}>{inspType}</span>
              <span className="text-sm text-gray-600 font-medium">{hospital}</span>
              {product && <span className="text-xs text-gray-400">{product}</span>}
            </div>

            {/* 정기점검항목 */}
            <SectionCard title="2. 점검항목 (P / F / N)">
              {INS_ITEMS.map(item => (
                <div key={item} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-700 flex-1">{item}</span>
                  <PFNSelect value={insResults[item] as PFN}
                    onChange={v => setInsResults(p => ({ ...p, [item]: v }))} />
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-gray-700">종합판정</span>
                <div className="flex gap-2">
                  {(['Pass', 'Fail'] as const).map(v => (
                    <button key={v} type="button" onClick={() => setInsJudge(v)}
                      className={`px-3 py-1 rounded text-xs font-bold transition
                        ${insJudge === v ? (v === 'Pass' ? 'bg-green-500' : 'bg-red-500') + ' text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* 보안환경 */}
            <SectionCard title="3. 보안환경점검 (P / F / N)">
              {SEC_ITEMS.map(item => (
                <div key={item} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-700 flex-1">{item}</span>
                  <PFNSelect value={secResults[item] as PFN}
                    onChange={v => setSecResults(p => ({ ...p, [item]: v }))} />
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-gray-700">종합판정</span>
                <div className="flex gap-2">
                  {(['Pass', 'Fail'] as const).map(v => (
                    <button key={v} type="button" onClick={() => setSecJudge(v)}
                      className={`px-3 py-1 rounded text-xs font-bold transition
                        ${secJudge === v ? (v === 'Pass' ? 'bg-green-500' : 'bg-red-500') + ' text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* 특이사항 */}
            <SectionCard title="4. 특이사항 및 조치내용">
              {issues.map((row, i) => (
                <div key={i} className="space-y-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">항목 {i + 1}</span>
                    {issues.length > 1 && (
                      <button type="button" onClick={() => removeIssue(i)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded border border-red-200 hover:bg-red-50">
                        삭제
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">문제 항목</label>
                    <PickerDropdown value={row.문제항목}
                      onChange={v => updateIssue(i, '문제항목', v)}
                      options={ISSUE_OPTS} placeholder="터치하여 선택" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">조치 내용</label>
                    <PickerDropdown value={row.조치내용}
                      onChange={v => updateIssue(i, '조치내용', v)}
                      options={ACTION_OPTS} placeholder="터치하여 선택" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">비고 (자유 입력)</label>
                    <input value={row.비고} onChange={e => updateIssue(i, '비고', e.target.value)}
                      placeholder="추가 내용을 자유롭게 입력" className={inputCls} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addIssue}
                className="w-full py-1.5 rounded border border-dashed border-blue-300 text-blue-600 text-xs hover:bg-blue-50">
                + 항목 추가
              </button>
            </SectionCard>

            {/* 현장 사진 */}
            <SectionCard title="5. 현장 사진 첨부 (선택)">
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition active:scale-[0.98]">
                  <div className="text-3xl mb-1">📷</div>
                  <p className="text-sm font-medium text-gray-600">사진 추가</p>
                  <p className="text-xs text-gray-400 mt-0.5">여러 장 선택 가능</p>
                </div>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { if (e.target.files) { addPhotos(e.target.files); e.target.value = ''; } }} />
              </label>
              {photos.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p, i) => (
                      <div key={i} className="relative group">
                        <img src={p.preview} alt=""
                          className="w-full h-24 object-cover rounded-xl border border-gray-200" />
                        <button type="button" onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center">{photos.length}장 선택됨</p>
                </>
              )}
            </SectionCard>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">
                ← 이전
              </button>
              <button onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-xl bg-blue-700 text-white font-bold text-sm hover:bg-blue-800">
                다음 → 서명
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 3: 서명 ════ */}
        {step === 3 && (
          <div className="space-y-4">
            {/* 요약 카드 */}
            <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${typeColor}`}>{inspType}</span>
                <span className="font-bold text-gray-800">{hospital}</span>
              </div>
              {product  && <p className="text-gray-600">📦 {product}</p>}
              <p className="text-gray-600">📅 점검일: {inspDate}</p>
              <p className="text-gray-600">👤 점검자: {inspector}</p>
              {custEmail && (
                <p className="text-green-700 font-medium">📧 발송 예정: {custEmail}</p>
              )}
            </div>

            <SectionCard title="6. 점검자 서명">
              <p className="text-xs text-gray-400 mb-2">아래 영역에 서명해주세요</p>
              <SignaturePad
                label={`점검자: ${inspector} (휴런)`}
                onSave={setInspSign} onClear={() => setInspSign('')} saved={!!inspSign}
              />
            </SectionCard>

            <SectionCard title="7. 고객 서명">
              <p className="text-xs text-gray-400 mb-2">고객에게 폰을 건네 서명받으세요</p>
              <SignaturePad
                label={`고객: ${custName || '고객명 입력 후 서명'}`}
                onSave={setCustSign} onClear={() => setCustSign('')} saved={!!custSign}
              />
            </SectionCard>

            {msg && (
              <p className={`text-sm text-center font-medium ${msg.startsWith('❌') ? 'text-red-500' : 'text-blue-600'}`}>
                {msg}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} disabled={loading}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40">
                ← 이전
              </button>
              <button onClick={handleSubmitClick} disabled={loading || !inspSign || !custSign}
                className={`flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40 ${typeColor} hover:opacity-90`}>
                {loading ? '처리 중...' : '✅ 저장 및 PDF 생성'}
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 4: 완료 ════ */}
        {step === 4 && (
          <div className="text-center space-y-5 py-8">
            <div className="text-6xl">✅</div>
            <h2 className="text-xl font-bold text-gray-800">서비스확인서 완료!</h2>
            <div className="space-y-2">
              <p className="text-gray-600 font-medium">{hospital}</p>
              <p className="text-sm text-gray-400">{inspDate}</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white ${typeColor}`}>
                {inspType}
              </span>
            </div>
            {emailSent && custEmail && (
              <div className="bg-green-50 rounded-xl px-4 py-3">
                <p className="text-sm text-green-700 font-medium">📧 이메일 발송 완료</p>
                <p className="text-xs text-green-600 mt-0.5">{custEmail}</p>
              </div>
            )}
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block px-6 py-3 rounded-xl bg-blue-700 text-white font-bold text-sm hover:bg-blue-800">
                📄 PDF 보기 / 공유
              </a>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button onClick={() => window.history.back()}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">
                ← 돌아가기
              </button>
              <button onClick={resetAll}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700">
                + 새 확인서 작성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
