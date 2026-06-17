// ══════════════════════════════════════════════════════════════════
// install-request/Index.tsx — 설치환경 정보요청서
// STEP 1: 영업팀 → A(병원기본) + B(계약행정) + C(설치환경) 작성
// STEP 2: 영업 서명 (병원 + 영업 담당자)
// STEP 3: TE → 연동방식 선택 → D-1(CT/MRI) or D-2(PACS) 작성
// STEP 4: TE → E(교육) 작성
// STEP 5: TE 서명 (병원 + TE 담당자) → 확인 모달 → PDF 생성
// ══════════════════════════════════════════════════════════════════
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/api/gasClient';
import { GAS_API_URL } from '@/lib/index';

const GAS_URL = GAS_API_URL;

// ── GAS 호출 ──────────────────────────────────────────────────────
async function callGAS(action: string, payload: object = {}) {
  const email = localStorage.getItem('heuling_user_email') || '';
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, email, ...payload }),
  });
  return res.json() as Promise<{ success: boolean; data?: any; error?: string }>;
}

// ── 상수 ──────────────────────────────────────────────────────────
const CT_MAKERS = ['지멘스', 'GE', '필립스', 'Canon', 'Toshiba', '기타'];
const PACS_MAKERS = ['인피니트', '뷰렉스', '태영제타', 'Infinitt', 'PAXERA', '기타'];
const HEURON_PRODUCTS = [
  'Heuron NI', 'Heuron AD', 'Heuron Brain PET', 'Heuron ELVO',
  'Heuron StroCare Suite™', 'Heuron CTP', 'Heuron NM', 'Heuron CTA',
  'Heuron PD', 'Heuron SCS', '기타',
];

// 제품 모델 데이터 (UDI 제외 — 스크린샷 기준, 행 6,7,10,11,12,14,15,16,17)
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
const INSTALL_TYPES = ['납품', '데모', '연구', '기타'];
const CONTRACT_TYPES = ['정식', '과제', '무상', '기타'];
const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500 bg-white';

// ── 공통 컴포넌트 ──────────────────────────────────────────────────
function SectionCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-blue-50 px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <h3 className="text-sm font-bold text-blue-800">{title}</h3>
        {badge && <span className="text-xs bg-blue-700 text-white px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className={inputCls} />
    </div>
  );
}

function TwoField({ label1, val1, set1, ph1, label2, val2, set2, ph2, type2 = 'text' }: {
  label1: string; val1: string; set1: (v: string) => void; ph1?: string;
  label2: string; val2: string; set2: (v: string) => void; ph2?: string; type2?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={label1} value={val1} onChange={set1} placeholder={ph1} />
      <Field label={label2} value={val2} onChange={set2} placeholder={ph2} type={type2} />
    </div>
  );
}

function ToggleGroup({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
              ${value === opt ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerDropdown({ label, value, onChange, options, placeholder }: {
  label?: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <div ref={ref} className="relative">
        <button type="button" onClick={() => setOpen(o => !o)}
          className={`${inputCls} text-left flex items-center justify-between ${!value ? 'text-gray-400' : 'text-gray-800'}`}>
          <span className="truncate">{value || placeholder || '선택'}</span>
          <span className="text-gray-400 ml-2 shrink-0 text-xs">▼</span>
        </button>
        {open && (
          <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
            {options.map(opt => (
              <li key={opt} onMouseDown={() => { onChange(opt); setOpen(false); }}
                className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-0
                  ${value === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── 병원 자동완성 ──────────────────────────────────────────────────
interface HospitalSuggest { name: string; region?: string; address?: string; }

function HospitalInput({ value, onChange, onSelect, hospitals }: {
  value: string; onChange: (v: string) => void;
  onSelect: (h: HospitalSuggest) => void; hospitals: HospitalSuggest[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const query = value.trim().toLowerCase();
  const filtered = query
    ? hospitals.filter(h => h.name.toLowerCase().includes(query)).slice(0, 10)
    : hospitals.slice(0, 10);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div ref={ref} className="relative">
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} placeholder="병원명 입력 → 자동완성" className={inputCls} />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.map(h => (
            <li key={h.name} onMouseDown={() => { onChange(h.name); onSelect(h); setOpen(false); }}
              className="px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-800">{h.name}</p>
              {(h.address || h.region) && (
                <p className="text-xs text-gray-400 mt-0.5">{h.address || h.region}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 서명 패드 ──────────────────────────────────────────────────────
function SignPad({ label, onSave, onClear, saved }: {
  label: string; onSave: (d: string) => void; onClear: () => void; saved: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };
  const start = (e: React.TouchEvent | React.MouseEvent) => { e.preventDefault(); drawing.current = true; last.current = getPos(e); };
  const move  = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = getPos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    last.current = p;
  };
  const end = () => { drawing.current = false; };
  const clear = () => { canvasRef.current!.getContext('2d')!.clearRect(0, 0, 600, 160); onClear(); };
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <div className={`border-2 rounded-xl overflow-hidden ${saved ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white'}`}>
        <canvas ref={canvasRef} width={600} height={160} className="w-full touch-none cursor-crosshair" style={{ display: 'block' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      </div>
      {saved && <p className="text-xs text-green-600 font-medium">✅ 서명 완료</p>}
      <div className="flex gap-2">
        <button type="button" onClick={clear} className="flex-1 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600">지우기</button>
        <button type="button" onClick={() => onSave(canvasRef.current!.toDataURL('image/png'))}
          className="flex-1 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold">서명 확인</button>
      </div>
    </div>
  );
}

// ── 확인 모달 ──────────────────────────────────────────────────────
function ConfirmModal({ open, onOk, onCancel, hospital, date }: {
  open: boolean; onOk: () => void; onCancel: () => void; hospital: string; date: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-6 space-y-4">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto sm:hidden" />
        <h3 className="text-base font-bold text-gray-800 text-center">📄 저장하시겠습니까?</h3>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">병원명</span><span className="font-medium">{hospital}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">작성일</span><span className="font-medium">{date}</span></div>
        </div>
        <p className="text-xs text-center text-gray-400">저장 후 PDF가 생성됩니다</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium">취소</button>
          <button onClick={onOk} className="flex-1 py-3 rounded-xl bg-blue-700 text-white text-sm font-bold">✅ 저장하기</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 메인 페이지
// ══════════════════════════════════════════════════════════════════
interface CT { maker: string; model: string; year: string; location: string; aeTitle: string; ip: string; note: string }
const emptyCT = (): CT => ({ maker: '', model: '', year: '', location: '', aeTitle: '', ip: '', note: '' });

export default function InstallRequestPage() {
  const { user, isSales } = useAuth();

  // ── 제품 정보 (제품현황_국내 자동 등록용)
  const [prodName,    setProdName]    = useState('');
  const [prodVer,     setProdVer]     = useState('');
  const [installType, setInstallType] = useState('납품');
  const [contractType,setContractType]= useState('정식');
  // ── 라이선스 기간
  const [licenseStartDate, setLicenseStartDate] = useState('');
  const [licenseYears,     setLicenseYears]     = useState('');
  // ── 자체 서버 구비 / TE 사전 검토
  const [hasOwnServer,  setHasOwnServer]  = useState<'Y'|'N'>('Y');
  const [tePreReview,   setTePreReview]   = useState<'Y'|'N'>('Y');

  // ── A. 병원 기본 정보
  const [aHospital,  setAHospital]  = useState('');
  const [aDate,      setADate]      = useState(new Date().toISOString().slice(0, 10));
  const [aAddress,   setAAddress]   = useState('');
  const [aDept,      setADept]      = useState('');
  const [aContact,   setAContact]   = useState('');
  const [aPhone,     setAPhone]     = useState('');
  const [aEmail,     setAEmail]     = useState('');

  // ── B. 계약 및 행정 정보
  const [bContractName,  setBContractName]  = useState('');
  const [bContractPos,   setBContractPos]   = useState('');
  const [bContractPhone, setBContractPhone] = useState('');
  const [bContractEmail, setBContractEmail] = useState('');
  const [bNecaName,  setBNecaName]  = useState('');
  const [bNecaPhone, setBNecaPhone] = useState('');
  const [bNcctName,  setBNcctName]  = useState('');
  const [bNcctDept,  setBNcctDept]  = useState('');
  const [bConsentName,  setBConsentName]  = useState('');
  const [bConsentPhone, setBConsentPhone] = useState('');
  const [bConsentCount, setBConsentCount] = useState('');
  const [bBillName,  setBBillName]  = useState('');
  const [bBillPhone, setBBillPhone] = useState('');
  const [bContractRecvName,  setBContractRecvName]  = useState('');
  const [bContractRecvPhone, setBContractRecvPhone] = useState('');

  // ── C. 설치 장소 및 운영 환경
  const [cServerLoc,   setCServerLoc]   = useState('');
  const [cItDept,      setCItDept]      = useState('');
  const [cItName,      setCItName]      = useState('');
  const [cItPhone,     setCItPhone]     = useState('');
  const [cNetName,     setCNetName]     = useState('');
  const [cNetPhone,    setCNetPhone]    = useState('');
  const [cPacsName,    setCPacsName]    = useState('');
  const [cPacsPhone,   setCPacsPhone]   = useState('');
  const [cSchedule,    setCSchedule]    = useState('');
  const [cTimeSlot,    setCTimeSlot]    = useState('');
  const [cEntrance,    setCEntrance]    = useState('');
  const [cPreApproval, setCPreApproval] = useState('불필요');
  const [cAlarm,       setCAlarm]       = useState('미사용');
  const [cAlarmPhone,  setCAlarmPhone]  = useState('');
  const [cAlarmMethod, setCAlarmMethod] = useState('문자');

  // ── 영업 서명
  const [salesHospSign, setSalesHospSign] = useState('');
  const [salesSign,     setSalesSign]     = useState('');
  const [salesName,     setSalesName]     = useState('');
  const [salesPhone,    setSalesPhone]    = useState('');

  // ── 연동방식
  const [linkMethod, setLinkMethod] = useState<'D1' | 'D2'>('D1');

  // ── D-1. CT/MRI 장비
  const [d1Devices, setD1Devices] = useState<CT[]>([emptyCT(), emptyCT(), emptyCT()]);
  const updateD1 = (i: number, key: keyof CT, val: string) =>
    setD1Devices(p => p.map((d, idx) => idx === i ? { ...d, [key]: val } : d));

  // ── D-2. PACS 및 네트워크
  const [d2PacsMaker,  setD2PacsMaker]  = useState('');
  const [d2PacsVer,    setD2PacsVer]    = useState('');
  const [d2PacsIp,     setD2PacsIp]     = useState('');
  const [d2PacsAe,     setD2PacsAe]     = useState('');
  const [d2HisLink,    setD2HisLink]    = useState('연동 X');
  const [d2HisMaker,   setD2HisMaker]   = useState('');
  const [d2Internet,   setD2Internet]   = useState('가능');
  const [d2Firewall,   setD2Firewall]   = useState('없음');
  const [d2EnvType,    setD2EnvType]    = useState('On-premise');
  const [d2Note,       setD2Note]       = useState('');

  // ── E. 교육
  const [eNeed,    setENeed]    = useState('필요');
  const [eCount,   setECount]   = useState('');
  const [ePlace,   setEPlace]   = useState('');
  const [eDate,    setEDate]    = useState('');
  const [eName,    setEName]    = useState('');
  const [ePhone,   setEPhone]   = useState('');
  const [eMethod,  setEMethod]  = useState('집체교육');

  // ── TE 서명
  const [teHospSign, setTeHospSign] = useState('');
  const [teSign,     setTeSign]     = useState('');

  // ── 상태
  const [step,        setStep]        = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState('');
  const [pdfUrl,      setPdfUrl]      = useState('');

  // ── 역할 분기: TE 대기 목록 ───────────────────────────────
  const [draftRowIndex, setDraftRowIndex] = useState<number | null>(null);
  const [showDraftList, setShowDraftList] = useState(true); // TE 진입 시 기본 펼침
  const [salesSuccess,  setSalesSuccess]  = useState(false);

  // 로그인 자동입력
  useEffect(() => {
    if (user) {
      setSalesName(user.name);
      setSalesPhone(user.email);
      // B섹션 NECA/NCCT: 영업 담당자 이름 자동입력
      setBNecaName(user.name);
      setBNcctName(user.name);
      setBNcctDept(user.dept || 'TE');
    }
  }, [user]);

  // 병원 목록
  const { data: hospitals = [] } = useQuery<HospitalSuggest[]>({
    queryKey: ['hospitals-suggest'],
    queryFn: async () => {
      const res = await api.getHospitalList();
      return (res.data || []).map(h => ({
        name: h.hospitalName,
        region: h.region || '',
        address: (h as any).address || '',
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // 제품명 변경 시 최신 버전 자동 조회
  useEffect(() => {
    if (!prodName) return;
    api.getReleaseNotes().then(res => {
      const items = res.data || [];
      const match = items.find((r: any) =>
        r.product && prodName && r.product.toLowerCase().includes(
          prodName.replace('Heuron ', '').toLowerCase().split(' ')[0]
        )
      );
      if (match?.version) setProdVer(match.version);
    }).catch(() => {});
  }, [prodName]);

  // TE 대기 목록 조회 (영업완료 상태)
  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ['install-drafts'],
    queryFn: async () => {
      const res = await api.getInstallDrafts();
      return res.data || [];
    },
    enabled: !isSales,
    staleTime: 60 * 1000,
  });

  // TE 대기 목록에서 선택 시 pre-fill + STEP 3 이동
  const handleSelectDraft = useCallback((draft: any) => {
    setAHospital(draft.병원명 || '');
    setProdName(draft.제품명 || '');
    setProdVer(draft.버전 || '');
    setInstallType(draft.설치유형 || '');
    setContractType(draft.계약유형 || '');
    setCServerLoc(draft.서버위치 || '');
    setCItName(draft.IT담당자 || '');
    setCItPhone(draft.IT연락처 || '');
    setCPacsName(draft.PACS담당자 || '');
    setCPacsPhone(draft.PACS연락처 || '');
    setCSchedule(draft.설치일정 || '');
    setDraftRowIndex(draft.rowIndex);
    setShowDraftList(false);
    setStep(3); // 곧바로 TE 작성 단계로
  }, []);

  // 병원 선택 시 PACS 정보 자동 조회
  const handleHospitalSelect = useCallback(async (h: HospitalSuggest) => {
    const name = typeof h === 'string' ? h : h.name;
    setAHospital(name);
    // 주소 자동입력
    if (h.address) setAAddress(h.address);
    else if (h.region) setAAddress(h.region); // 지역이라도 채우기
    try {
      const res = await api.getHospitalDetail(name);
      const data = res.data as any;
      // 저장된 주소가 있으면 덮어쓰기
      if (data?.address) setAAddress(data.address);
      const products = data?.products || [];
      // PACS 정보 자동입력 (D-2)
      const pacsInfo = products.find((p: any) => p.제품명?.includes('PACS') || p.연동방식?.includes('PACS'));
      if (pacsInfo?.PACS업체) setD2PacsMaker(pacsInfo.PACS업체);
    } catch { /* ignore */ }
  }, []);

  // ── 저장 실행
  const doSubmit = useCallback(async () => {
    setShowConfirm(false);
    setLoading(true);
    setMsg('저장 중...');
    try {
      const payload = {
        제품명: prodName, 버전: prodVer, 설치유형: installType, 계약유형: contractType,
        라이선스기준일: licenseStartDate, 라이선스기간: licenseYears ? `${licenseYears}년` : '',
        자체서버구비: hasOwnServer, TE사전검토: tePreReview,
        A: { 병원명: aHospital, 작성일: aDate, 주소: aAddress, 담당부서: aDept, 담당자: aContact, 연락처: aPhone, 이메일: aEmail },
        B: { 계약담당자: bContractName, 직위부서: bContractPos, 연락처: bContractPhone, 이메일: bContractEmail,
             NECA담당자: bNecaName, NECA연락처: bNecaPhone, NCCT담당자: bNcctName, NCCT부서: bNcctDept,
             동의서담당자: bConsentName, 동의서연락처: bConsentPhone, 동의서인원: bConsentCount,
             계산서담당자: bBillName, 계산서연락처: bBillPhone,
             계약서담당자: bContractRecvName, 계약서연락처: bContractRecvPhone },
        C: { 서버위치: cServerLoc, IT부서: cItDept, IT담당자: cItName, IT연락처: cItPhone,
             네트워크담당자: cNetName, 네트워크연락처: cNetPhone, PACS담당자: cPacsName, PACS연락처: cPacsPhone,
             설치일정: cSchedule, 가능시간: cTimeSlot, 출입절차: cEntrance,
             사전신청: cPreApproval, 알람서비스: cAlarm, 알람연락처: cAlarmPhone, 알람수신방법: cAlarmMethod },
        영업서명_병원: salesHospSign.split(',')[1] ?? salesHospSign,
        영업서명_담당자: salesSign.split(',')[1] ?? salesSign,
        영업담당자명: salesName, 영업담당자연락처: salesPhone,
        연동방식: linkMethod,
        D1: linkMethod === 'D1' ? d1Devices : null,
        D2: linkMethod === 'D2' ? { PACS제조사: d2PacsMaker, PACS버전: d2PacsVer, PACSIP: d2PacsIp, PACSAE: d2PacsAe,
              HIS연동: d2HisLink, HIS제조사: d2HisMaker, 인터넷: d2Internet, 방화벽: d2Firewall, 설치환경: d2EnvType, 특이사항: d2Note } : null,
        E: { 교육검토: eNeed, 인원: eCount, 장소: ePlace, 일정: eDate, 담당자: eName, 연락처: ePhone, 방식: eMethod },
        TE서명_병원: teHospSign.split(',')[1] ?? teHospSign,
        TE서명_담당자: teSign.split(',')[1] ?? teSign,
        TE담당자명: user?.name || '',
        TE이메일: user?.email || '',
      };

      const createRes = await callGAS('createInstallRequest', payload);
      if (!createRes.success) throw new Error(createRes.error);

      setMsg('PDF 생성 중...');
      const pdfRes = await callGAS('generateInstallRequestPDF', { rowIndex: createRes.data.rowIndex });
      if (!pdfRes.success) throw new Error(pdfRes.error);

      setPdfUrl(pdfRes.data.pdfUrl);
      setStep(6);
      setMsg('');
    } catch (err: any) {
      setMsg('❌ 오류: ' + err.message);
    } finally { setLoading(false); }
  }, [aHospital, aDate, aAddress, aDept, aContact, aPhone, aEmail,
      bContractName, bContractPos, bContractPhone, bContractEmail,
      bNecaName, bNecaPhone, bNcctName, bNcctDept,
      bConsentName, bConsentPhone, bConsentCount,
      bBillName, bBillPhone, bContractRecvName, bContractRecvPhone,
      cServerLoc, cItDept, cItName, cItPhone, cNetName, cNetPhone,
      cPacsName, cPacsPhone, cSchedule, cTimeSlot, cEntrance,
      cPreApproval, cAlarm, cAlarmPhone, cAlarmMethod,
      salesHospSign, salesSign, salesName, salesPhone,
      linkMethod, d1Devices,
      d2PacsMaker, d2PacsVer, d2PacsIp, d2PacsAe,
      d2HisLink, d2HisMaker, d2Internet, d2Firewall, d2EnvType, d2Note,
      eNeed, eCount, ePlace, eDate, eName, ePhone, eMethod,
      teHospSign, teSign, user]);

  const STEP_LABELS = ['영업 기본정보', '영업 서명', 'TE 장비/네트워크', 'TE 교육', 'TE 서명'];

  return (
    <div className="min-h-screen bg-gray-50">
      <ConfirmModal open={showConfirm} onOk={doSubmit} onCancel={() => setShowConfirm(false)}
        hospital={aHospital} date={aDate} />

      {/* 헤더 */}
      <div className="bg-slate-800 text-white px-4 py-4 sticky top-0 z-10 shadow">
        <h1 className="text-base font-bold">📋 설치환경 정보요청서</h1>
        <p className="text-xs text-slate-400 mt-0.5">Installation Environment Information Request</p>
        {step < 6 && (
          <>
            <div className="flex gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map(s => (
                <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-white' : 'bg-white/25'}`} />
              ))}
            </div>
            <p className="text-[10px] mt-0.5 text-white/60">{STEP_LABELS[step - 1]}</p>
          </>
        )}
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">

        {/* ════ 영업 완료 화면 ════ */}
        {salesSuccess && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl">✅</span>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">TE팀에 전달 완료!</p>
              <p className="text-sm text-muted-foreground mt-1">{aHospital} — 설치환경 정보요청서</p>
              <p className="text-xs text-muted-foreground mt-0.5">TE팀이 D+E 항목을 이어서 작성합니다</p>
            </div>
          </div>
        )}

        {/* ════ TE 대기 목록 (영업 완료 → TE 이어받기) ════ */}
        {!isSales && step === 1 && !salesSuccess && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-amber-800">
                {drafts.length > 0 ? `📋 영업 완료 — TE 작성 대기 중 (${drafts.length}건)` : '📋 TE 작성 대기 중인 요청서 없음'}
              </p>
              {drafts.length > 0 && (
                <button type="button" onClick={() => setShowDraftList(v => !v)}
                  className="text-xs text-amber-600 underline">{showDraftList ? '접기' : '펼치기'}</button>
              )}
            </div>

            {/* 대기 목록이 있을 때 */}
            {drafts.length > 0 && showDraftList && (
              <div className="space-y-2 mt-1">
                {(drafts as any[]).map((d: any) => (
                  <button key={d.rowIndex} type="button"
                    onClick={() => handleSelectDraft(d)}
                    className="w-full text-left bg-white rounded-xl border border-amber-200 px-3 py-2.5 hover:border-amber-400 transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{d.병원명}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.제품명} · 영업: {d.영업담당자} · {d.작성일}
                        </p>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">이어서 작성 →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 대기 목록 없을 때 직접 작성 안내 */}
            {drafts.length === 0 && (
              <div className="mt-2 space-y-3">
                <p className="text-xs text-amber-700">영업팀이 아직 작성한 요청서가 없습니다. 직접 작성할 수 있습니다.</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-amber-800 mb-1 block">병원명 *</label>
                    <input className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm bg-white"
                      placeholder="병원명 입력" value={aHospital}
                      onChange={e => setAHospital(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-amber-800 mb-1 block">제품명</label>
                      <PickerDropdown label="" value={prodName} onChange={setProdName}
                        options={HEURON_PRODUCTS} placeholder="제품 선택" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-amber-800 mb-1 block">버전</label>
                      <input className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm bg-white"
                        placeholder="v2.0.0" value={prodVer}
                        onChange={e => setProdVer(e.target.value)} />
                    </div>
                  </div>
                </div>
                <button type="button"
                  onClick={() => { if (!aHospital) { alert('병원명을 입력하세요'); return; } setStep(3); }}
                  className="w-full py-3 rounded-xl bg-blue-700 text-white font-bold text-sm">
                  📝 D/E 항목 직접 작성 시작 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════ STEP 1: 영업 - A + B + C ════ (영업 담당자만 표시) */}
        {step === 1 && isSales && (
          <div className="space-y-3">
            {/* 📦 제품 정보 (제품현황_국내 자동 등록) */}
            <SectionCard title="📦 제품 정보" badge="자동등록">
              <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                ✅ 저장 완료 시 <strong>🏥 제품현황_국내</strong> 시트에 자동으로 행이 추가됩니다
              </p>
              <PickerDropdown label="도입 제품명 *" value={prodName} onChange={setProdName}
                options={HEURON_PRODUCTS} placeholder="제품 선택" />
              <Field label="버전" value={prodVer} onChange={setProdVer} placeholder="예) v2.3.1" />
              <div className="grid grid-cols-2 gap-2">
                <ToggleGroup label="설치 유형" value={installType} onChange={setInstallType} options={INSTALL_TYPES} />
                <ToggleGroup label="계약 유형" value={contractType} onChange={setContractType} options={CONTRACT_TYPES} />
              </div>

              {/* ── 라이선스 기간 ─────────────────────────── */}
              <div className="border-t border-gray-100 pt-3">
                <label className="block text-xs text-gray-500 mb-1.5">라이선스 기간</label>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">기준 시작일</label>
                    <input type="date" value={licenseStartDate}
                      onChange={e => setLicenseStartDate(e.target.value)}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1.5">사용 기간 (년)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[1,2,3,4,5,6,7,8,9,10].map(y => (
                        <button key={y} type="button"
                          onClick={() => setLicenseYears(String(y))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                            ${licenseYears === String(y)
                              ? 'bg-blue-700 text-white border-blue-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                          {y}년
                        </button>
                      ))}
                    </div>
                    {licenseStartDate && licenseYears && (
                      <p className="text-[10px] text-blue-600 mt-1.5">
                        📅 {licenseStartDate} ~ {
                          (() => {
                            const d = new Date(licenseStartDate);
                            d.setFullYear(d.getFullYear() + Number(licenseYears));
                            d.setDate(d.getDate() - 1);
                            return d.toISOString().slice(0, 10);
                          })()
                        } ({licenseYears}년)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 자체 서버 구비 / TE 사전 검토 ────────── */}
              <div className="border-t border-gray-100 pt-3 space-y-3">
                {/* 자체 서버 구비 */}
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">🖥️ 자체 서버 구비</p>
                  <p className="text-[10px] text-gray-400 mb-1.5">병원 자체 서버 구비(확인 완료)</p>
                  <div className="flex gap-2">
                    {(['Y', 'N'] as const).map(v => (
                      <button key={v} type="button"
                        onClick={() => setHasOwnServer(v)}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition
                          ${hasOwnServer === v
                            ? v === 'Y' ? 'bg-green-500 text-white border-green-500'
                                        : 'bg-red-400 text-white border-red-400'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {v === 'Y' ? '✅ Y' : '❌ N'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* TE 사전 검토 */}
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">🔍 내부 부서 사전 검토</p>
                  <p className="text-[10px] text-gray-400 mb-1.5">TE팀의 사전 타당성 검토 (납품/설치 환경 적합 여부)</p>
                  <div className="flex gap-2">
                    {(['Y', 'N'] as const).map(v => (
                      <button key={v} type="button"
                        onClick={() => setTePreReview(v)}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition
                          ${tePreReview === v
                            ? v === 'Y' ? 'bg-green-500 text-white border-green-500'
                                        : 'bg-red-400 text-white border-red-400'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {v === 'Y' ? '✅ Y' : '❌ N'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 📋 작성 안내 (앱에서만 표시, PDF 미포함) */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-amber-800">📋 작성 안내</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                아래 정보는 Heuron 솔루션의 원활한 설치 및 연동을 위해 반드시 필요합니다.<br />
                누락 항목 발생 시 설치 일정이 지연될 수 있으므로 모든 항목을 사전에 확인 후 작성해 주십시오.
              </p>
              <div className="text-xs text-amber-700 space-y-0.5">
                <p>• 계약 문의: Heuron KBD 담당자에게 연락해 주십시오.</p>
                <p>• 기술 문의: Heuron TE 담당자에게 연락해 주십시오.</p>
              </div>
            </div>

            {/* A. 병원 기본 정보 */}
            <SectionCard title="A. 병원 기본 정보" badge="영업">
              <div>
                <label className="block text-xs text-gray-500 mb-1">병원명 <span className="text-red-500">*</span></label>
                <HospitalInput value={aHospital} onChange={v => { setAHospital(v); }}
                  onSelect={handleHospitalSelect} hospitals={hospitals} />
              </div>
              <Field label="작성일" value={aDate} onChange={setADate} type="date" />
              <Field label="주소" value={aAddress} onChange={setAAddress} placeholder="도로명 주소" />
              <Field label="담당 부서" value={aDept} onChange={setADept} placeholder="부서명" />
              <Field label="담당자 성명" value={aContact} onChange={setAContact} placeholder="성명" />
              <TwoField label1="연락처" val1={aPhone} set1={setAPhone} ph1="02-0000-0000"
                        label2="이메일" val2={aEmail} set2={setAEmail} ph2="contact@hospital.com" type2="email" />
            </SectionCard>

            {/* B. 계약 및 행정 정보 */}
            <SectionCard title="B. 계약 및 행정 정보" badge="영업">
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">계약 관련 담당자 정보를 입력해 주세요</p>
              <TwoField label1="계약 담당자 성명" val1={bContractName} set1={setBContractName} ph1="성명"
                        label2="직위 / 부서" val2={bContractPos} set2={setBContractPos} ph2="직위" />
              <TwoField label1="계약 담당자 연락처" val1={bContractPhone} set1={setBContractPhone} ph1="연락처"
                        label2="이메일" val2={bContractEmail} set2={setBContractEmail} ph2="이메일" type2="email" />
              {/* NECA/NCCT: Heuron SCS 또는 Stroke 일 때만 표시 */}
              {prodName.toLowerCase().includes('scs') && (
                <>
                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-xs font-medium text-gray-600 mb-2">NECA 신청서 작성 담당</p>
                    <p className="text-[10px] text-blue-500 mb-1.5">※ Heuron SCS 전용 항목</p>
                    <TwoField label1="성명" val1={bNecaName} set1={setBNecaName} ph1="성명"
                              label2="연락처" val2={bNecaPhone} set2={setBNecaPhone} ph2="연락처" />
                  </div>
                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-xs font-medium text-gray-600 mb-2">NCCT 코드 생성 담당</p>
                    <TwoField label1="성명" val1={bNcctName} set1={setBNcctName} ph1="성명"
                              label2="부서" val2={bNcctDept} set2={setBNcctDept} ph2="부서" />
                  </div>
                </>
              )}
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-gray-600 mb-2">동의서 등록 담당</p>
                <TwoField label1="성명" val1={bConsentName} set1={setBConsentName} ph1="성명"
                          label2="연락처" val2={bConsentPhone} set2={setBConsentPhone} ph2="연락처" />
                <Field label="동의서 작성 대상 인원" value={bConsentCount} onChange={setBConsentCount}
                  placeholder="예) 응급의사 5명 / 간호사 3명 / 응급구조사 2명" />
              </div>
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-gray-600 mb-2">건수확인 및 계산서 담당</p>
                <TwoField label1="성명" val1={bBillName} set1={setBBillName} ph1="성명"
                          label2="연락처" val2={bBillPhone} set2={setBBillPhone} ph2="연락처" />
              </div>
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-gray-600 mb-2">계약서 수령 담당</p>
                <TwoField label1="성명" val1={bContractRecvName} set1={setBContractRecvName} ph1="성명"
                          label2="연락처" val2={bContractRecvPhone} set2={setBContractRecvPhone} ph2="연락처" />
              </div>
            </SectionCard>

            {/* C. 설치 장소 및 운영 환경 */}
            <SectionCard title="C. 설치 장소 및 운영 환경" badge="영업">
              <Field label="서버 설치 위치" value={cServerLoc} onChange={setCServerLoc} placeholder="예) 전산실 3층, CT실 내부" />
              <Field label="담당 부서" value={cItDept} onChange={setCItDept} placeholder="부서명" />
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-gray-600 mb-2">전산 담당자</p>
                <TwoField label1="성명" val1={cItName} set1={setCItName} ph1="성명"
                          label2="연락처" val2={cItPhone} set2={setCItPhone} ph2="연락처" />
              </div>
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-gray-600 mb-2">네트워크 담당자</p>
                <TwoField label1="성명" val1={cNetName} set1={setCNetName} ph1="성명"
                          label2="연락처" val2={cNetPhone} set2={setCNetPhone} ph2="연락처" />
              </div>
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-gray-600 mb-2">PACS 담당자</p>
                <TwoField label1="성명" val1={cPacsName} set1={setCPacsName} ph1="성명"
                          label2="연락처" val2={cPacsPhone} set2={setCPacsPhone} ph2="연락처" />
              </div>
              <div className="border-t border-gray-100 pt-2">
                <Field label="희망 설치 일정" value={cSchedule} onChange={setCSchedule} placeholder="예) 2026-07-01 ~ 2026-07-03" />
                <Field label="가능 시간대" value={cTimeSlot} onChange={setCTimeSlot} placeholder="예) 오후 업무 후" />
                <Field label="설치 시 출입 절차" value={cEntrance} onChange={setCEntrance} placeholder="예) 안내데스크 방문증 수령" />
              </div>
              <ToggleGroup label="사전 신청 필요 여부" value={cPreApproval}
                onChange={setCPreApproval} options={['필요', '불필요']} />
              <ToggleGroup label="알람 서비스 사용 여부" value={cAlarm}
                onChange={setCAlarm} options={['사용', '미사용']} />
              {cAlarm === '사용' && (
                <>
                  <Field label="알람 수신 연락처" value={cAlarmPhone} onChange={setCAlarmPhone} placeholder="010-0000-0000" type="tel" />
                  <ToggleGroup label="알람 수신 방법" value={cAlarmMethod}
                    onChange={setCAlarmMethod} options={['문자', '앱', '기타']} />
                </>
              )}
            </SectionCard>

            <button onClick={() => { if (!aHospital) { setMsg('❌ 병원명을 입력하세요'); return; } setMsg(''); setStep(2); }}
              className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700">
              다음 → 영업 서명
            </button>
            {msg && <p className="text-sm text-center text-red-500">{msg}</p>}
          </div>
        )}

        {/* ════ STEP 2: 영업 서명 ════ (영업 담당자만 표시) */}
        {step === 2 && isSales && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <p className="font-bold text-slate-800">{aHospital}</p>
              <p className="text-slate-500 text-xs mt-0.5">작성일: {aDate}</p>
            </div>
            <SectionCard title="작성자 확인 (병원)">
              <p className="text-xs text-gray-400">병원 담당자에게 폰을 건네 서명받으세요</p>
              <SignPad label={`병원명: ${aHospital} · 성명: ${aContact || '담당자'}`}
                onSave={setSalesHospSign} onClear={() => setSalesHospSign('')} saved={!!salesHospSign} />
            </SectionCard>
            <SectionCard title="Heuron 영업 담당자">
              <TwoField label1="담당자 성명" val1={salesName} set1={setSalesName} ph1="성명"
                        label2="연락처" val2={salesPhone} set2={setSalesPhone} ph2="연락처" />
              <SignPad label={`영업 담당자: ${salesName || '휴런'}`}
                onSave={setSalesSign} onClear={() => setSalesSign('')} saved={!!salesSign} />
            </SectionCard>
            {msg && <p className="text-sm text-center text-red-500">{msg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm">← 이전</button>
              <button onClick={async () => {
                if (!salesHospSign || !salesSign) { setMsg('❌ 두 서명을 모두 완료하세요'); return; }
                if (isSales) {
                  // 영업 담당자: 저장 후 완료 (TE에 전달)
                  setLoading(true); setMsg('저장 중...');
                  try {
                    const draftPayload = {
                      제품명: prodName, 버전: prodVer, 설치유형: installType, 계약유형: contractType,
                      라이선스기준일: licenseStartDate, 라이선스기간: licenseYears ? `${licenseYears}년` : '',
                      자체서버구비: hasOwnServer, TE사전검토: tePreReview,
                      영업담당자명: salesName, 영업이메일: user?.email || '',
                      A: { 병원명: aHospital, 작성일: aDate, 주소: aAddress, 담당부서: aDept, 담당자: aContact, 연락처: aPhone, 이메일: aEmail },
                      B: { 계약담당자: bContractName, 직위부서: bContractPos, 연락처: bContractPhone, 이메일: bContractEmail,
                           NECA담당자: bNecaName, NECA연락처: bNecaPhone, NCCT담당자: bNcctName, NCCT부서: bNcctDept,
                           동의서담당자: bConsentName, 동의서연락처: bConsentPhone, 동의서인원: bConsentCount,
                           계산서담당자: bBillName, 계산서연락처: bBillPhone,
                           계약서담당자: bContractRecvName, 계약서연락처: bContractRecvPhone },
                      C: { 서버위치: cServerLoc, IT부서: cItDept, IT담당자: cItName, IT연락처: cItPhone,
                           네트워크담당자: cNetName, 네트워크연락처: cNetPhone, PACS담당자: cPacsName, PACS연락처: cPacsPhone,
                           설치일정: cSchedule, 가능시간: cTimeSlot, 출입절차: cEntrance,
                           사전신청: cPreApproval, 알람서비스: cAlarm, 알람연락처: cAlarmPhone, 알람수신방법: cAlarmMethod },
                      영업서명_병원: salesHospSign, 영업서명_담당자: salesSign,
                    };
                    const res = await callGAS('saveInstallDraft', draftPayload);
                    if (!res.success) throw new Error(res.error);
                    setSalesSuccess(true);
                  } catch (e: any) {
                    setMsg('❌ 저장 실패: ' + e.message);
                  } finally { setLoading(false); }
                } else {
                  setMsg(''); setStep(3);
                }
              }} disabled={loading} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold text-sm disabled:opacity-50">
                {isSales ? (loading ? '저장 중...' : '✅ TE에 전달') : '다음 → TE 작성'}
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 3: TE - 연동방식 + D ════ */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-800">✅ 영업 서명 완료 — TE팀 작성 단계</p>
              <p className="text-xs text-blue-600 mt-0.5">{aHospital}</p>
            </div>

            {/* 연동방식 선택 */}
            <SectionCard title="연동 방식 선택" badge="TE">
              <p className="text-xs text-gray-500">※ 연동 방식에 따라 D-1 또는 D-2 중 하나만 작성합니다.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setLinkMethod('D1')}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition
                    ${linkMethod === 'D1' ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  <div className="text-base">🔬</div>
                  <div>D-1</div>
                  <div className="text-xs font-normal mt-0.5">CT/MRI 직접 연동</div>
                </button>
                <button type="button" onClick={() => setLinkMethod('D2')}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition
                    ${linkMethod === 'D2' ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  <div className="text-base">🖥️</div>
                  <div>D-2</div>
                  <div className="text-xs font-normal mt-0.5">PACS 경유 연동</div>
                </button>
              </div>
            </SectionCard>

            {/* D-1 */}
            {linkMethod === 'D1' && (
              <SectionCard title="D-1. CT/MRI 장비 정보" badge="TE">
                <p className="text-xs text-gray-400">연동 대상 장비를 전체 기재해 주세요</p>
                {d1Devices.map((d, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
                    <p className="text-xs font-bold text-gray-600">CT / MRI {['①', '②', '③'][i]}</p>
                    <PickerDropdown label="제조사" value={d.maker}
                      onChange={v => updateD1(i, 'maker', v)} options={CT_MAKERS} placeholder="제조사 선택" />
                    <TwoField label1="모델명" val1={d.model} set1={v => updateD1(i, 'model', v)} ph1="모델명"
                              label2="설치 연도" val2={d.year} set2={v => updateD1(i, 'year', v)} ph2="YYYY" />
                    <Field label="설치 위치 (CT실명)" value={d.location}
                      onChange={v => updateD1(i, 'location', v)} placeholder="예) 응급CT실, 1번 CT실" />
                    <TwoField label1="AE Title" val1={d.aeTitle} set1={v => updateD1(i, 'aeTitle', v)} ph1="AE Title"
                              label2="IP 주소" val2={d.ip} set2={v => updateD1(i, 'ip', v)} ph2="192.168.x.x" />
                    <Field label="비고" value={d.note} onChange={v => updateD1(i, 'note', v)} placeholder="장비 관련 특이사항" />
                  </div>
                ))}
              </SectionCard>
            )}

            {/* D-2 */}
            {linkMethod === 'D2' && (
              <SectionCard title="D-2. PACS 및 네트워크 환경" badge="TE">
                <PickerDropdown label="PACS 제조사" value={d2PacsMaker}
                  onChange={setD2PacsMaker} options={PACS_MAKERS} placeholder="예) 인피니트, 뷰렉스 등" />
                <TwoField label1="PACS 버전" val1={d2PacsVer} set1={setD2PacsVer} ph1="버전"
                          label2="PACS IP 주소" val2={d2PacsIp} set2={setD2PacsIp} ph2="192.168.x.x" />
                <Field label="PACS AE Title" value={d2PacsAe} onChange={setD2PacsAe} placeholder="AE Title" />
                <ToggleGroup label="HIS/EMR 연동 여부" value={d2HisLink}
                  onChange={setD2HisLink} options={['연동 O', '연동 X']} />
                {d2HisLink === '연동 O' && (
                  <Field label="HIS/EMR 제조사" value={d2HisMaker} onChange={setD2HisMaker} placeholder="제조사명" />
                )}
                <ToggleGroup label="외부 인터넷망" value={d2Internet}
                  onChange={setD2Internet} options={['가능', '불가능']} />
                <ToggleGroup label="방화벽 정책" value={d2Firewall}
                  onChange={setD2Firewall} options={['있음', '없음']} />
                <ToggleGroup label="설치 환경" value={d2EnvType}
                  onChange={setD2EnvType} options={['On-premise', 'Cloud']} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">특이사항</label>
                  <textarea value={d2Note} onChange={e => setD2Note(e.target.value)}
                    placeholder="보안정책, 포트 제한, VPN 등" rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500 bg-white resize-none" />
                </div>
              </SectionCard>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm">← 이전</button>
              <button onClick={() => setStep(4)} className="flex-1 py-3 rounded-xl bg-blue-700 text-white font-bold text-sm">다음 → 교육</button>
            </div>
          </div>
        )}

        {/* ════ STEP 4: TE - E (교육) ════ */}
        {step === 4 && (
          <div className="space-y-3">
            <SectionCard title="E. 교육 필요 확인 검토" badge="TE">
              <p className="text-xs text-gray-400">(PACS 연동 시 사용자 교육 불필요)</p>
              <ToggleGroup label="교육검토" value={eNeed} onChange={setENeed} options={['필요', '불필요']} />
              {eNeed === '필요' && (
                <>
                  <Field label="교육 대상 인원" value={eCount} onChange={setECount}
                    placeholder="예) 5명 (응급의사 / 간호사 / 방사선사)" />
                  <Field label="교육 장소" value={ePlace} onChange={setEPlace} placeholder="예) 강의실, 현장 등" />
                  <Field label="교육 희망 일정" value={eDate} onChange={setEDate} type="date" />
                  <TwoField label1="교육 담당 성명" val1={eName} set1={setEName} ph1="성명"
                            label2="연락처" val2={ePhone} set2={setEPhone} ph2="연락처" />
                  <ToggleGroup label="교육 방식" value={eMethod} onChange={setEMethod} options={['집체교육', '개별교육']} />
                </>
              )}
            </SectionCard>

            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm">← 이전</button>
              <button onClick={() => setStep(5)} className="flex-1 py-3 rounded-xl bg-blue-700 text-white font-bold text-sm">다음 → TE 서명</button>
            </div>
          </div>
        )}

        {/* ════ STEP 5: TE 서명 ════ */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
              <p className="font-bold text-gray-800">{aHospital}</p>
              <p className="text-gray-500 text-xs">연동방식: {linkMethod} · 교육: {eNeed}</p>
              <p className="text-gray-500 text-xs">TE 담당: {user?.name}</p>
            </div>

            <SectionCard title="작성자 확인 (병원)">
              <p className="text-xs text-gray-400">병원 담당자에게 폰을 건네 서명받으세요</p>
              <SignPad label={`병원명: ${aHospital} · 성명: ${aContact || '담당자'}`}
                onSave={setTeHospSign} onClear={() => setTeHospSign('')} saved={!!teHospSign} />
            </SectionCard>

            <SectionCard title="Heuron TE 담당자">
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <p className="text-gray-600">담당자: <span className="font-medium">{user?.name}</span></p>
                <p className="text-gray-400 text-xs">{user?.email}</p>
              </div>
              <SignPad label={`TE 담당자: ${user?.name || '휴런 TE'}`}
                onSave={setTeSign} onClear={() => setTeSign('')} saved={!!teSign} />
            </SectionCard>

            {msg && <p className={`text-sm text-center font-medium ${msg.startsWith('❌') ? 'text-red-500' : 'text-blue-600'}`}>{msg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStep(4)} disabled={loading}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm disabled:opacity-40">
                ← 이전
              </button>
              <button onClick={() => {
                if (!teHospSign || !teSign) { setMsg('❌ 두 서명을 모두 완료하세요'); return; }
                setMsg(''); setShowConfirm(true);
              }} disabled={loading || !teHospSign || !teSign}
                className="flex-1 py-3 rounded-xl bg-blue-700 text-white font-bold text-sm disabled:opacity-40 hover:bg-blue-800">
                {loading ? '처리 중...' : '✅ 저장 및 PDF 생성'}
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 6: 완료 ════ */}
        {step === 6 && (
          <div className="text-center space-y-5 py-8">
            <div className="text-6xl">✅</div>
            <h2 className="text-xl font-bold text-gray-800">설치환경 정보요청서 완료!</h2>
            <div className="space-y-1">
              <p className="text-gray-600 font-medium">{aHospital}</p>
              <p className="text-sm text-gray-400">{aDate}</p>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                연동방식 {linkMethod}
              </span>
            </div>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block px-6 py-3 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700">
                📄 PDF 보기 / 다운로드
              </a>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button onClick={() => window.history.back()}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm">
                ← 돌아가기
              </button>
              <button onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold">
                + 새로 작성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
