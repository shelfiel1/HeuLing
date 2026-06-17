// ============================================================
// HeuLing — CS 등록 페이지 v8
// 20열 완전 매핑 | 코드분류→제품명 자동변환 | 요청일자 기본 오늘
// ============================================================
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookOpen, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/api/gasClient';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { addToQueue } from '@/lib/offlineDB';
import { ROUTE_PATHS, REQUEST_TYPES } from '@/lib/index';
import { TopBar, BottomNav, PageWrapper } from '@/components/Layout';
import { PhotoUploader } from '@/components/PhotoUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { springPresets } from '@/lib/motion';
import { cn } from '@/lib/utils';

// ── 코드분류 → 제품명 매핑 ──────────────────────────────────
const CODE_TYPE_OPTIONS = ['ST', 'SCS', 'AD', 'CTP', 'CTA', 'NI', 'IPD', 'NM', 'PT', 'BrainPET', 'Common', 'Agent'] as const;
const PRODUCT_ALIAS: Record<string, string> = {
  ST:       'Heuron SCS',
  SCS:      'Heuron SCS',
  AD:       'Heuron AD',
  CTP:      'Heuron CTP',
  CTA:      'Heuron CTA',
  NI:       'Heuron NI',
  IPD:      'Heuron IPD',
  NM:       'Heuron NM',
  PT:       'Heuron PT',
  BrainPET: 'Heuron BrainPET',
  Common:   'Heuron Common',
  Agent:    'Heuron Agent',
};

// ── CS 상태 설정 ─────────────────────────────────────────────
const CS_STATUSES = [
  { value: '접수',   color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  { value: '진행중', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  { value: '완료',   color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  { value: '보류',   color: 'bg-gray-400/10 text-gray-500 border-gray-400/30' },
];

// ── 요청내용 상세요약 드롭다운 옵션 ────────────────────────
const DESCRIPTION_OPTIONS = [
  '라이선스 만료 문의',
  '라이선스 업데이트 요청',
  '소프트웨어 오류/버그',
  '기능 오작동',
  '속도 저하/성능 문제',
  '설치 요청',
  '재설치 요청',
  '업데이트 요청',
  '원격 지원 요청',
  '방문 점검 요청',
  '사용 방법 문의',
  '설정 변경 요청',
  '데이터 오류',
  '네트워크/연결 문제',
  '기타',
] as const;

// ── 사진 카테고리 ────────────────────────────────────────────
const CS_PHOTO_CATS = [{ key: 'CS', label: '사진' }];

// ── 오늘 날짜 (YYYY-MM-DD) ──────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── 업데이트 매뉴얼 바로가기 배너 ────────────────────────────
function UpdateManualBanner() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['update-manuals-banner'],
    queryFn: async () => {
      const res = await api.getUpdateManuals();
      return res.data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
  if (!data || data.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {/* 접힌 상태 기본 — 클릭하면 목록 펼침 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <span className="flex-1 text-sm font-medium text-primary text-left">
          업데이트 매뉴얼 ({data.length}개)
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-primary shrink-0" />
          : <ChevronDown className="w-4 h-4 text-primary shrink-0" />}
      </button>

      {/* 펼쳐졌을 때 목록 */}
      {open && (
        <div className="space-y-1 pl-2">
          {data.map((m: {name: string; url: string}, i: number) => (
            <a
              key={i}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted active:scale-[0.98] transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm text-foreground truncate">{m.name}</span>
              <span className="text-xs text-primary shrink-0">바로가기</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 대응방식 ─────────────────────────────────────────────────
const RESPONSE_METHODS = ['원격', '유선', '방문'];

export default function CSFormPage() {
  const { user } = useAuth();
  const { isOnline } = useOnline();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledHospital = searchParams.get('hospital') || '';

  // ── 폼 상태 ───────────────────────────────────────────────
  const [form, setForm] = useState({
    // 기본 필드
    hospitalName:       prefilledHospital,
    reqDate:            today(),           // C: 요청일자 (기본 오늘)
    reqTime:            '',                // 요청시간 (HH:MM)
    custInfo:           '',               // E: 담당자정보(고객)
    requestType:        '',               // F: 요청유형
    description:        '',               // G: 요청내용(상세요약) - 드롭다운 선택값
    descriptionCustom:  '',               // G: 기타 직접입력
    descriptionDetail:  '',               // H: 요청내용 상세
    codeType:           '',               // R: 코드분류
    productVersion:     '',               // K: 제품버전
    responseMethod:     '',               // M: 대응방식
    csStatus:           '접수',           // L: 상태
    actionSummary:      '',               // N: 처리내용(상세요약)
    actionDetail:       '',               // O: 처리내용 서술형
    remarks:            '',               // Q: 비고
    feedbackApplied:    '미반영',         // S: 고객피드백반영여부
    // 추가 UI 상태
    showAdvanced:       false,
  });
  const [photos, setPhotos] = useState<{ category: string; file: File }[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const update = (key: string, val: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // 파생: 코드분류로 제품명 자동결정
  const resolvedProductName = form.codeType
    ? (PRODUCT_ALIAS[form.codeType] || form.codeType)
    : '';

  // ── 병원 목록 ────────────────────────────────────────────
  const { data: hospitals } = useQuery({
    queryKey: ['hospitals-simple'],
    queryFn: async () => {
      const res = await api.getHospitalList();
      return res.data?.map(h => h.hospitalName) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── 유효성 검사 ──────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.hospitalName)       e.hospitalName   = '병원명을 선택하세요.';
    if (!form.requestType)        e.requestType    = '요청유형을 선택하세요.';
    if (!form.description)        e.description    = '요청내용을 선택하세요.';
    if (form.description === '기타' && !form.descriptionCustom.trim())
                                  e.description    = '기타 내용을 직접 입력하세요.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── 등록 mutation ────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      const finalDescription = form.description === '기타'
        ? (form.descriptionCustom.trim() || '기타')
        : form.description;

      const payload = {
        hospitalName:      form.hospitalName,
        reqDate:           form.reqDate + (form.reqTime ? 'T' + form.reqTime : ''),
        reqTime:           form.reqTime,
        custInfo:          form.custInfo,
        requestType:       form.requestType,
        description:       finalDescription,
        descriptionDetail: form.descriptionDetail,
        codeType:          form.codeType,
        productName:       resolvedProductName,
        productVersion:    form.productVersion.replace(/\s+/g, ''),
        responseMethod:    form.responseMethod,
        csStatus:          form.csStatus,
        actionSummary:     form.actionSummary,
        actionDetail:      form.actionDetail,
        remarks:           form.remarks,
        feedbackApplied:   form.feedbackApplied,
        handlerName:       user?.name || '',
        photos,
      };

      if (!isOnline) {
        await addToQueue('submitCS', payload as unknown as Record<string, unknown>);
        return { offline: true };
      }
      const res = await api.submitCS(payload);
      if (!res.success) throw new Error(res.error || '등록 실패');
      return { offline: false };
    },
    onSuccess: () => {
      setIsSuccess(true);
      setTimeout(() => navigate(ROUTE_PATHS.HOSPITALS), 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  };

  // ── 성공 화면 ─────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springPresets.bouncy}
          className="text-center space-y-3"
        >
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <p className="font-semibold text-foreground">CS 등록 완료!</p>
          <p className="text-sm text-muted-foreground">
            {!isOnline ? '오프라인 저장됨 — 온라인 시 자동 업로드' : '구글 시트에 저장되었습니다.'}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="CS 등록" showBack />
      <PageWrapper>
        <form onSubmit={handleSubmit} className="px-4 pt-4 pb-8 space-y-5">

          {/* ── 업데이트 매뉴얼 바로가기 ──────────────────── */}
          <UpdateManualBanner />

          {/* ── 병원명 * ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>병원명 <span className="text-destructive">*</span></Label>
            <Select value={form.hospitalName} onValueChange={v => update('hospitalName', v)}>
              <SelectTrigger className={errors.hospitalName ? 'border-destructive' : ''}>
                <SelectValue placeholder="병원을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {(hospitals || []).map(h => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.hospitalName && <p className="text-xs text-destructive">{errors.hospitalName}</p>}
          </div>

          {/* ── 요청일자 + 시간 ───────────────────────────── */}
          <div className="space-y-1.5">
            <Label>요청일자 / 시간</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={form.reqDate}
                onChange={e => update('reqDate', e.target.value)}
                className="h-10 flex-1"
              />
              {/* 시간: 드롭다운 + 직접입력 콤보 */}
              <div className="relative w-28">
                <Input
                  list="time-options"
                  placeholder="시간 선택"
                  value={form.reqTime}
                  onChange={e => update('reqTime', e.target.value)}
                  className="h-10 text-sm pr-2"
                  maxLength={5}
                />
                <datalist id="time-options">
                  {Array.from({length:28},(_,i)=>{
                    const h=Math.floor(i/2)+8; const m=i%2===0?'00':'30';
                    return <option key={i} value={`${String(h).padStart(2,'0')}:${m}`}/>;
                  })}
                </datalist>
              </div>
            </div>
          </div>

          {/* ── 담당자정보(고객) ──────────────────────────── */}
          <div className="space-y-1.5">
            <Label>담당자정보 (고객)</Label>
            <Input
              placeholder="예: 홍길동/영상의학과/010-0000-0000"
              value={form.custInfo}
              onChange={e => update('custInfo', e.target.value)}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">이름/부서/연락처 형식 권장</p>
          </div>

          {/* ── 요청유형 * ───────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>요청유형 <span className="text-destructive">*</span></Label>
            <Select value={form.requestType} onValueChange={v => update('requestType', v)}>
              <SelectTrigger className={errors.requestType ? 'border-destructive' : ''}>
                <SelectValue placeholder="요청유형 선택" />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.requestType && <p className="text-xs text-destructive">{errors.requestType}</p>}
          </div>

          {/* ── 요청내용 상세요약 * ───────────────────────── */}
          <div className="space-y-1.5">
            <Label>요청내용 (상세요약) <span className="text-destructive">*</span></Label>
            <Select value={form.description} onValueChange={v => update('description', v)}>
              <SelectTrigger className={errors.description ? 'border-destructive' : ''}>
                <SelectValue placeholder="요청 내용을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {DESCRIPTION_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 기타 선택 시 직접 입력 */}
            {form.description === '기타' && (
              <Input
                placeholder="내용을 직접 입력하세요"
                value={form.descriptionCustom || ''}
                onChange={e => update('descriptionCustom', e.target.value)}
                className="h-10"
              />
            )}
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* ── 요청내용 상세 ────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>요청내용 상세</Label>
            <Textarea
              placeholder="상세 내용을 서술형으로 작성하세요"
              value={form.descriptionDetail}
              onChange={e => update('descriptionDetail', e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* ── 구분선 ───────────────────────────────────── */}
          <div className="border-t border-border/50" />

          {/* ── 코드분류 + 제품버전 ──────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>코드분류</Label>
              <Select value={form.codeType} onValueChange={v => update('codeType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {CODE_TYPE_OPTIONS.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {resolvedProductName && (
                <p className="text-xs text-primary font-medium">→ {resolvedProductName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>제품버전</Label>
              <Input
                placeholder="예: 1.5.3"
                value={form.productVersion}
                onChange={e => update('productVersion', e.target.value)}
                className="h-10 font-mono"
              />
            </div>
          </div>

          {/* ── 대응방식 ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>대응방식</Label>
            <div className="flex gap-2">
              {RESPONSE_METHODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update('responseMethod', form.responseMethod === m ? '' : m)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                    form.responseMethod === m
                      ? 'bg-primary/10 text-primary border-primary/40 ring-1 ring-primary/30'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* ── CS 상태 ──────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>진행 상태</Label>
            <div className="flex gap-2 flex-wrap">
              {CS_STATUSES.map(({ value, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('csStatus', value)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
                    form.csStatus === value
                      ? `${color} ring-2 ring-offset-1 ring-current scale-105`
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* ── 처리내용 상세요약 ─────────────────────────── */}
          <div className="space-y-1.5">
            <Label>처리내용 (상세요약)</Label>
            <Textarea
              placeholder="예: 포트 변경 후 서비스 재시작으로 정상 처리"
              value={form.actionSummary}
              onChange={e => update('actionSummary', e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* ── 사진 첨부 ────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>사진 첨부</Label>
            <div className="bg-card border border-border rounded-xl p-4">
              <PhotoUploader
                categories={CS_PHOTO_CATS}
                onChange={({ newPhotos }) => setPhotos(newPhotos)}
              />
            </div>
          </div>

          {/* ── 추가 항목 펼치기 ─────────────────────────── */}
          <button
            type="button"
            onClick={() => update('showAdvanced', !form.showAdvanced)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <span>추가 항목 (처리내용 서술형 · 비고 · 고객피드백)</span>
            {form.showAdvanced
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </button>

          {form.showAdvanced && (
            <div className="space-y-4 bg-muted/20 rounded-xl p-4 border border-border">
              {/* 처리내용 서술형 */}
              <div className="space-y-1.5">
                <Label className="text-xs">처리내용 서술형</Label>
                <Textarea
                  placeholder="처리 과정을 서술형으로 상세 기술"
                  value={form.actionDetail}
                  onChange={e => update('actionDetail', e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
              {/* 비고 */}
              <div className="space-y-1.5">
                <Label className="text-xs">비고</Label>
                <Input
                  placeholder="특이사항 등"
                  value={form.remarks}
                  onChange={e => update('remarks', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              {/* 고객 피드백 반영 여부 */}
              <div className="space-y-1.5">
                <Label className="text-xs">고객 피드백 반영 여부</Label>
                <div className="flex gap-2">
                  {['미반영', '반영', '검토중'].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update('feedbackApplied', v)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        form.feedbackApplied === v
                          ? 'bg-primary/10 text-primary border-primary/40'
                          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 오류 메시지 ──────────────────────────────── */}
          {mutation.isError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive">{(mutation.error as Error)?.message}</p>
            </div>
          )}

          {/* ── 오프라인 안내 ────────────────────────────── */}
          {!isOnline && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                오프라인 상태입니다. 저장 후 온라인 복귀 시 자동 업로드됩니다.
              </p>
            </div>
          )}

          {/* ── 제출 버튼 ────────────────────────────────── */}
          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                저장 중...
              </span>
            ) : (isOnline ? 'CS 등록' : '오프라인 저장')}
          </Button>
        </form>
      </PageWrapper>
      <BottomNav />
    </div>
  );
}
