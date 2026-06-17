// ============================================================
// HeuLing — 영수증 관리 페이지 v11
// F: 결제수단(법인카드(일반)/법인카드(과제)/개인카드)
// G: 하위분류  H: 세부분류  I: 세부메모
// ============================================================
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, ChevronLeft, ChevronRight, ChevronDown,
  Download, FileImage, FilePlus, ImageIcon, Loader2,
  Trash2, X, CreditCard, RefreshCw,
} from 'lucide-react';
import { api } from '@/api/gasClient';
import { useAuth } from '@/hooks/useAuth';
import { TopBar, BottomNav, PageWrapper } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import PhotoReplacer from '@/components/PhotoReplacer';

// ─── 결제수단 3분류 ──────────────────────────────────────────
const PAY_METHODS = [
  { key: '법인카드(일반)', label: '법인카드\n(일반)', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/40', badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  { key: '법인카드(과제)', label: '법인카드\n(과제)', color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/40', badge: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' },
  { key: '개인카드',       label: '개인카드',         color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40', badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30' },
] as const;
type PayKey = typeof PAY_METHODS[number]['key'];

// 구버전 '법인카드' 데이터를 '법인카드(일반)'으로 정규화
function normalizeCategory(cat: string): string {
  if (!cat) return '법인카드(일반)';
  if (cat === '법인카드') return '법인카드(일반)';
  return cat;
}

function getPayMethod(key: string) {
  return PAY_METHODS.find(p => p.key === normalizeCategory(key)) ?? PAY_METHODS[0];
}

// ─── 하위분류 / 세부분류 정의 ──────────────────────────────────
interface SubCatConfig { key: string; emoji: string; color: string; details: string[]; }

const SUBCAT_CONFIG: SubCatConfig[] = [
  { key: '접대비',              emoji: '🍽️', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',   details: [] },
  { key: '회의비',              emoji: '💬', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',   details: [] },
  { key: '여비교통비',           emoji: '✈️', color: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30',      details: [] },
  { key: '사무용품 및 비품 구매', emoji: '🖊️', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30', details: ['서버 소모품', '사무용품', '기타'] },
  { key: '복리후생비',           emoji: '🎁', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30', details: ['임직원 식대', '간식비'] },
  { key: '차량유지비',           emoji: '🚗', color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30', details: ['톨게이트비', '주차비', '주유비', '수리비'] },
];

function getSubCat(key: string): SubCatConfig {
  return SUBCAT_CONFIG.find(c => c.key === key) ?? SUBCAT_CONFIG[0];
}

// ─── 타입 ───────────────────────────────────────────────────
type ReceiptItem = {
  date: string; amount: string; memo: string;
  category: string; subCat1: string; subCat2: string; detailMemo: string;
  fileId: string; fileUrl: string; fileName: string; rowIndex: number;
};

// ─── 날짜 헬퍼 ─────────────────────────────────────────────
function toYearMonth(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function formatKorean(ym: string) { const [y,m]=ym.split('-'); return `${y}년 ${Number(m)}월`; }
function formatDate(s: string) {
  const d = new Date(s+'T00:00:00');
  return `${d.getMonth()+1}/${d.getDate()} (${['일','월','화','수','목','금','토'][d.getDay()]})`;
}
function groupByDate(items: ReceiptItem[]) {
  const map = new Map<string,ReceiptItem[]>();
  for (const r of items) { const k=r.date.slice(0,10); if(!map.has(k)) map.set(k,[]); map.get(k)!.push(r); }
  return [...map.entries()].sort(([a],[b])=>a.localeCompare(b));
}

// ─── 등록 바텀시트 ────────────────────────────────────────────
function AddReceiptSheet({ open, onClose, onSaved }: { open:boolean; onClose:()=>void; onSaved:()=>void }) {
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile]           = useState<File|null>(null);
  const [preview, setPreview]     = useState('');
  const [date, setDate]           = useState(new Date().toISOString().slice(0,10));
  const [amount, setAmount]       = useState('');
  const [payMethod, setPayMethod] = useState<PayKey>('법인카드(일반)');
  const [subCat1, setSubCat1]     = useState('');
  const [subCat2, setSubCat2]     = useState('');
  const [departure, setDeparture] = useState('');
  const [destination, setDest]    = useState('');
  const [tripType, setTripType]   = useState<'왕복'|'편도'>('왕복');
  const [km, setKm]               = useState('');
  const [remarks, setRemarks]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const cfg = getSubCat(subCat1);
  const isTravel = subCat1 === '여비교통비';
  const isGas    = subCat2 === '주유비';
  const pm       = getPayMethod(payMethod);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return;
    setFile(f); setPreview(URL.createObjectURL(f));
    if(cameraRef.current) cameraRef.current.value='';
    if(galleryRef.current) galleryRef.current.value='';
  };
  const changeSubCat1 = (v: string) => { setSubCat1(v); setSubCat2(''); setKm(''); };

  const buildDetailMemo = () => {
    const parts: string[] = [];
    if (isTravel && (departure || destination)) parts.push(`${departure||'?'} → ${destination||'?'} (${tripType})`);
    if (isGas && km) parts.push(`${km}km`);
    if (remarks) parts.push(remarks);
    return parts.join(' | ');
  };

  const handleSave = async () => {
    if (!file)    { setErr('사진을 선택해 주세요.'); return; }
    if (!date)    { setErr('날짜를 입력해 주세요.'); return; }
    if (!subCat1) { setErr('하위분류를 선택해 주세요.'); return; }
    if (cfg.details.length > 0 && !subCat2) { setErr('세부분류를 선택해 주세요.'); return; }
    if (isTravel && (!departure.trim()||!destination.trim())) { setErr('출발지·목적지를 입력해 주세요.'); return; }
    setErr(''); setSaving(true);
    try {
      const res = await api.uploadReceipt(date, amount, remarks, file, payMethod, subCat1, subCat2, buildDetailMemo());
      if (!res.success) throw new Error(String(res.error));
      onSaved(); onClose(); reset();
    } catch(e) { setErr((e as Error).message||'저장 실패'); }
    finally { setSaving(false); }
  };

  const reset = () => {
    setFile(null); setPreview(''); setAmount(''); setPayMethod('법인카드(일반)');
    setSubCat1(''); setSubCat2(''); setDeparture(''); setDest('');
    setTripType('왕복'); setKm(''); setRemarks(''); setErr('');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="dim" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/50 z-40" onClick={()=>{onClose();reset();}} />
          <motion.div key="sheet"
            initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
            transition={{type:'spring',damping:28,stiffness:300}}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl max-h-[94vh] flex flex-col"
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-1 shrink-0"/>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <h2 className="text-base font-bold">🧾 영수증 등록</h2>
              <button onClick={()=>{onClose();reset();}} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4"/>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

              {/* ── 결제수단 3분류 ── */}
              <div className="space-y-1.5">
                <Label>결제수단 <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAY_METHODS.map(m => (
                    <button key={m.key} type="button" onClick={()=>setPayMethod(m.key)}
                      className={cn('flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-all whitespace-pre-line',
                        payMethod===m.key ? m.color : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30'
                      )}>
                      <CreditCard className="w-4 h-4"/>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 하위분류 ── */}
              <div className="space-y-1.5">
                <Label>하위분류 <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {SUBCAT_CONFIG.map(c => (
                    <button key={c.key} type="button" onClick={()=>changeSubCat1(c.key)}
                      className={cn('flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-all',
                        subCat1===c.key ? c.color+' border-current' : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30'
                      )}>
                      <span className="text-base">{c.emoji}</span>
                      <span className="leading-tight text-center">{c.key}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 세부분류 ── */}
              {subCat1 && cfg.details.length > 0 && (
                <div className="space-y-1.5">
                  <Label>세부분류 <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-3 gap-2">
                    {cfg.details.map(d => (
                      <button key={d} type="button" onClick={()=>{setSubCat2(d); setKm('');}}
                        className={cn('py-2 rounded-xl border text-xs font-medium transition-all',
                          subCat2===d ? cfg.color+' border-current' : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30'
                        )}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 여비교통비 전용 ── */}
              {isTravel && (
                <div className="space-y-3 p-3 bg-sky-500/5 rounded-xl border border-sky-500/20">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">출발지 <span className="text-destructive">*</span></Label>
                      <Input placeholder="예: 서울 본사" value={departure} onChange={e=>setDeparture(e.target.value)} className="h-9 text-sm"/>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">목적지 <span className="text-destructive">*</span></Label>
                      <Input placeholder="예: 부산 대학병원" value={destination} onChange={e=>setDest(e.target.value)} className="h-9 text-sm"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['왕복','편도'] as const).map(t=>(
                      <button key={t} type="button" onClick={()=>setTripType(t)}
                        className={cn('py-2 rounded-xl border text-xs font-semibold transition-all',
                          tripType===t ? 'bg-sky-500/15 text-sky-700 border-sky-500/40' : 'bg-muted/40 border-border text-muted-foreground'
                        )}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 주유비 km ── */}
              {isGas && (
                <div className="space-y-1.5">
                  <Label>주행거리</Label>
                  <div className="relative">
                    <Input placeholder="0" inputMode="numeric" value={km}
                      onChange={e=>setKm(e.target.value.replace(/[^0-9.]/g,''))} className="pr-10"/>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">km</span>
                  </div>
                </div>
              )}

              {/* ── 사진 ── */}
              {preview ? (
                <div className="relative w-full aspect-[3/2] rounded-2xl overflow-hidden">
                  <img src={preview} alt="영수증" className="w-full h-full object-cover"/>
                  <div className="absolute bottom-2 right-2 flex gap-1.5">
                    <button type="button" onClick={()=>cameraRef.current?.click()} className="bg-black/60 rounded-full px-2 py-1 text-[10px] text-white flex items-center gap-1"><Camera className="w-3 h-3"/>재촬영</button>
                    <button type="button" onClick={()=>galleryRef.current?.click()} className="bg-black/60 rounded-full px-2 py-1 text-[10px] text-white flex items-center gap-1"><ImageIcon className="w-3 h-3"/>앨범</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-full aspect-[3/2] rounded-2xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2">
                    <Camera className="w-10 h-10 text-muted-foreground"/>
                    <p className="text-sm text-muted-foreground">아래 버튼으로 사진을 추가하세요</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={()=>cameraRef.current?.click()} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all"><Camera className="w-4 h-4 text-primary"/><span className="text-xs font-medium text-primary">카메라 촬영</span></button>
                    <button type="button" onClick={()=>galleryRef.current?.click()} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/50 hover:bg-muted active:scale-[0.98] transition-all"><ImageIcon className="w-4 h-4 text-muted-foreground"/><span className="text-xs font-medium text-muted-foreground">앨범 선택</span></button>
                  </div>
                </div>
              )}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile}/>
              <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={pickFile}/>

              {/* ── 날짜 / 금액 ── */}
              <div className="space-y-1.5">
                <Label>날짜 <span className="text-destructive">*</span></Label>
                <Input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <Label>금액</Label>
                <div className="relative">
                  <Input placeholder="0" inputMode="numeric" value={amount}
                    onChange={e=>setAmount(e.target.value.replace(/[^0-9]/g,''))} className="pr-8"/>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">원</span>
                </div>
              </div>

              {/* ── 비고 ── */}
              <div className="space-y-1.5">
                <Label>비고</Label>
                <Textarea placeholder="특이사항, 목적 등" value={remarks} onChange={e=>setRemarks(e.target.value)} rows={2} className="text-sm resize-none"/>
              </div>

              {err && <p className="text-xs text-destructive">{err}</p>}
              <Button className="w-full h-12 text-base font-semibold" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>저장 중...</> : '영수증 저장'}
              </Button>
              <div className="h-4"/>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── 영수증 카드 ────────────────────────────────────────────
function ReceiptCard({ item, onDelete, onReplacePhoto }: { item: ReceiptItem; onDelete: ()=>void; onReplacePhoto?: ()=>void }) {
  const [expanded, setExpanded] = useState(false);
  const subCfg = getSubCat(item.subCat1 || '');
  const payCfg = getPayMethod(normalizeCategory(item.category || ''));
  const hasDetail = !!item.detailMemo || !!item.memo;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3 cursor-pointer" onClick={()=>hasDetail && setExpanded(v=>!v)}>

        {/* 결제수단 뱃지 */}
        <span className={cn('flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0', payCfg.badge)}>
          <CreditCard className="w-2.5 h-2.5"/>{item.category||'법인카드(일반)'}
        </span>

        {/* 하위분류 뱃지 */}
        {item.subCat1 && (
          <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0', subCfg.color)}>
            {subCfg.emoji} {item.subCat1}{item.subCat2 ? ` > ${item.subCat2}` : ''}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {item.amount ? `${Number(item.amount).toLocaleString('ko-KR')}원` : '금액 미입력'}
          </p>
          {(item.detailMemo || item.memo) && (
            <p className="text-xs text-muted-foreground truncate">{item.detailMemo || item.memo}</p>
          )}
        </div>

        <button onClick={e=>{e.stopPropagation();onDelete();}} className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground"/>
        </button>
        {hasDetail && <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', expanded&&'rotate-180')}/>}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden">
            <div className="relative">
              <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                <img src={`https://drive.google.com/thumbnail?id=${item.fileId}&sz=w800`} alt="영수증 원본" className="w-full object-cover max-h-80"/>
              </a>
              {item.fileId && (
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onReplacePhoto?.(); }}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full px-2 py-1 text-[10px] flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3"/>사진 교체
                </button>
              )}
            </div>
            {(item.detailMemo || item.memo) && (
              <div className="px-3 py-2 bg-muted/30 border-t border-border/50">
                <p className="text-xs text-muted-foreground">{item.detailMemo || item.memo}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function ReceiptsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewMonth, setViewMonth] = useState(toYearMonth(new Date()));
  const [replaceTarget, setReplaceTarget] = useState<ReceiptItem | null>(null);
  const [addOpen, setAddOpen]     = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfResult, setPdfResult] = useState<{url:string;name:string}|null>(null);

  const prevMonth = () => { const [y,m]=viewMonth.split('-').map(Number); setViewMonth(toYearMonth(new Date(y,m-2,1))); setPdfResult(null); };
  const nextMonth = () => { const [y,m]=viewMonth.split('-').map(Number); setViewMonth(toYearMonth(new Date(y,m,1))); setPdfResult(null); };

  const { data: receipts, isLoading, refetch } = useQuery({
    queryKey: ['receipts', user?.email, viewMonth],
    queryFn: async () => { const res = await api.getReceipts(viewMonth); return (res.data||[]) as ReceiptItem[]; },
    enabled: !!user?.email, staleTime: 60*1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (rowIndex: number) => api.deleteReceipt(rowIndex),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['receipts'] }),
  });

  const handlePDF = async () => {
    setPdfGenerating(true);
    try {
      const res = await api.generateReceiptPDF(viewMonth);
      if (!res.success||!res.data) throw new Error(String(res.error)||'PDF 실패');
      setPdfResult({ url: res.data.pdfUrl, name: res.data.fileName });
    } catch(e) { alert((e as Error).message||'PDF 생성 실패'); }
    finally { setPdfGenerating(false); }
  };

  const grouped = groupByDate(receipts||[]);

  // 결제수단별 소계 (구버전 '법인카드' → '법인카드(일반)' 정규화 포함)
  const payTotals = PAY_METHODS.map(m => ({
    ...m,
    total: (receipts||[]).filter(r=>normalizeCategory(r.category)===m.key).reduce((s,r)=>s+(Number(r.amount)||0),0),
    count: (receipts||[]).filter(r=>normalizeCategory(r.category)===m.key).length,
  }));
  const grandTotal = payTotals.reduce((s,c)=>s+c.total,0);

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="🧾 영수증 관리" showBack/>
      <PageWrapper>
        <div className="px-4 pt-4 pb-32 space-y-4">

          {/* 월 선택 */}
          <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-3">
            <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ChevronLeft className="w-5 h-5"/></button>
            <div className="text-center">
              <p className="font-bold text-base">{formatKorean(viewMonth)}</p>
              {user?.name && <p className="text-xs text-muted-foreground">{user.name}</p>}
            </div>
            <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ChevronRight className="w-5 h-5"/></button>
          </div>

          {/* 결제수단별 소계 */}
          {!isLoading && (receipts||[]).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">이번 달 지출 내역</p>
                <p className="text-sm font-bold">총 {grandTotal.toLocaleString('ko-KR')}원</p>
              </div>
              <div className="space-y-2">
                {payTotals.map(c=>(
                  <div key={c.key} className="flex items-center justify-between">
                    <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border', c.badge)}>
                      <CreditCard className="w-3 h-3"/>{c.key}
                      <span className="opacity-60">({c.count}건)</span>
                    </span>
                    <span className="text-sm font-semibold">{c.total.toLocaleString('ko-KR')}원</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF */}
          <div className="space-y-2">
            <button onClick={handlePDF} disabled={pdfGenerating||(receipts?.length??0)===0}
              className={cn('w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all',
                (receipts?.length??0)>0 ? 'border-primary/40 bg-primary/5 hover:bg-primary/10 active:scale-[0.98]' : 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
              )}>
              <div className="flex items-center gap-2.5">
                {pdfGenerating ? <Loader2 className="w-5 h-5 text-primary animate-spin"/> : <Download className="w-5 h-5 text-primary"/>}
                <span className="text-sm font-semibold text-primary">{pdfGenerating?'PDF 생성 중...':`${formatKorean(viewMonth)} 영수증 PDF`}</span>
              </div>
              <span className="text-xs text-primary/60">B4 · 고해상도</span>
            </button>
            <AnimatePresence>
              {pdfResult && (
                <motion.a href={pdfResult.url} target="_blank" rel="noopener noreferrer"
                  initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  className="flex items-center gap-2 w-full px-4 py-3.5 rounded-xl border border-green-500/40 bg-green-500/5 hover:bg-green-500/10 transition-colors">
                  <FileImage className="w-5 h-5 text-green-600"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">PDF 생성 완료!</p>
                    <p className="text-[11px] text-muted-foreground truncate">{pdfResult.name}</p>
                  </div>
                </motion.a>
              )}
            </AnimatePresence>
          </div>

          {isLoading && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div>}

          {!isLoading && grouped.map(([dateStr, items])=>(
            <div key={dateStr} className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-muted-foreground">{formatDate(dateStr)}</p>
                <div className="flex-1 h-px bg-border"/>
                <p className="text-xs text-muted-foreground">{items.reduce((s,r)=>s+(Number(r.amount)||0),0).toLocaleString('ko-KR')}원</p>
              </div>
              {items.map(item=>(
                <ReceiptCard key={item.rowIndex} item={item} onDelete={()=>deleteMutation.mutate(item.rowIndex)} onReplacePhoto={()=>setReplaceTarget(item)}/>
              ))}
            </div>
          ))}

          {!isLoading && (receipts||[]).length===0 && (
            <div className="text-center py-12 space-y-2">
              <p className="text-4xl">🧾</p>
              <p className="text-sm text-muted-foreground">등록된 영수증이 없습니다.</p>
            </div>
          )}
        </div>
      </PageWrapper>

      <div className="fixed bottom-20 right-4 z-30">
        <Button onClick={()=>setAddOpen(true)} size="icon" className="w-14 h-14 rounded-full shadow-lg">
          <FilePlus className="w-6 h-6"/>
        </Button>
      </div>
      <BottomNav/>
      <AddReceiptSheet open={addOpen} onClose={()=>setAddOpen(false)} onSaved={()=>{ refetch(); queryClient.invalidateQueries({queryKey:['receipts']}); }}/>
      {replaceTarget && (
        <PhotoReplacer
          currentUrl={replaceTarget.fileUrl}
          currentFileId={replaceTarget.fileId}
          sheetType="receipt"
          rowIndex={replaceTarget.rowIndex}
          folderHint={`receipt_${user?.name ?? ''}_${viewMonth}`}
          onSuccess={(newUrl) => {
            queryClient.invalidateQueries({queryKey:['receipts']});
            setReplaceTarget(null);
          }}
          onClose={() => setReplaceTarget(null)}
        />
      )}
    </div>
  );
}
