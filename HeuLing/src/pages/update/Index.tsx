// ============================================================
// HeuLing — 업데이트 모듈 페이지 (현재 버전 표시 + 사진 20장)
// ============================================================
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { api } from '@/api/gasClient';
import { useOnline } from '@/hooks/useOnline';
import { addToQueue } from '@/lib/offlineDB';
import { ROUTE_PATHS, UPDATE_TYPES, type UpdateType } from '@/lib/index';
import { TopBar, BottomNav, PageWrapper } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { springPresets } from '@/lib/motion';
import { FileListModal, type ManualFile } from '@/components/FileListModal';
import { PhotoUploader } from '@/components/PhotoUploader';

const UPDATE_PHOTO_CATEGORIES = [
  { key: 'SETTING', label: '셋팅 사진' },
  { key: 'SCREEN',  label: '화면 캡처' },
  { key: 'ETC',     label: '기타' },
];

export default function UpdateFormPage() {
  const { isOnline } = useOnline();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledHospital = searchParams.get('hospital') || '';

  const [form, setForm] = useState({
    updateType:   '' as UpdateType | '',
    hospitalName: prefilledHospital,
    productName:  '',
    details:      '',
    newVersion:   '',
    newExpiry:    '',
  });
  const [photos, setPhotos] = useState<{ category: string; file: File }[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 업데이트 메뉴얼 바텀시트 상태
  const [manualOpen, setManualOpen] = useState(false);

  const { data: hospitals } = useQuery({
    queryKey: ['hospitals-simple'],
    queryFn: async () => {
      const res = await api.getHospitalList();
      return res.data?.map(h => h.hospitalName) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 제품 목록 (제품명 + 현재 버전 포함)
  const { data: products } = useQuery({
    queryKey: ['products-detail', form.hospitalName],
    queryFn: async () => {
      if (!form.hospitalName) return [];
      // getHospitalDetail로 상세 정보 조회 (버전 포함)
      const res = await api.getHospitalDetail(form.hospitalName);
      if (!res.success || !res.data) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = res.data as any;
      return (detail.products || []) as Array<{ 제품명: string; 버전?: string; 만료일?: string; 상태?: string }>;
    },
    enabled: !!form.hospitalName,
    staleTime: 3 * 60 * 1000,
  });

  // 선택된 제품의 현재 버전/만료일
  const selectedProduct = products?.find(p => p.제품명 === form.productName);

  // 업데이트 메뉴얼 파일 목록 (모달 열릴 때 fetch)
  const { data: manualFiles, isFetching: manualFetching } = useQuery({
    queryKey: ['updateManuals'],
    queryFn: async () => {
      const res = await api.getUpdateManuals();
      if (!res.success) throw new Error(String(res.error));
      return (res.data || []) as ManualFile[];
    },
    enabled: manualOpen,
    staleTime: 5 * 60 * 1000,
  });

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.updateType)   e.updateType   = '업데이트 유형을 선택하세요.';
    if (!form.hospitalName) e.hospitalName = '병원명을 선택하세요.';
    if (!form.productName)  e.productName  = '제품명을 선택하세요.';
    if (!form.details.trim()) e.details = '처리 내용을 입력하세요.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, updateType: form.updateType as UpdateType };

      // 사진 업로드 처리
      const photoUrls: string[] = [];
      if (photos.length > 0) {
        for (const photo of photos) {
          // fileToBase64는 gasClient 내부에서 처리하므로 여기서는 photos 배열 전달
          // updateWithPhotos API 호출
        }
      }

      if (!isOnline) {
        const action = form.updateType === '라이선스 업데이트' ? 'updateLicense' : 'updateProduct';
        await addToQueue(action, { ...payload, photos } as unknown as Record<string, unknown>);
        return;
      }

      const res = form.updateType === '라이선스 업데이트'
        ? await api.updateLicenseWithPhotos(payload, photos)
        : await api.updateProductWithPhotos(payload, photos);
      if (!res.success) throw new Error(String(res.error) || '업데이트 실패');
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
          <p className="font-semibold">업데이트 완료!</p>
          <p className="text-sm text-muted-foreground">
            {!isOnline ? '오프라인 저장됨' : '구글 시트에 반영되었습니다.'}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="업데이트" showBack />
      <PageWrapper>
        <form onSubmit={handleSubmit} className="px-4 pt-4 pb-8 space-y-5">

          {/* 📖 업데이트 메뉴얼 버튼 */}
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="w-full flex items-center justify-between
                       px-4 py-3.5 rounded-xl border border-primary/40
                       bg-primary/5 hover:bg-primary/10 active:scale-[0.98]
                       transition-all"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary">📖 업데이트 메뉴얼</span>
            </div>
            <span className="text-xs text-primary/60">바로보기 →</span>
          </button>

          {/* 업데이트 유형 */}
          <div className="space-y-1.5">
            <Label>업데이트 유형 <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-3">
              {UPDATE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update('updateType', t)}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                    form.updateType === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-foreground hover:border-primary/30'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {errors.updateType && <p className="text-xs text-destructive">{errors.updateType}</p>}
          </div>

          {/* 병원명 */}
          <div className="space-y-1.5">
            <Label>병원명 <span className="text-destructive">*</span></Label>
            <Select
              value={form.hospitalName}
              onValueChange={v => { update('hospitalName', v); update('productName', ''); }}
            >
              <SelectTrigger className={errors.hospitalName ? 'border-destructive' : ''}>
                <SelectValue placeholder="병원 선택" />
              </SelectTrigger>
              <SelectContent>
                {(hospitals || []).map(h => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.hospitalName && <p className="text-xs text-destructive">{errors.hospitalName}</p>}
          </div>

          {/* 제품명 */}
          <div className="space-y-1.5">
            <Label>제품명 <span className="text-destructive">*</span></Label>
            <Select
              value={form.productName}
              onValueChange={v => update('productName', v)}
              disabled={!form.hospitalName}
            >
              <SelectTrigger className={errors.productName ? 'border-destructive' : ''}>
                <SelectValue placeholder={form.hospitalName ? '제품 선택' : '병원 먼저 선택'} />
              </SelectTrigger>
              <SelectContent>
                {(products || []).map(p => (
                  <SelectItem key={p.제품명} value={p.제품명}>
                    {p.제품명}
                    {p.버전 ? ` (${p.버전})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productName && <p className="text-xs text-destructive">{errors.productName}</p>}

            {/* 현재 버전/만료일 표시 */}
            {selectedProduct && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 px-3 py-2.5 rounded-lg bg-muted/60 border border-border"
              >
                <p className="text-[10px] text-muted-foreground mb-1">현재 정보</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {selectedProduct.버전 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground">버전 </span>
                      <span className="text-xs font-mono font-semibold">{selectedProduct.버전}</span>
                    </div>
                  )}
                  {selectedProduct.만료일 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground">만료일 </span>
                      <span className="text-xs font-medium">{selectedProduct.만료일}</span>
                    </div>
                  )}
                  {selectedProduct.상태 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground">상태 </span>
                      <span className={`text-xs font-medium ${
                        selectedProduct.상태 === '만료' ? 'text-destructive' :
                        selectedProduct.상태 === '만료예정' ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-green-600 dark:text-green-400'
                      }`}>{selectedProduct.상태}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* 신규 버전 (제품 업데이트 시) */}
          {form.updateType === '제품 업데이트' && (
            <div className="space-y-1.5">
              <Label>신규 버전</Label>
              <Input
                placeholder="예: v2.4.0"
                value={form.newVersion}
                onChange={e => update('newVersion', e.target.value)}
                className="font-mono"
              />
            </div>
          )}

          {/* 신규 만료일 (라이선스 업데이트 시) */}
          {form.updateType === '라이선스 업데이트' && (
            <div className="space-y-1.5">
              <Label>신규 만료일</Label>
              <Input
                type="date"
                value={form.newExpiry}
                onChange={e => update('newExpiry', e.target.value)}
              />
            </div>
          )}

          {/* 처리 내용 */}
          <div className="space-y-1.5">
            <Label>처리 내용 <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="업데이트 내용, 변경사항 등을 입력하세요."
              value={form.details}
              onChange={e => update('details', e.target.value)}
              rows={4}
              className={errors.details ? 'border-destructive' : ''}
            />
            {errors.details && <p className="text-xs text-destructive">{errors.details}</p>}
          </div>

          {/* 셋팅 사진 첨부 (최대 20장) */}
          <div className="space-y-1.5">
            <Label>셋팅 사진 첨부</Label>
            <div className="bg-card border border-border rounded-xl p-4">
              <PhotoUploader
                categories={UPDATE_PHOTO_CATEGORIES}
                onChange={({ newPhotos }) => setPhotos(newPhotos)}
                maxPerCategory={10}
                unlimitedCategories={['ETC']}
                maxTotal={20}
                guideText="최대 20장까지 첨부 가능합니다. 한 번에 여러 장 선택할 수 있습니다. 사진은 구글 시트 AA열에 자동 저장됩니다."
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

          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : (isOnline ? '업데이트 저장' : '오프라인 저장')}
          </Button>
        </form>
      </PageWrapper>
      <BottomNav />

      {/* 업데이트 메뉴얼 파일 목록 바텀시트 */}
      <FileListModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="📖 업데이트 메뉴얼"
        files={manualFiles}
        loading={manualFetching}
      />
    </div>
  );
}
