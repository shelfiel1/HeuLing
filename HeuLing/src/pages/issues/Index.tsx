// ============================================================
// HeuLing — 더보기 페이지 v8.1
// 상태 필터(진행중/접수/전체/완료/보류) | 1개월/1년 기준
// EditCSDialog: CS 등록 폼과 동일 필드 + 기존 데이터 pre-fill
// ============================================================
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Receipt, Tag, Pencil, Save, ChevronDown, Trash2, ExternalLink, ChevronUp
} from 'lucide-react';
import { api } from '@/api/gasClient';
import { useAuth } from '@/hooks/useAuth';
import { TopBar, BottomNav, PageWrapper, CardSkeleton, ErrorState, RequestTypeBadge } from '@/components/Layout';
import { PhotoUploader } from '@/components/PhotoUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AnimatePresence } from 'framer-motion';
import { springPresets, staggerContainer, staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { ROUTE_PATHS, REQUEST_TYPES, type RequestType } from '@/lib/index';

// ── CS 등록 폼과 동일한 상수 ─────────────────────────────────
const CODE_TYPE_OPTIONS = ['ST', 'SCS', 'AD', 'CTP', 'CTA', 'NI', 'IPD', 'NM', 'PT', 'BrainPET', 'Common', 'Agent'] as const;
const PRODUCT_ALIAS: Record<string, string> = {
  ST: 'Heuron SCS', SCS: 'Heuron SCS', AD: 'Heuron AD', CTP: 'Heuron CTP',
  CTA: 'Heuron CTA', NI: 'Heuron NI', IPD: 'Heuron IPD', NM: 'Heuron NM',
  PT: 'Heuron PT', BrainPET: 'Heuron BrainPET', Common: 'Heuron Common', Agent: 'Heuron Agent',
};
const DESCRIPTION_OPTIONS = [
  '라이선스 만료 문의', '라이선스 업데이트 요청', '소프트웨어 오류/버그',
  '기능 오작동', '속도 저하/성능 문제', '설치 요청', '재설치 요청',
  '업데이트 요청', '원격 지원 요청', '방문 점검 요청', '사용 방법 문의',
  '설정 변경 요청', '데이터 오류', '네트워크/연결 문제', '기타',
] as const;
const RESPONSE_METHODS = ['원격', '유선', '방문'] as const;

// ── 사진 카테고리 ─────────────────────────────────────────────
const CS_PHOTO_CATS = [{ key: 'CS', label: '사진' }];

// ── CS 상태 설정 ─────────────────────────────────────────────
const CS_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  '접수':   { label: '접수',   className: 'bg-blue-500/10 text-blue-600 border border-blue-500/30' },
  '진행중': { label: '진행중', className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30' },
  '완료':   { label: '완료',   className: 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30' },
  '보류':   { label: '보류',   className: 'bg-gray-400/10 text-gray-500 border border-gray-400/30' },
};

function CSStatusBadge({ status }: { status?: string }) {
  const s = status || '접수';
  const cfg = CS_STATUS_CONFIG[s] ?? CS_STATUS_CONFIG['접수'];
  return <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', cfg.className)}>{cfg.label}</span>;
}

// ── Google Drive URL → 썸네일 URL 변환 ───────────────────────
function driveUrlToThumbnail(url: string): string {
  if (!url) return '';
  // https://drive.google.com/file/d/FILE_ID/view → 썸네일
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
  // https://drive.google.com/open?id=FILE_ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w400`;
  return url;
}
function driveUrlToView(url: string): string {
  if (!url) return '';
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/view`;
  return url;
}

// ── 상태 변경 드롭다운 ────────────────────────────────────────
function CSStatusChanger({ rowIndex, current, onChanged }: { rowIndex: number; current?: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: (newStatus: string) => api.updateCSStatus(rowIndex, newStatus),
    onSuccess: (res) => {
      if (!res.success) { alert(res.error || '상태 변경 실패'); return; }
      onChanged(); setOpen(false);
    },
  });
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={springPresets.snappy}
            className="absolute right-0 top-6 z-50 bg-popover border border-border rounded-xl shadow-lg p-1 w-24">
            {Object.entries(CS_STATUS_CONFIG).map(([val, cfg]) => (
              <button key={val} onClick={() => mutation.mutate(val)} disabled={mutation.isPending || val === current}
                className={cn('w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors', val === current ? 'bg-muted text-foreground font-medium' : 'hover:bg-muted text-muted-foreground')}>
                {cfg.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CSHistoryItem 타입 (20열 기준) ───────────────────────────
type CSHistoryItem = {
  type: 'cs'; rowIndex: number;
  병원명: string; 접수일: string; 처리완료일?: string;
  요청유형: string; 접수내용: string; 처리사항: string;
  CS상태: string; csStatus?: string;
  제품명: string; 담당자: string; 사진URL?: string;
  // 추가 필드 (v8 20열)
  코드분류?: string; 대응방식?: string;
};

// ── CS 수정 다이얼로그 (CS 등록 폼과 동일 필드) ──────────────
interface EditCSDialogProps {
  item: CSHistoryItem | null;
  onClose: () => void;
  onSaved: () => void;
  userEmail: string;
}

function EditCSDialog({ item, onClose, onSaved, userEmail }: EditCSDialogProps) {
  // 기존 접수내용이 드롭다운 항목에 있는지 체크
  const isCustomDesc = item?.접수내용 && !(DESCRIPTION_OPTIONS as readonly string[]).includes(item.접수내용);

  const [form, setForm] = useState({
    병원명:             item?.병원명   || '',
    reqDate:            item?.접수일   || '',
    custInfo:           '',
    requestType:        (item?.요청유형 || '') as RequestType | '',
    description:        isCustomDesc ? '기타' : (item?.접수내용 || ''),
    descriptionCustom:  isCustomDesc ? (item?.접수내용 || '') : '',
    descriptionDetail:  '',
    codeType:           item?.코드분류 || '',
    productVersion:     (item as Record<string,unknown>)?.['버전'] as string || '',
    responseMethod:     item?.대응방식 || '',
    csStatus:           item?.CS상태  || item?.csStatus || '접수',
    actionSummary:      item?.처리사항 || '',
    actionDetail:       (item as Record<string,unknown>)?.['처리내용서술형'] as string || '',
    remarks:            (item as Record<string,unknown>)?.['비고'] as string || '',
    feedbackApplied:    '미반영',
    showAdvanced:       !!((item as Record<string,unknown>)?.['처리내용서술형'] || (item as Record<string,unknown>)?.['비고']),
  });

  // item 변경 시 폼 데이터 재로드
  useEffect(() => {
    if (!item) return;
    const isCustom = item.접수내용 && !(DESCRIPTION_OPTIONS as readonly string[]).includes(item.접수내용);
    setForm({
      병원명:             item.병원명   || '',
      reqDate:            item.접수일   || '',
      custInfo:           '',
      requestType:        (item.요청유형 || '') as RequestType | '',
      description:        isCustom ? '기타' : (item.접수내용 || ''),
      descriptionCustom:  isCustom ? (item.접수내용 || '') : '',
      descriptionDetail:  '',
      codeType:           item.코드분류 || '',
      productVersion:     (item as Record<string,unknown>)['버전'] as string || '',
      responseMethod:     item.대응방식 || '',
      csStatus:           item.CS상태  || item.csStatus || '접수',
      actionSummary:      item.처리사항 || '',
      actionDetail:       (item as Record<string,unknown>)['처리내용서술형'] as string || '',
      remarks:            (item as Record<string,unknown>)['비고'] as string || '',
      feedbackApplied:    '미반영',
      showAdvanced:       !!((item as Record<string,unknown>)['처리내용서술형'] || (item as Record<string,unknown>)['비고']),
    });
    setPhotoPayload({ newPhotos: [], deletedUrls: [], remainingUrls: [] });
  }, [item]);

  const update = (key: string, val: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const resolvedProductName = form.codeType
    ? (PRODUCT_ALIAS[form.codeType] || form.codeType)
    : item?.제품명 || '';

  const [photoPayload, setPhotoPayload] = useState<{
    newPhotos: { category: string; file: File }[];
    deletedUrls: string[];
    remainingUrls: string[];
  }>({ newPhotos: [], deletedUrls: [], remainingUrls: [] });

  // 기존 사진 파싱 (Google Drive URL → 썸네일)
  const existingPhotoUrls = useMemo(() => {
    const raw = item?.사진URL;
    if (!raw || !raw.trim()) return [];
    return raw.split(',')
      .map(u => u.trim())
      .filter(Boolean)
      .map(url => ({ url, category: 'CS' }));
  }, [item]);

  const mutation = useMutation({
    mutationFn: () => {
      const finalDescription = form.description === '기타'
        ? (form.descriptionCustom.trim() || '기타')
        : form.description;
      return api.updateCSRecord({
        rowIndex: item!.rowIndex,
        email: userEmail,
        병원명:     form.병원명,
        제품명:     resolvedProductName || item?.제품명 || '',
        요청유형:   form.requestType || undefined,
        접수내용:   finalDescription,
        처리사항:   form.actionSummary,
        접수일:     form.reqDate || undefined,
        csStatus:   form.csStatus,
        대응방식:   form.responseMethod,
        코드분류:   form.codeType,
        newPhotos:  photoPayload.newPhotos,
        remainingUrls: photoPayload.remainingUrls.length > 0
          ? photoPayload.remainingUrls
          : existingPhotoUrls.map(e => e.url),
      });
    },
    onSuccess: (res) => {
      if (!res.success) { alert(res.error || '수정 실패'); return; }
      onSaved(); onClose();
    },
  });

  if (!item) return null;
  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" /> CS 수정
            <span className="text-xs text-muted-foreground font-normal ml-1">{item.병원명}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* 병원명 */}
          <div className="space-y-1.5">
            <Label className="text-xs">병원명</Label>
            <Input value={form.병원명} onChange={e => update('병원명', e.target.value)} className="h-9 text-sm" />
          </div>

          {/* 요청일자 */}
          <div className="space-y-1.5">
            <Label className="text-xs">요청일자</Label>
            <Input type="date" value={form.reqDate} onChange={e => update('reqDate', e.target.value)} className="h-9 text-sm" />
          </div>

          {/* 요청유형 */}
          <div className="space-y-1.5">
            <Label className="text-xs">요청유형</Label>
            <Select value={form.requestType} onValueChange={v => update('requestType', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="유형 선택" /></SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 요청내용 상세요약 (드롭다운) */}
          <div className="space-y-1.5">
            <Label className="text-xs">요청내용 (상세요약)</Label>
            <Select value={form.description} onValueChange={v => update('description', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="요청 내용 선택" /></SelectTrigger>
              <SelectContent>
                {DESCRIPTION_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.description === '기타' && (
              <Input
                placeholder="내용을 직접 입력하세요"
                value={form.descriptionCustom}
                onChange={e => update('descriptionCustom', e.target.value)}
                className="h-9 text-sm"
              />
            )}
          </div>

          {/* 코드분류 + 제품버전 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">코드분류</Label>
              <Select value={form.codeType} onValueChange={v => update('codeType', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {CODE_TYPE_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {resolvedProductName && (
                <p className="text-xs text-primary font-medium">→ {resolvedProductName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">제품버전</Label>
              <Input
                placeholder="예: 1.5.3"
                value={form.productVersion}
                onChange={e => update('productVersion', e.target.value)}
                className="h-9 text-sm font-mono"
              />
            </div>
          </div>

          {/* 대응방식 */}
          <div className="space-y-1.5">
            <Label className="text-xs">대응방식</Label>
            <div className="flex gap-2">
              {RESPONSE_METHODS.map(m => (
                <button key={m} type="button"
                  onClick={() => update('responseMethod', form.responseMethod === m ? '' : m)}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                    form.responseMethod === m
                      ? 'bg-primary/10 text-primary border-primary/40 ring-1 ring-primary/30'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                  )}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* CS 상태 */}
          <div className="space-y-1.5">
            <Label className="text-xs">진행 상태</Label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(CS_STATUS_CONFIG).map(([val, cfg]) => (
                <button key={val} type="button" onClick={() => update('csStatus', val)}
                  className={cn('px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
                    form.csStatus === val
                      ? `${cfg.className} ring-2 ring-offset-1 ring-current scale-105`
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted')}>
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* 처리내용 상세요약 */}
          <div className="space-y-1.5">
            <Label className="text-xs">처리내용 (상세요약)</Label>
            <Textarea value={form.actionSummary} onChange={e => update('actionSummary', e.target.value)}
              rows={3} className="text-sm resize-none" placeholder="처리 및 조치사항 요약" />
          </div>

          {/* 기존 사진 */}
          {existingPhotoUrls.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">기존 사진 ({existingPhotoUrls.length}장)</Label>
              <div className="grid grid-cols-3 gap-2">
                {existingPhotoUrls.map((p, i) => {
                  const thumb = driveUrlToThumbnail(p.url);
                  const viewUrl = driveUrlToView(p.url);
                  return (
                    <a key={i} href={viewUrl} target="_blank" rel="noopener noreferrer"
                      className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border group">
                      <img
                        src={thumb}
                        alt={`사진 ${i+1}`}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                      />
                      {/* 링크 아이콘 오버레이 */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-1 left-1 text-[8px] bg-black/50 text-white px-1 rounded">저장됨</span>
                    </a>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">탭하면 원본을 볼 수 있어요</p>
            </div>
          )}

          {/* 새 사진 추가 */}
          <div className="space-y-1.5">
            <Label className="text-xs">새 사진 추가</Label>
            <div className="bg-muted/30 border border-border rounded-xl p-3">
              <PhotoUploader
                categories={CS_PHOTO_CATS}
                onChange={setPhotoPayload}
              />
            </div>
          </div>

          {/* 추가 항목 */}
          <button
            type="button"
            onClick={() => update('showAdvanced', !form.showAdvanced)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <span>추가 항목 (처리내용 서술형 · 비고 · 고객피드백)</span>
            {form.showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {form.showAdvanced && (
            <div className="space-y-3 bg-muted/20 rounded-xl p-3 border border-border">
              <div className="space-y-1.5">
                <Label className="text-xs">처리내용 서술형</Label>
                <Textarea value={form.actionDetail} onChange={e => update('actionDetail', e.target.value)}
                  rows={3} className="text-sm resize-none" placeholder="처리 과정 상세 기술" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">비고</Label>
                <Input value={form.remarks} onChange={e => update('remarks', e.target.value)} className="h-9 text-sm" placeholder="특이사항" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">고객 피드백 반영 여부</Label>
                <div className="flex gap-2">
                  {['미반영', '반영', '검토중'].map(v => (
                    <button key={v} type="button" onClick={() => update('feedbackApplied', v)}
                      className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        form.feedbackApplied === v
                          ? 'bg-primary/10 text-primary border-primary/40'
                          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                      )}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 데모 수정 다이얼로그 ─────────────────────────────────────
interface EditDemoDialogProps {
  item: { rowIndex: number; 병원명: string; 제품명: string; 버전: string; 설치장소: string; 만료일: string; } | null;
  onClose: () => void; onSaved: () => void;
}
function EditDemoDialog({ item, onClose, onSaved }: EditDemoDialogProps) {
  const [form, setForm] = useState({ 제품명: item?.제품명 || '', 버전: item?.버전 || '', 설치장소: item?.설치장소 || '', 만료일: item?.만료일 || '' });
  const mutation = useMutation({
    mutationFn: () => api.updateDemoRecord({ rowIndex: item!.rowIndex, 제품명: form.제품명, 버전: form.버전, 설치장소: form.설치장소, 만료일: form.만료일 }),
    onSuccess: (res) => { if (!res.success) { alert(res.error || '수정 실패'); return; } onSaved(); onClose(); },
  });
  if (!item) return null;
  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> 데모 수정</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground">{item.병원명}</div>
          <div className="space-y-1.5"><Label className="text-xs">제품명</Label><Input value={form.제품명} onChange={e => setForm(p => ({...p, 제품명: e.target.value}))} className="h-9 text-sm" /></div>
          <div className="space-y-1.5"><Label className="text-xs">버전</Label><Input value={form.버전} onChange={e => setForm(p => ({...p, 버전: e.target.value}))} className="h-9 text-sm font-mono" /></div>
          <div className="space-y-1.5"><Label className="text-xs">설치 장소</Label><Input value={form.설치장소} onChange={e => setForm(p => ({...p, 설치장소: e.target.value}))} className="h-9 text-sm" /></div>
          <div className="space-y-1.5"><Label className="text-xs">만료일</Label><Input type="date" value={form.만료일} onChange={e => setForm(p => ({...p, 만료일: e.target.value}))} className="h-9 text-sm" /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-1.5"><Save className="w-3.5 h-3.5" />{mutation.isPending ? '저장 중...' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 월 키 헬퍼 ───────────────────────────────────────────────
function toMonthKey(dateStr?: string): string {
  if (!dateStr) return '날짜 없음';
  const m = String(dateStr).match(/^(\d{4})[.\-/](\d{1,2})/);
  if (!m) return '날짜 없음';
  return `${m[1]}년 ${String(m[2]).padStart(2, '0')}월`;
}
function compareMonthKey(a: string, b: string) {
  if (a === '날짜 없음') return 1;
  if (b === '날짜 없음') return -1;
  return b.localeCompare(a);
}

type CSFilter = '진행중' | '접수' | '전체' | '완료' | '보류';
const CS_FILTER_OPTIONS: { value: CSFilter; label: string }[] = [
  { value: '진행중', label: '진행중' },
  { value: '접수',   label: '접수' },
  { value: '전체',   label: '전체' },
  { value: '완료',   label: '완료' },
  { value: '보류',   label: '보류' },
];

type MainTab = 'cs' | 'hospital' | 'docs';
type HospitalFilter = 'demo' | 'commercial' | 'all';
const HOSPITAL_FILTER_OPTIONS: { value: HospitalFilter; label: string }[] = [
  { value: 'demo',       label: '데모' },
  { value: 'commercial', label: '상용' },
  { value: 'all',        label: '전체' },
];

// ── 신규병원 수정 다이얼로그 ──────────────────────────────────
const INSTALL_TYPE_OPT  = ['데모', '납품', '기타'];
const CONTRACT_TYPE_OPT = ['데모', '납품', '기타'];
const PRODUCT_TYPE_OPT  = ['On-Premise', 'Cloud'];
const PRODUCT_OPT       = ['Heuron Stroke','Heuron CTP','Heuron IPD','Heuron NI','Heuron AD','Heuron CTA','기타'];
const LICENSE_TYPE_OPT  = ['상용','데모'];
const LINK_METHOD_OPT   = ['PACS','라우팅','장비수동','장비자동'];
const REMOTE_AVAIL_OPT  = ['가능','불가능','요청시가능','VPN가능'];

interface HospitalItem { rowIndex: number; [key: string]: unknown; }

function EditHospitalDialog({ item, onClose, onSaved }: { item: HospitalItem | null; onClose: () => void; onSaved: () => void; }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const up = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!item) return;
    setForm({
      행정구분:         String(item.행정구분         || ''),
      병원명:           String(item.병원명           || ''),
      설치유형:         String(item.설치유형         || ''),
      계약유형:         String(item.계약유형         || ''),
      제품유형:         String(item.제품유형         || ''),
      제품명:           String(item.제품명           || ''),
      버전:             String(item.버전             || ''),
      라이선스유형:     String(item.라이선스유형     || ''),
      최초설치날짜:     String(item.최초설치날짜     || ''),
      라이선스만료일:   String(item.라이선스만료일   || ''),
      주담당자:         String(item.주담당자         || ''),
      IP주소:           String(item.IP주소           || ''),
      연동방식:         String(item.연동방식         || ''),
      장비제조사:       String(item.장비제조사       || ''),
      상세연동내역:     String(item.상세연동내역     || ''),
      사용자담당자정보: String(item.사용자담당자정보 || ''),
      설치장소:         String(item.설치장소         || ''),
      PACS업체정보:     String(item.PACS업체정보     || ''),
      원격가능:         String(item.원격가능         || ''),
      관리코드:         String(item.관리코드         || ''),
      비고:             String(item.비고             || ''),
      원격번호:         String(item.원격번호         || ''),
    });
  }, [item]);

  const mutation = useMutation({
    mutationFn: () => api.updateDomesticRow({ ...form, rowIndex: item!.rowIndex }),
    onSuccess: (res) => {
      if (!res.success) { alert(res.error || '수정 실패'); return; }
      onSaved(); onClose();
    },
  });

  if (!item) return null;
  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>신규병원 수정</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {/* 행정구분 */}
          <div className="space-y-1"><Label>행정구분</Label>
            <Input value={form.행정구분 || ''} onChange={e => up('행정구분', e.target.value)} placeholder="예: 서울특별시" /></div>
          {/* 병원명 */}
          <div className="space-y-1"><Label>병원명</Label>
            <Input value={form.병원명 || ''} onChange={e => up('병원명', e.target.value)} /></div>
          {/* 설치유형/계약유형 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>설치유형</Label>
              <Select value={form.설치유형 || ''} onValueChange={v => up('설치유형', v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{INSTALL_TYPE_OPT.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>계약유형</Label>
              <Select value={form.계약유형 || ''} onValueChange={v => up('계약유형', v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{CONTRACT_TYPE_OPT.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          {/* 제품유형/라이선스유형 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>제품유형</Label>
              <Select value={form.제품유형 || ''} onValueChange={v => up('제품유형', v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{PRODUCT_TYPE_OPT.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>라이선스유형</Label>
              <Select value={form.라이선스유형 || ''} onValueChange={v => up('라이선스유형', v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{LICENSE_TYPE_OPT.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          {/* 제품명/버전 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>제품명</Label>
              <Select value={form.제품명 || ''} onValueChange={v => up('제품명', v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{PRODUCT_OPT.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>버전</Label>
              <Input value={form.버전 || ''} onChange={e => up('버전', e.target.value)} placeholder="예: v2.3.1" className="font-mono" /></div>
          </div>
          {/* 날짜 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>최초설치날짜</Label>
              <Input type="date" value={form.최초설치날짜 || ''} onChange={e => up('최초설치날짜', e.target.value)} /></div>
            <div className="space-y-1"><Label>라이선스만료일</Label>
              <Input type="date" value={form.라이선스만료일 || ''} onChange={e => up('라이선스만료일', e.target.value)} /></div>
          </div>
          {/* IP/연동방식 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>IP주소</Label>
              <Input value={form.IP주소 || ''} onChange={e => up('IP주소', e.target.value)} className="font-mono" /></div>
            <div className="space-y-1"><Label>연동방식</Label>
              <Select value={form.연동방식 || ''} onValueChange={v => up('연동방식', v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{LINK_METHOD_OPT.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          {/* 원격가능/원격번호 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>원격가능</Label>
              <Select value={form.원격가능 || ''} onValueChange={v => up('원격가능', v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{REMOTE_AVAIL_OPT.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>원격번호</Label>
              <Input value={form.원격번호 || ''} onChange={e => up('원격번호', e.target.value)} className="font-mono" /></div>
          </div>
          {/* 장비제조사 */}
          <div className="space-y-1"><Label>장비제조사</Label>
            <Input value={form.장비제조사 || ''} onChange={e => up('장비제조사', e.target.value)} /></div>
          {/* 상세연동내역 */}
          <div className="space-y-1"><Label>상세연동내역</Label>
            <Textarea value={form.상세연동내역 || ''} onChange={e => up('상세연동내역', e.target.value)} rows={2} /></div>
          {/* 사용자/담당자정보 */}
          <div className="space-y-1"><Label>사용자/담당자정보</Label>
            <Input value={form.사용자담당자정보 || ''} onChange={e => up('사용자담당자정보', e.target.value)} /></div>
          {/* 설치장소 */}
          <div className="space-y-1"><Label>설치장소</Label>
            <Input value={form.설치장소 || ''} onChange={e => up('설치장소', e.target.value)} /></div>
          {/* PACS업체정보 */}
          <div className="space-y-1"><Label>PACS업체정보</Label>
            <Input value={form.PACS업체정보 || ''} onChange={e => up('PACS업체정보', e.target.value)} /></div>
          {/* 관리코드 */}
          <div className="space-y-1"><Label>관리코드</Label>
            <Input value={form.관리코드 || ''} onChange={e => up('관리코드', e.target.value)} className="font-mono" /></div>
          {/* 비고 */}
          <div className="space-y-1"><Label>비고</Label>
            <Textarea value={form.비고 || ''} onChange={e => up('비고', e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function MyIssuesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [mainTab,      setMainTab]      = useState<MainTab>('cs');
  const [editCSItem,   setEditCSItem]   = useState<CSHistoryItem | null>(null);
  const [editDemoItem, setEditDemoItem] = useState<Parameters<typeof EditDemoDialog>[0]['item']>(null);
  const [editHospItem, setEditHospItem] = useState<HospitalItem | null>(null);
  const [csFilter,     setCsFilter]     = useState<CSFilter>('진행중');
  const [hospFilter,   setHospFilter]   = useState<HospitalFilter>('demo');

  // ── CS 이력 ──
  const { data: history, isLoading: histLoading, isError: histError, error: histErr, refetch: refetchHistory } = useQuery({
    queryKey: ['my-history', user?.email],
    queryFn: async () => {
      const res = await api.getMyHistory();
      if (!res.success) throw new Error(String(res.error) || '데이터 로드 실패');
      return res.data!;
    },
    staleTime: 60 * 1000,
    enabled: !!user?.email && mainTab === 'cs',
  });

  // ── 신규병원 목록 ──
  const period = hospFilter === 'all' ? 'all' : '1month';
  const { data: hospList, isLoading: hospLoading, isError: hospError, refetch: refetchHosp } = useQuery({
    queryKey: ['domestic-list', hospFilter],
    queryFn: async () => {
      const filter = hospFilter === 'all' ? 'all' : hospFilter === 'demo' ? 'demo' : 'commercial';
      const res = await api.getDomesticList(filter, period);
      if (!res.success) throw new Error(String(res.error) || '조회 실패');
      return (res.data || []) as HospitalItem[];
    },
    staleTime: 60 * 1000,
    enabled: mainTab === 'hospital',
  });

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['my-history'] });
    queryClient.invalidateQueries({ queryKey: ['domestic-list'] });
  };

  const deleteCSMutation = useMutation({
    mutationFn: (rowIndex: number) => api.deleteCSRecord(rowIndex),
    onSuccess: (res) => {
      if (!res.success) { alert(res.error || '삭제 실패'); return; }
      queryClient.invalidateQueries({ queryKey: ['my-history'] });
    },
  });

  const deleteHospMutation = useMutation({
    mutationFn: (rowIndex: number) => api.deleteDomesticRow(rowIndex),
    onSuccess: (res) => {
      if (!res.success) { alert(res.error || '삭제 실패'); return; }
      queryClient.invalidateQueries({ queryKey: ['domestic-list'] });
    },
  });

  const filteredCS = useMemo(() => {
    if (!history?.cs) return [];
    const now = new Date();
    const cutoff1m = new Date(now);
    cutoff1m.setMonth(cutoff1m.getMonth() - 1);

    let list = [...history.cs];
    if (csFilter !== '전체') {
      list = list.filter(item => {
        const d = new Date(item.접수일 || '');
        if (isNaN(d.getTime())) return true;
        return d >= cutoff1m;
      });
      list = list.filter(item =>
        (item.CS상태 || item.csStatus || '접수') === csFilter
      );
    }
    return list.sort((a, b) => String(b.접수일 || '').localeCompare(String(a.접수일 || '')));
  }, [history, csFilter]);

  const groupedCS = useMemo(() => {
    const map = new Map<string, typeof filteredCS>();
    filteredCS.forEach(item => {
      const key = toMonthKey(item.접수일);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).sort(([a], [b]) => compareMonthKey(a, b));
  }, [filteredCS]);

  const filterBtnClass = (f: CSFilter) => {
    const active = csFilter === f;
    if (!active) return 'bg-muted/50 text-muted-foreground border-border hover:bg-muted';
    switch(f) {
      case '진행중': return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40';
      case '접수':   return 'bg-blue-500/15 text-blue-600 border-blue-500/40';
      case '전체':   return 'bg-foreground/10 text-foreground border-foreground/30';
      case '완료':   return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40';
      case '보류':   return 'bg-gray-400/15 text-gray-600 border-gray-400/40';
    }
  };

  const hospFilterBtnClass = (f: HospitalFilter) => {
    const active = hospFilter === f;
    if (!active) return 'bg-muted/50 text-muted-foreground border-border hover:bg-muted';
    if (f === 'demo')       return 'bg-blue-500/15 text-blue-600 border-blue-500/40';
    if (f === 'commercial') return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40';
    return 'bg-foreground/10 text-foreground border-foreground/30';
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="더보기" rightElement={
        <div className="flex items-center gap-1.5">
          {user?.role === '관리자' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">관리자</span>}
          <span className="text-xs text-muted-foreground">{user?.name}</span>
        </div>
      } />

      <PageWrapper>
        <div className="px-4 pt-4 space-y-4">

          {/* 바로가기 */}
          <div className="space-y-2">
            <button onClick={() => navigate(ROUTE_PATHS.RECEIPTS)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold text-primary">🧾 영수증 관리</span>
              </div>
              <span className="text-xs text-primary/60">월별 PDF 생성 →</span>
            </button>
            <button onClick={() => navigate(ROUTE_PATHS.RELEASES)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-2.5">
                <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">🏷 릴리즈 노트</span>
              </div>
              <span className="text-xs text-blue-500/60">최신 버전 확인 →</span>
            </button>
          </div>

          {/* ── 최상위 탭: CS이력 | 신규병원 ── */}
          <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border">
            <button
              onClick={() => setMainTab('cs')}
              className={cn('flex-1 py-2 text-sm font-semibold rounded-lg transition-all',
                mainTab === 'cs'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >📋 CS 이력</button>
            <button
              onClick={() => setMainTab('hospital')}
              className={cn('flex-1 py-2 text-sm font-semibold rounded-lg transition-all',
                mainTab === 'hospital'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >🏥 신규병원</button>
            <button
              onClick={() => setMainTab('docs')}
              className={cn('flex-1 py-2 text-sm font-semibold rounded-lg transition-all',
                mainTab === 'docs'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >📄 확인서</button>
          </div>

          {/* ── CS 이력 탭 ── */}
          {mainTab === 'cs' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    📋 CS 등록 이력
                    {!histLoading && history && (
                      <span className="bg-muted px-1.5 py-0.5 rounded-full text-[10px] text-muted-foreground">{filteredCS.length}건</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{csFilter === '전체' ? '1년 기준' : '1개월 기준'}</p>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {CS_FILTER_OPTIONS.map(({ value, label }) => (
                    <button key={value} onClick={() => setCsFilter(value)}
                      className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all', filterBtnClass(value))}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {histLoading && <CardSkeleton count={4} />}
              {histError && <ErrorState message={(histErr as Error)?.message || '조회 실패'} onRetry={() => refetchHistory()} />}

              {!histLoading && !histError && filteredCS.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground">해당하는 CS 이력이 없습니다.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {csFilter === '전체' ? '1년 내' : '1개월 내'} {csFilter !== '전체' ? `'${csFilter}'` : ''} 이력이 없어요.
                  </p>
                </div>
              )}

              {!histLoading && !histError && filteredCS.length > 0 && (
                <div className="space-y-4">
                  {groupedCS.map(([monthKey, items]) => (
                    <div key={monthKey} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{monthKey}</span>
                        <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">{items.length}건</span>
                      </div>
                      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                        {items.map((item, i) => {
                          const csItem = item as CSHistoryItem;
                          const status = csItem.CS상태 || csItem.csStatus || '접수';
                          return (
                            <motion.div key={i} variants={staggerItem} className="bg-card border border-border rounded-xl p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <CSStatusBadge status={status} />
                                    <RequestTypeBadge type={item.요청유형} />
                                    <span className="font-medium text-sm truncate">{item.병원명}</span>
                                    {item.제품명 && <span className="text-xs text-muted-foreground">{item.제품명}</span>}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.접수일}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <CSStatusChanger rowIndex={item.rowIndex} current={status}
                                    onChanged={() => queryClient.invalidateQueries({ queryKey: ['my-history'] })} />
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                    onClick={() => setEditCSItem(csItem)}>
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                    onClick={() => { if (confirm('이 CS 이력을 삭제하시겠습니까?')) deleteCSMutation.mutate(item.rowIndex); }}
                                    disabled={deleteCSMutation.isPending}>
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                  </Button>
                                </div>
                              </div>
                              {item.접수내용 && <p className="text-xs text-foreground/70 line-clamp-2">{item.접수내용}</p>}
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* ── 확인서 탭 ── */}
          {mainTab === 'docs' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">📄 확인서 빠른 접근</p>
              <div className="space-y-2">
                <button
                  onClick={() => navigate(ROUTE_PATHS.SERVICE_REPORT)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-xl hover:border-primary transition active:scale-[0.98]"
                >
                  <span className="text-2xl">🔍</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-foreground">점검 서비스 확인서</p>
                    <p className="text-xs text-muted-foreground mt-0.5">정기점검 / CS점검 / 비정기점검 서비스 확인서 작성</p>
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                </button>
                <button
                  onClick={() => navigate(ROUTE_PATHS.INSTALL_REQUEST)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-xl hover:border-primary transition active:scale-[0.98]"
                >
                  <span className="text-2xl">📋</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-foreground">설치환경 정보요청서</p>
                    <p className="text-xs text-muted-foreground mt-0.5">설치 전 병원 환경 정보 수집 → 제품현황 자동 등록</p>
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                </button>
                <button
                  onClick={() => navigate(ROUTE_PATHS.QUALIFICATION)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-xl hover:border-primary transition active:scale-[0.98]"
                >
                  <span className="text-2xl">✅</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-foreground">설치 및 운영 적격성 확인서</p>
                    <p className="text-xs text-muted-foreground mt-0.5">설치·운영·보안 적격성 평가 (P/F/N) → Word 문서 생성</p>
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                </button>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">📌 확인서 안내</p>
                <p>• 모든 확인서는 <strong>Word(.docx)</strong> 형식으로 생성 → 내용 수정 가능</p>
                <p>• 병원명 입력 시 제품현황_국내에서 정보 자동 불러오기</p>
                <p>• 사진 첨부 시 Drive 사진 폴더에 자동 저장</p>
              </div>
            </div>
          )}

          {/* ── 신규병원 탭 ── */}
          {mainTab === 'hospital' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    🏥 신규병원 현황
                    {!hospLoading && hospList && (
                      <span className="bg-muted px-1.5 py-0.5 rounded-full text-[10px] text-muted-foreground">{hospList.length}건</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {hospFilter === 'all' ? '전체 기간' : '1개월 기준'}
                  </p>
                </div>
                <div className="flex gap-1.5 pb-1">
                  {HOSPITAL_FILTER_OPTIONS.map(({ value, label }) => (
                    <button key={value} onClick={() => setHospFilter(value)}
                      className={cn('flex-1 py-1.5 rounded-full text-[11px] font-medium border transition-all', hospFilterBtnClass(value))}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {hospLoading && <CardSkeleton count={4} />}
              {hospError && <ErrorState message="조회 실패" onRetry={() => refetchHosp()} />}

              {!hospLoading && !hospError && (!hospList || hospList.length === 0) && (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground">등록된 데이터가 없습니다.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {hospFilter === 'all' ? '전체 기간' : '1개월 내'} {hospFilter !== 'all' ? `'${hospFilter === 'demo' ? '데모' : '상용'}'` : ''} 데이터가 없어요.
                  </p>
                </div>
              )}

              {!hospLoading && !hospError && hospList && hospList.length > 0 && (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                  {hospList.map((item, i) => (
                    <motion.div key={i} variants={staggerItem} className="bg-card border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border',
                              String(item.라이선스유형).includes('데모')
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                                : 'bg-green-500/10 text-green-700 border-green-500/30'
                            )}>{String(item.라이선스유형 || '데모')}</span>
                            <span className="font-medium text-sm truncate">{String(item.병원명 || '')}</span>
                            {item.제품명 && <span className="text-xs text-muted-foreground">{String(item.제품명)}</span>}
                            {item.버전 && <span className="text-[10px] font-mono bg-muted px-1 rounded">{String(item.버전)}</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            설치 {String(item.최초설치날짜 || '')}
                            {item.라이선스만료일 ? ` · 만료 ${String(item.라이선스만료일)}` : ''}
                          </p>
                          {item.설치장소 && <p className="text-[10px] text-muted-foreground">📍 {String(item.설치장소)}</p>}
                          {item.주담당자 && <p className="text-[10px] text-muted-foreground">👤 {String(item.주담당자)}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => setEditHospItem(item)}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => { if (confirm(`'${String(item.병원명)}' 데이터를 삭제하시겠습니까?`)) deleteHospMutation.mutate(item.rowIndex); }}
                            disabled={deleteHospMutation.isPending}>
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          )}

        </div>
      </PageWrapper>

      <EditCSDialog item={editCSItem} onClose={() => setEditCSItem(null)} onSaved={onSaved} userEmail={user?.email || ''} />
      <EditDemoDialog item={editDemoItem} onClose={() => setEditDemoItem(null)} onSaved={onSaved} />
      <EditHospitalDialog item={editHospItem} onClose={() => setEditHospItem(null)} onSaved={onSaved} />

      <BottomNav />
    </div>
  );
}
