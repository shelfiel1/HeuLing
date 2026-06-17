// ============================================================
// HeuLing — 신규병원 등록 페이지 v3 (26열 완전 매핑)
// ============================================================

// ── 사진 압축 (canvas): 최대 2560px / 90% ────────────────────
async function compressImage(file: File): Promise<File> {
  const MAX_PX = 2560, QUALITY = 0.90;
  return new Promise((resolve) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const needsResize = width > MAX_PX || height > MAX_PX;
      const canvas = document.createElement('canvas');
      if (needsResize) {
        if (width >= height) { height = Math.round((height / width) * MAX_PX); width = MAX_PX; }
        else                 { width  = Math.round((width / height) * MAX_PX); height = MAX_PX; }
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file),
        'image/jpeg', QUALITY
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BookOpen, CheckCircle2, Camera, FileText,
  Plus, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import { api } from '@/api/gasClient';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { addToQueue } from '@/lib/offlineDB';
import { ROUTE_PATHS } from '@/lib/index';
import { TopBar, BottomNav, PageWrapper } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import { springPresets } from '@/lib/motion';
import { FileListModal, type ManualGroup } from '@/components/FileListModal';

// ── 옵션 상수 ───────────────────────────────────────────────
const INSTALL_TYPE_OPTIONS = ['데모', '납품', '기타'];
const CONTRACT_TYPE_OPTIONS = ['데모', '납품', '기타'];
const PRODUCT_TYPE_OPTIONS  = ['On-Premise', 'Cloud'];
const PRODUCT_OPTIONS = [
  'Heuron Stroke', 'Heuron CTP', 'Heuron IPD',
  'Heuron NI', 'Heuron AD', 'Heuron CTA', '기타',
];
const LICENSE_TYPE_OPTIONS   = ['상용', '데모'];
const LINK_METHOD_OPTIONS    = ['PACS', '라우팅', '장비수동', '장비자동'];
const REMOTE_AVAIL_OPTIONS   = ['가능', '불가능', '요청시가능', 'VPN가능'];

// 날짜 형식 검증: YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function validateDate(val: string): string | null {
  if (!val) return null;
  if (!DATE_REGEX.test(val)) return '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '유효하지 않은 날짜입니다';
  return null;
}

// 첨부 파일 아이템
interface AttachItem {
  id: string;
  name: string;
  file: File;
  preview?: string;  // 이미지인 경우 DataURL
  category?: string; // 설치사진 카테고리
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function DemoFormPage() {
  const { user } = useAuth();
  const { isOnline } = useOnline();
  const navigate = useNavigate();

  // ── 폼 상태 ──
  const [hospitalName,   setHospitalName]   = useState('');
  const [hospitalSelect,  setHospitalSelect]  = useState(''); // 드롭다운 선택용
  const [region,          setRegion]          = useState(''); // B: 행정구분
  const [installType,    setInstallType]    = useState('데모');
  const [installTypeEtc, setInstallTypeEtc] = useState('');
  const [contractType,   setContractType]   = useState('데모');
  const [contractTypeEtc,setContractTypeEtc]= useState('');
  const [productType,    setProductType]    = useState('');
  const [productName,    setProductName]    = useState('');
  const [version,        setVersion]        = useState('');
  const [licenseType,    setLicenseType]    = useState('데모');
  const [installDate,    setInstallDate]    = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate,     setExpiryDate]     = useState('');
  const [ip,             setIp]             = useState('');
  const [linkMethod,     setLinkMethod]     = useState('');
  const [deviceMaker,    setDeviceMaker]    = useState('');
  const [linkDetail,     setLinkDetail]     = useState('');
  const [userInfo,       setUserInfo]       = useState('');
  const [location,       setLocation]       = useState('');
  const [pacsVendor,     setPacsVendor]     = useState('');
  const [remoteAvail,    setRemoteAvail]    = useState('');
  const [mgmtCode,       setMgmtCode]       = useState('');
  const [memo,           setMemo]           = useState('');
  const [remoteNumber,   setRemoteNumber]   = useState('');

  // ── 설치확인서 첨부 (사진 + PDF) ──
  const [attachments, setAttachments] = useState<AttachItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef  = useRef<HTMLInputElement>(null);

  // ── 설치사진 (카테고리별) ──
  const INSTALL_PHOTO_CATEGORIES = ['설치위치', '셋팅값', 'IP', '기타'] as const;
  const INSTALL_PHOTO_LIMITS: Record<string, number> = { '설치위치': 3, '셋팅값': 10, 'IP': 3, '기타': 10 };
  type InstallCategory = typeof INSTALL_PHOTO_CATEGORIES[number];
  const [installPhotos, setInstallPhotos] = useState<AttachItem[]>([]);
  const [activeInstallCat, setActiveInstallCat] = useState<InstallCategory>('설치위치');
  const installCamRef   = useRef<HTMLInputElement>(null);
  const installGalRef   = useRef<HTMLInputElement>(null);

  const handleInstallPhotoAdd = async (files: FileList | null, category: string) => {
    if (!files) return;
    const limit = INSTALL_PHOTO_LIMITS[category] ?? 10;
    const currentCount = installPhotos.filter(p => p.category === category).length;
    const remaining = limit - currentCount;
    if (remaining <= 0) { alert(`${category} 사진은 최대 ${limit}장까지 첨부할 수 있습니다.`); return; }
    const fileArr = Array.from(files).slice(0, remaining);
    for (const file of fileArr) {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;
      const reader = new FileReader();
      reader.onload = (e) => {
        setInstallPhotos(prev => prev.map(a =>
          a.id === id ? { ...a, preview: e.target?.result as string } : a
        ));
      };
      reader.readAsDataURL(compressed);
      setInstallPhotos(prev => [...prev, { id, name: file.name, file: compressed as File, category }]);
    }
  };

  // ── 에러 ──
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── 접기/펼치기 ──
  const [extraOpen, setExtraOpen] = useState(false);

  // ── 병원목록 ──
  const { data: hospitals } = useQuery({
    queryKey: ['hospitals-simple'],
    queryFn: async () => {
      const res = await api.getHospitalList();
      return res.data?.map(h => h.hospitalName) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Q가이드 ──
  const [guideOpen, setGuideOpen] = useState(false);
  const { data: guideGroups, isFetching: guideFetching } = useQuery({
    queryKey: ['quickGuides'],
    queryFn: async () => {
      const res = await api.getQuickGuides();
      if (!res.success) throw new Error(String(res.error));
      return (res.data || []) as ManualGroup[];
    },
    enabled: guideOpen,
    staleTime: 5 * 60 * 1000,
  });

  // ── 성공 상태 ──
  const [isSuccess, setIsSuccess] = useState(false);

  // ── 파일 첨부 핸들러 ──
  const handleFileAdd = async (files: FileList | null) => {
    if (!files) return;
    const photoCount = attachments.filter(a => a.file.type.startsWith('image/')).length;
    const pdfCount   = attachments.filter(a => a.file.type === 'application/pdf').length;
    const items: AttachItem[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/') && photoCount + items.filter(a => a.file.type.startsWith('image/')).length >= 3) {
        alert('설치확인서 사진은 최대 3장까지 첨부할 수 있습니다.'); continue;
      }
      if (file.type === 'application/pdf' && pdfCount + items.filter(a => a.file.type === 'application/pdf').length >= 3) {
        alert('설치확인서 PDF는 최대 3개까지 첨부할 수 있습니다.'); continue;
      }
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const processed = file.type.startsWith('image/') ? await compressImage(file) : file;
      if (processed.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments(prev => prev.map(a =>
            a.id === id ? { ...a, preview: e.target?.result as string } : a
          ));
        };
        reader.readAsDataURL(processed);
      }
      items.push({ id, name: file.name, file: processed as File });
    }
    setAttachments(prev => [...prev, ...items]);
  };

  const handleRemoveAttach = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // ── 유효성 검사 ──
  const validate = () => {
    const e: Record<string, string> = {};
    if (!hospitalName.trim() && !hospitalSelect.trim()) e.hospitalName = '병원명을 입력하세요.';
    if (!productName)         e.productName  = '제품명을 선택하세요.';
    if (!version.trim())      e.version      = '버전을 입력하세요.';
    const instErr = validateDate(installDate);
    if (instErr) e.installDate = instErr;
    if (expiryDate) {
      const expErr = validateDate(expiryDate);
      if (expErr) e.expiryDate = expErr;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── 제출 뮤테이션 ──
  const mutation = useMutation({
    mutationFn: async () => {
      const resolvedInstallType  = installType  === '기타' ? installTypeEtc  : installType;
      const resolvedContractType = contractType === '기타' ? contractTypeEtc : contractType;

      const payload = {
        hospitalName:    (hospitalName.trim() || hospitalSelect.trim()),
        region:          region.trim(),
        installType:     resolvedInstallType,
        contractType:    resolvedContractType,
        productType,
        productName,
        version:         version.trim(),
        licenseType,
        installDate,
        expiryDate:      expiryDate || undefined,
        handlerName:     user?.name || '',
        ip:              ip.trim(),
        linkMethod,
        deviceMaker:     deviceMaker.trim(),
        linkDetail:      linkDetail.trim(),
        userInfo:        userInfo.trim(),
        location:        location.trim(),
        pacsVendor:      pacsVendor.trim(),
        remoteAvailable: remoteAvail,
        mgmtCode:        mgmtCode.trim(),
        memo:            memo.trim(),
        remoteNumber:    remoteNumber.trim(),
        photos: attachments.map(a => ({
          category: a.file.type === 'application/pdf' ? 'PDF' : 'CERT',
          file:     a.file,
          name:     a.name,
        })),
        installPhotos: installPhotos.map(a => ({
          category: (a as AttachItem & { category?: string }).category || '기타',
          file:     a.file,
          name:     a.name,
        })),
      };

      if (!isOnline) {
        await addToQueue('registerDemo', payload as unknown as Record<string, unknown>);
        return;
      }
      const res = await api.registerDemo(payload);
      if (!res.success) throw new Error(String(res.error) || '등록 실패');
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

  // ── 성공 화면 ──
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
          <p className="font-semibold">신규병원 등록 완료!</p>
          <p className="text-sm text-muted-foreground">
            {!isOnline ? '오프라인 저장됨' : '구글 시트에 저장되었습니다.'}
          </p>
        </motion.div>
      </div>
    );
  }

  // ── 렌더 ──
  return (
    <div className="min-h-screen bg-background">
      <TopBar title="신규병원 등록 (데모/상용)" showBack />
      <PageWrapper>
        <form onSubmit={handleSubmit} className="px-4 pt-4 pb-8 space-y-5">

          {/* 📖 Q가이드 버튼 */}
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="w-full flex items-center justify-between
                       px-4 py-3.5 rounded-xl border border-primary/40
                       bg-primary/5 hover:bg-primary/10 active:scale-[0.98]
                       transition-all"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary">📖 Q가이드 (제품별 매뉴얼)</span>
            </div>
            <span className="text-xs text-primary/60">바로보기 →</span>
          </button>

          {/* ── 행정구분 ── */}
          <div className="space-y-1.5">
            <Label>행정구분</Label>
            <Input
              placeholder="예: 서울특별시, 경기도 등"
              value={region}
              onChange={e => setRegion(e.target.value)}
            />
          </div>

          {/* ── 병원명 ── */}
          <div className="space-y-1.5">
            <Label>병원명 <span className="text-destructive">*</span></Label>
            <Select
              value={hospitalSelect}
              onValueChange={v => { setHospitalSelect(v); setHospitalName(''); }}
            >
              <SelectTrigger className={errors.hospitalName ? 'border-destructive' : ''}>
                <SelectValue placeholder="기존 병원 선택" />
              </SelectTrigger>
              <SelectContent>
                {(hospitals || []).map(h => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="신규 병원명 직접 입력"
              value={hospitalName}
              onChange={e => { setHospitalName(e.target.value); setHospitalSelect(''); }}
              className="mt-1"
            />
            {errors.hospitalName && <p className="text-xs text-destructive">{errors.hospitalName}</p>}
          </div>

          {/* ── 설치유형 / 계약유형 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>설치유형</Label>
              <Select value={installType} onValueChange={v => setInstallType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSTALL_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              {installType === '기타' && (
                <Input
                  placeholder="직접 입력"
                  value={installTypeEtc}
                  onChange={e => setInstallTypeEtc(e.target.value)}
                  className="mt-1"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>계약유형</Label>
              <Select value={contractType} onValueChange={v => setContractType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              {contractType === '기타' && (
                <Input
                  placeholder="직접 입력"
                  value={contractTypeEtc}
                  onChange={e => setContractTypeEtc(e.target.value)}
                  className="mt-1"
                />
              )}
            </div>
          </div>

          {/* ── 제품유형 / 라이선스유형 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>제품유형</Label>
              <Select value={productType} onValueChange={v => setProductType(v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>라이선스유형</Label>
              <Select value={licenseType} onValueChange={v => setLicenseType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSE_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── 제품명 / 버전 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>제품명 <span className="text-destructive">*</span></Label>
              <Select value={productName} onValueChange={v => setProductName(v)}>
                <SelectTrigger className={errors.productName ? 'border-destructive' : ''}>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.productName && <p className="text-xs text-destructive">{errors.productName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>버전 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="예: v2.3.1"
                value={version}
                onChange={e => setVersion(e.target.value)}
                className={`font-mono ${errors.version ? 'border-destructive' : ''}`}
              />
              {errors.version && <p className="text-xs text-destructive">{errors.version}</p>}
            </div>
          </div>

          {/* ── 최초설치날짜 / 라이선스만료일 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>최초설치날짜 <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={installDate}
                onChange={e => setInstallDate(e.target.value)}
                className={errors.installDate ? 'border-destructive' : ''}
              />
              {errors.installDate && <p className="text-xs text-destructive">{errors.installDate}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>라이선스만료일</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className={errors.expiryDate ? 'border-destructive' : ''}
              />
              {errors.expiryDate && <p className="text-xs text-destructive">{errors.expiryDate}</p>}
            </div>
          </div>

          {/* ── 담당자 (자동) ── */}
          <div className="space-y-1.5">
            <Label>주담당자</Label>
            <Input
              value={user?.name || ''}
              readOnly
              className="bg-muted/50 text-muted-foreground cursor-default"
            />
          </div>

          {/* ── IP주소 ── */}
          <div className="space-y-1.5">
            <Label>IP주소</Label>
            <Input
              placeholder="예: 192.168.1.100"
              value={ip}
              onChange={e => setIp(e.target.value)}
              className="font-mono"
            />
          </div>

          {/* ── 연동방식 / 원격가능 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>연동방식</Label>
              <Select value={linkMethod} onValueChange={v => setLinkMethod(v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {LINK_METHOD_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>원격가능</Label>
              <Select value={remoteAvail} onValueChange={v => setRemoteAvail(v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {REMOTE_AVAIL_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── 설치확인서 (사진 + PDF 첨부) ── */}
          <div className="space-y-2">
            <Label>설치확인서 (사진·PDF)</Label>
            <p className="text-xs text-muted-foreground">사진 최대 3장 · PDF 최대 3개 첨부 가능</p>
            {/* 숨겨진 파일 input들 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={e => handleFileAdd(e.target.files)}
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={e => handleFileAdd(e.target.files)}
            />
            {/* 첨부 버튼들 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.setAttribute('capture', 'environment');
                    fileInputRef.current.click();
                  }
                }}
                className="flex items-center justify-center gap-2 py-3 rounded-xl
                           border border-dashed border-border hover:border-primary/50
                           bg-muted/30 hover:bg-primary/5 transition-all text-sm"
              >
                <Camera className="w-4 h-4" />
                카메라
              </button>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl
                           border border-dashed border-border hover:border-primary/50
                           bg-muted/30 hover:bg-primary/5 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                사진첩·PDF
              </button>
            </div>
            {/* 첨부 목록 */}
            {attachments.length > 0 && (
              <div className="space-y-2 mt-1">
                {attachments.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 border border-border"
                  >
                    {a.preview ? (
                      <img src={a.preview} alt={a.name}
                           className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-xs text-foreground truncate flex-1">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttach(a.id)}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 설치 및 셋팅 사진 ── */}
          <div className="space-y-2">
            <Label>설치 및 셋팅 사진</Label>
            <p className="text-xs text-muted-foreground">설치위치·IP 최대 3장 · 셋팅값·기타 최대 10장</p>
            {/* 숨겨진 input */}
            <input
              ref={installCamRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={e => handleInstallPhotoAdd(e.target.files, activeInstallCat)}
            />
            <input
              ref={installGalRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleInstallPhotoAdd(e.target.files, activeInstallCat)}
            />
            {/* 카테고리 탭 */}
            <div className="flex gap-1.5 flex-wrap">
              {INSTALL_PHOTO_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveInstallCat(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeInstallCat === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {cat}
                  {installPhotos.filter(p => p.category === cat).length > 0 && (
                    <span className="ml-1 bg-white/30 rounded-full px-1">
                      {installPhotos.filter(p => p.category === cat).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* 첨부 버튼 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => installCamRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl
                           border border-dashed border-border hover:border-primary/50
                           bg-muted/30 hover:bg-primary/5 transition-all text-sm"
              >
                <Camera className="w-4 h-4" />
                카메라
              </button>
              <button
                type="button"
                onClick={() => installGalRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl
                           border border-dashed border-border hover:border-primary/50
                           bg-muted/30 hover:bg-primary/5 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                사진첩
              </button>
            </div>
            {/* 현재 선택된 카테고리 사진 목록 */}
            {installPhotos.filter(a => a.category === activeInstallCat).length > 0 && (
              <div className="space-y-2 mt-1">
                {installPhotos
                  .filter(a => a.category === activeInstallCat)
                  .map(a => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 border border-border"
                    >
                      {a.preview ? (
                        <img src={a.preview} alt={a.name}
                             className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-xs text-foreground truncate flex-1">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setInstallPhotos(prev => prev.filter(p => p.id !== a.id))}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* ── 추가 항목 접기/펼치기 ── */}
          <button
            type="button"
            onClick={() => setExtraOpen(v => !v)}
            className="w-full flex items-center justify-between
                       px-4 py-3 rounded-xl border border-border
                       bg-muted/20 hover:bg-muted/40 transition-all text-sm font-medium"
          >
            <span>추가 항목 {extraOpen ? '접기' : '펼치기'}</span>
            {extraOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {extraOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springPresets.gentle}
              className="space-y-4"
            >
              {/* 장비제조사 */}
              <div className="space-y-1.5">
                <Label>장비제조사</Label>
                <Input placeholder="예: GE" value={deviceMaker} onChange={e => setDeviceMaker(e.target.value)} />
              </div>

              {/* 상세연동내역 */}
              <div className="space-y-1.5">
                <Label>상세연동내역</Label>
                <Textarea placeholder="예: PACS → AI 서버 단방향" rows={2}
                  value={linkDetail} onChange={e => setLinkDetail(e.target.value)} />
              </div>

              {/* 사용자/담당자정보 */}
              <div className="space-y-1.5">
                <Label>사용자/담당자정보</Label>
                <Input placeholder="예: 판독실 김OO 02-1234-5678" value={userInfo} onChange={e => setUserInfo(e.target.value)} />
              </div>

              {/* 설치장소 */}
              <div className="space-y-1.5">
                <Label>설치장소</Label>
                <Input placeholder="예: 영상의학과 서버실" value={location} onChange={e => setLocation(e.target.value)} />
              </div>

              {/* PACS업체정보 */}
              <div className="space-y-1.5">
                <Label>PACS업체정보</Label>
                <Input placeholder="예: 인피니트헬스케어" value={pacsVendor} onChange={e => setPacsVendor(e.target.value)} />
              </div>

              {/* 관리코드 */}
              <div className="space-y-1.5">
                <Label>관리코드</Label>
                <Input placeholder="예: TE-001" value={mgmtCode} onChange={e => setMgmtCode(e.target.value)} className="font-mono" />
              </div>

              {/* 원격번호 */}
              <div className="space-y-1.5">
                <Label>원격번호</Label>
                <Input placeholder="예: 123 456 789" value={remoteNumber} onChange={e => setRemoteNumber(e.target.value)} className="font-mono" />
              </div>

              {/* 비고 */}
              <div className="space-y-1.5">
                <Label>비고</Label>
                <Textarea placeholder="특이사항, 기타 메모 등" rows={3}
                  value={memo} onChange={e => setMemo(e.target.value)} />
              </div>
            </motion.div>
          )}

          {/* 에러 / 오프라인 알림 */}
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

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? '저장 중...' : (isOnline ? '신규병원 등록' : '오프라인 저장')}
          </Button>
        </form>
      </PageWrapper>
      <BottomNav />

      {/* Q가이드 모달 */}
      <FileListModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="📖 Q가이드 — 제품별 매뉴얼"
        groups={guideGroups}
        loading={guideFetching}
      />
    </div>
  );
}
