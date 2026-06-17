// ============================================================
// HeuLing — 철수(회수) 모듈 페이지 (PC번호 확인 + 슬라이드 투 컨펌)
// ============================================================
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, PackageMinus, ArrowRight, Lock, Search } from 'lucide-react';
import { api } from '@/api/gasClient';
import { useOnline } from '@/hooks/useOnline';
import { addToQueue } from '@/lib/offlineDB';
import { ROUTE_PATHS } from '@/lib/index';
import { TopBar, BottomNav, PageWrapper, EmptyState, CardSkeleton, ErrorState } from '@/components/Layout';
import { PhotoUploader } from '@/components/PhotoUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { springPresets } from '@/lib/motion';
import { cn } from '@/lib/utils';

// ── 슬라이드 투 컨펌 컴포넌트 ─────────────────────────────────
interface SlideToConfirmProps {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
}

function SlideToConfirm({ onConfirm, disabled = false, label = '밀어서 철수 처리' }: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const startX = useRef(0);

  const THUMB = 52;
  const getTrackWidth = () => (trackRef.current?.clientWidth ?? 300) - THUMB - 8;

  const handleStart = (clientX: number) => {
    if (disabled || confirmed) return;
    setDragging(true);
    startX.current = clientX - pos;
  };

  const handleMove = useCallback((clientX: number) => {
    if (!dragging) return;
    const max = getTrackWidth();
    const newPos = Math.min(max, Math.max(0, clientX - startX.current));
    setPos(newPos);
    if (newPos >= max * 0.92) {
      setConfirmed(true);
      setDragging(false);
      onConfirm();
    }
  }, [dragging, onConfirm]);

  const handleEnd = useCallback(() => {
    if (!confirmed) { setPos(0); }
    setDragging(false);
  }, [confirmed]);

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-14 rounded-full overflow-hidden select-none',
        confirmed
          ? 'bg-green-500'
          : disabled
          ? 'bg-muted opacity-50'
          : 'bg-destructive/15 border border-destructive/40'
      )}
      onMouseMove={e => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchMove={e => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
    >
      {/* 배경 텍스트 */}
      {!confirmed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={cn(
            'text-sm font-medium transition-opacity',
            dragging ? 'opacity-30' : 'opacity-60',
            disabled ? 'text-muted-foreground' : 'text-destructive'
          )}>
            {label}
          </span>
          {!disabled && <ArrowRight className="w-4 h-4 text-destructive/50 ml-2" />}
        </div>
      )}
      {confirmed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-white mr-2" />
          <span className="text-white font-semibold">처리 완료!</span>
        </div>
      )}

      {/* 드래그 썸 */}
      {!confirmed && (
        <motion.div
          className={cn(
            'absolute top-1 left-1 w-12 h-12 rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing z-10',
            disabled ? 'bg-muted' : 'bg-destructive'
          )}
          style={{ x: pos }}
          onMouseDown={e => handleStart(e.clientX)}
          onTouchStart={e => handleStart(e.touches[0].clientX)}
          whileTap={{ scale: 0.95 }}
        >
          {disabled
            ? <Lock className="w-5 h-5 text-muted-foreground" />
            : <ArrowRight className="w-5 h-5 text-white" />
          }
        </motion.div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
const WITHDRAW_PHOTO_CATEGORIES = [
  { key: 'WITHDRAW', label: '철수 사진' },
];

interface DemoItem {
  병원명: string;
  제품명: string;
  버전?: string;
  라이선스?: string;
  만료일?: string;
  상태?: string;
  담당자?: string;
  PC번호?: string;
  철수유형?: string; // '데모' | '상용만료'
}

export default function WithdrawPage() {
  const { isOnline } = useOnline();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<DemoItem | null>(null);
  const [search, setSearch] = useState('');
  const [pcInput, setPcInput] = useState('');
  const [pcVerified, setPcVerified] = useState(false);
  const [pcError, setPcError] = useState('');
  const [reason, setReason] = useState('');
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState<{ category: string; file: File }[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: demoList, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['demo-list'],
    queryFn: async () => {
      const res = await api.getDemoList();
      if (!res.success) throw new Error(String(res.error) || '데이터 로드 실패');
      return (res.data || []) as unknown as DemoItem[];
    },
    staleTime: 10 * 60 * 1000,  // 10분
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('대상을 선택하세요.');
      const payload = {
        hospitalName:  selected.병원명,
        productName:   selected.제품명,
        reason,
        withdrawDate,
        photos,
      };
      if (!isOnline) {
        await addToQueue('withdrawDemo', payload as unknown as Record<string, unknown>);
        return;
      }
      const res = await api.withdrawDemo(payload);
      if (!res.success) throw new Error(String(res.error) || '철수 처리 실패');
    },
    onSuccess: () => {
      setIsSuccess(true);
      setTimeout(() => navigate(ROUTE_PATHS.HOSPITALS), 2200);
    },
  });

  // 제품 선택 시 상태 초기화
  const handleSelectItem = (item: DemoItem) => {
    setSelected(item);
    setPcInput('');
    setPcVerified(false);
    setPcError('');
  };

  // PC번호 검증
  const handleVerifyPC = () => {
    const sheetPC = (selected?.PC번호 || '').replace(/\s/g, '').toLowerCase();
    const inputPC = pcInput.replace(/\s/g, '').toLowerCase();
    if (!inputPC) { setPcError('PC번호를 입력하세요.'); return; }
    if (sheetPC && sheetPC !== inputPC) {
      setPcError('PC번호가 일치하지 않습니다. 다시 확인해주세요.');
      setPcVerified(false);
    } else {
      setPcError('');
      setPcVerified(true);
    }
  };

  // 슬라이드 확인 시 실행
  const handleSlideConfirm = () => {
    if (!selected || !reason.trim()) return;
    mutation.mutate();
  };

  const hasPcNumber = !!(selected?.PC번호?.trim());
  const canSlide = pcVerified && reason.trim().length > 0;

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
          <p className="font-semibold">철수 처리 완료!</p>
          <p className="text-sm text-muted-foreground">
            {!isOnline ? '오프라인 저장됨' : '구글 시트에 반영되었습니다.'}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="철수(회수)" showBack />
      <PageWrapper>
        <div className="px-4 pt-4 pb-8 space-y-5">

          {/* ── 1단계: 대상 선택 ───────────────────────────────── */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">
              철수 대상 선택 <span className="text-destructive">*</span>
            </Label>

            {/* 검색바 */}
            {!isLoading && !isError && (demoList || []).length > 0 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="병원명 검색..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
            {isLoading && <CardSkeleton count={3} />}
            {isError && (
              <ErrorState
                message={(error as Error)?.message || '데이터 로드 실패'}
                onRetry={() => refetch()}
              />
            )}
            {!isLoading && !isError && (demoList || []).length === 0 && (
              <EmptyState
                icon={<PackageMinus className="w-10 h-10" />}
                title="활성 데모가 없습니다."
              />
            )}
            {!isLoading && !isError && (demoList || []).length > 0 && (
              <div className="space-y-2">
                {(demoList || [])
                  .filter(item => !search.trim() || item.병원명.toLowerCase().includes(search.toLowerCase()))
                  .map((item, i) => {
                  const isSelected = selected?.병원명 === item.병원명 && selected?.제품명 === item.제품명;
                  const pc = item.PC번호?.trim();

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={cn(
                        'w-full bg-card border rounded-xl p-4 text-left transition-all',
                        isSelected
                          ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm">{item.병원명}</p>
                            {/* 철수유형 뱃지 */}
                            {item.철수유형 === '상용만료' ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-400 font-medium">📅 상용만료</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium">🔬 데모</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.제품명}</p>
                          {/* PC번호 힌트 표시 */}
                          {pc && (
                            <p className="text-[11px] text-primary/70 mt-1 font-mono">
                              🖥 PC: {pc}
                            </p>
                          )}
                          {item.만료일 && (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                              만료일: {item.만료일}
                            </p>
                          )}
                        </div>
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ml-3 mt-0.5',
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                        )}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 2단계: PC번호 확인 (선택된 경우) ───────────────── */}
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springPresets.gentle}
              className="space-y-5"
            >
              {/* PC번호 입력 */}
              <div className="space-y-2">
                <Label>
                  PC번호 확인
                  {hasPcNumber ? (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(대소문자·공백 무시)</span>
                  ) : (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(등록된 PC번호 없음 — 슬라이드로 진행)</span>
                  )}
                </Label>
                {hasPcNumber ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="PC번호를 입력하세요"
                      value={pcInput}
                      onChange={e => { setPcInput(e.target.value); setPcVerified(false); setPcError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyPC()}
                      className={cn(
                        'font-mono',
                        pcVerified ? 'border-green-500 bg-green-500/5' : pcError ? 'border-destructive' : ''
                      )}
                    />
                    <Button type="button" variant="outline" onClick={handleVerifyPC} className="shrink-0">
                      확인
                    </Button>
                  </div>
                ) : (
                  /* PC번호 없으면 자동 통과 */
                  <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground"
                    ref={el => { if (el && !pcVerified) setPcVerified(true); }}>
                    PC번호가 등록되어 있지 않습니다. 아래에서 사유 입력 후 슬라이드하세요.
                  </div>
                )}
                {pcError && <p className="text-xs text-destructive">{pcError}</p>}
                {pcVerified && hasPcNumber && (
                  <p className="text-xs text-green-600 dark:text-green-400">✓ PC번호 확인됨</p>
                )}
              </div>

              {/* 철수 사유 */}
              <div className="space-y-1.5">
                <Label>철수 사유 <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="철수 사유를 입력하세요. 예: 데모 계약 만료, 타 제품으로 교체 등"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* 철수일 */}
              <div className="space-y-1.5">
                <Label>철수일</Label>
                <Input
                  type="date"
                  value={withdrawDate}
                  onChange={e => setWithdrawDate(e.target.value)}
                />
              </div>

              {/* 사진 첨부 */}
              <div className="space-y-1.5">
                <Label>사진 첨부</Label>
                <div className="bg-card border border-border rounded-xl p-4">
                  <PhotoUploader
                    categories={WITHDRAW_PHOTO_CATEGORIES}
                    onChange={({ newPhotos }) => setPhotos(newPhotos)}
                    maxPerCategory={10}
                    guideText="카테고리별 최대 10장 첨부 가능합니다. 한 번에 여러 장 선택할 수 있습니다."
                  />
                </div>
              </div>

              {mutation.isError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-destructive">{(mutation.error as Error)?.message}</p>
                </div>
              )}

              {!isOnline && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">오프라인 모드 — 저장 후 자동 업로드</p>
                </div>
              )}

              {/* 슬라이드 투 컨펌 */}
              {mutation.isPending ? (
                <div className="h-14 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">처리 중...</span>
                </div>
              ) : (
                <SlideToConfirm
                  onConfirm={handleSlideConfirm}
                  disabled={!canSlide}
                  label={!pcVerified ? 'PC번호 확인 후 진행' : !reason.trim() ? '철수 사유 입력 후 진행' : '밀어서 철수 처리'}
                />
              )}
              {!canSlide && (
                <p className="text-xs text-center text-muted-foreground">
                  {!pcVerified ? '🔒 PC번호를 먼저 확인하세요' : '📝 철수 사유를 입력하세요'}
                </p>
              )}
            </motion.div>
          )}
        </div>
      </PageWrapper>
      <BottomNav />
    </div>
  );
}
