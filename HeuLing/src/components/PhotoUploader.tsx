// ============================================================
// HeuLing — 사진 첨부 컴포넌트 v4
// 카메라 촬영 + 앨범 선택 분리 지원
// 사진 압축: 2560px / 90% 품질 (화질 보존)
// ============================================================
import { useState, useRef } from 'react';
import { Camera, ImageIcon, X, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewPhoto {
  kind: 'new';
  category: string;
  file: File;
  preview: string;
}
interface ExistingPhoto {
  kind: 'existing';
  category: string;
  url: string;
}
type PhotoItem = NewPhoto | ExistingPhoto;

export interface PhotoUploaderProps {
  categories: { key: string; label: string }[];
  /** 기존 등록된 사진 URLs (수정 모드에서 사용) */
  initialExisting?: { url: string; category: string }[];
  onChange: (payload: {
    newPhotos: { category: string; file: File }[];
    deletedUrls: string[];
    remainingUrls: string[];
  }) => void;
  maxPerCategory?: number;
  unlimitedCategories?: string[];
  maxTotal?: number;
  guideText?: string;
}

// ── 사진 압축 (canvas): 최대 2560px, 90% 품질 ─────────────
async function compressImage(file: File): Promise<File> {
  const MAX_PX = 2560;
  const QUALITY = 0.90;

  return new Promise((resolve) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // 리사이즈 필요 여부 판단
      const needsResize = width > MAX_PX || height > MAX_PX;
      if (!needsResize) {
        // 압축만
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          },
          'image/jpeg',
          QUALITY
        );
        return;
      }
      // 비율 유지 리사이즈
      if (width >= height) {
        height = Math.round((height / width) * MAX_PX);
        width  = MAX_PX;
      } else {
        width  = Math.round((width / height) * MAX_PX);
        height = MAX_PX;
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export function PhotoUploader({
  categories,
  initialExisting = [],
  onChange,
  maxPerCategory = 10,
  unlimitedCategories = [],
  maxTotal,
  guideText,
}: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    initialExisting.map(e => ({ kind: 'existing', category: e.category || categories[0]?.key || '', url: e.url }))
  );
  const [deletedUrls, setDeletedUrls] = useState<string[]>([]);
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.key || '');
  const [compressing,    setCompressing]    = useState(false);

  const isUnlimited = (key: string) => unlimitedCategories.includes(key);
  const getLimit    = (key: string) => isUnlimited(key) ? Infinity : maxPerCategory;

  const notify = (next: PhotoItem[], nextDeleted: string[]) => {
    onChange({
      newPhotos:     next.filter((p): p is NewPhoto      => p.kind === 'new').map(p => ({ category: p.category, file: p.file })),
      deletedUrls:   nextDeleted,
      remainingUrls: next.filter((p): p is ExistingPhoto => p.kind === 'existing').map(p => p.url),
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const catPhotos = photos.filter(p => p.category === activeCategory);
    const limit     = getLimit(activeCategory);
    const remaining = limit === Infinity ? files.length : Math.max(0, limit - catPhotos.length);
    let toAdd = files.slice(0, remaining);
    if (maxTotal !== undefined) {
      const totalRemaining = maxTotal - photos.length;
      toAdd = toAdd.slice(0, Math.max(0, totalRemaining));
    }

    setCompressing(true);
    try {
      const compressedFiles = await Promise.all(toAdd.map(f => compressImage(f)));
      const newItems: NewPhoto[] = compressedFiles.map(file => ({
        kind: 'new',
        category: activeCategory,
        file,
        preview: URL.createObjectURL(file),
      }));
      const updated = [...photos, ...newItems];
      setPhotos(updated);
      notify(updated, deletedUrls);
    } finally {
      setCompressing(false);
    }

    // input 초기화 (같은 파일 재선택 가능)
    if (cameraInputRef.current)  cameraInputRef.current.value  = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    const target = photos[idx];
    const updated = photos.filter((_, i) => i !== idx);
    let nextDeleted = deletedUrls;
    if (target.kind === 'existing') {
      nextDeleted = [...deletedUrls, target.url];
      setDeletedUrls(nextDeleted);
    }
    setPhotos(updated);
    notify(updated, nextDeleted);
  };

  const currentCatPhotos = photos.map((p, i) => ({ p, i })).filter(({ p }) => p.category === activeCategory);
  const limit  = getLimit(activeCategory);
  const canAdd = maxTotal !== undefined
    ? photos.length < maxTotal
    : limit === Infinity || currentCatPhotos.length < limit;

  return (
    <div className="space-y-3">
      {guideText && (
        <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
          <span className="text-blue-500 text-sm mt-0.5">ℹ</span>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{guideText}</p>
        </div>
      )}

      {/* 카테고리 탭 */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => {
            const cnt = photos.filter(p => p.category === cat.key).length;
            return (
              <button key={cat.key} type="button" onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                  activeCategory === cat.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {cat.label}{cnt > 0 && <span className="ml-1 opacity-70">({cnt})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* 장수 표시 */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs text-muted-foreground">
          {currentCatPhotos.length}장
          {limit !== Infinity && ` / 최대 ${limit}장`}
          {isUnlimited(activeCategory) && ' (제한 없음)'}
        </span>
        {maxTotal !== undefined && (
          <span className="text-xs text-muted-foreground">전체 {photos.length}/{maxTotal}장</span>
        )}
      </div>

      {/* 사진 그리드 */}
      <div className="grid grid-cols-3 gap-2">
        {currentCatPhotos.map(({ p, i }) => {
          const src = p.kind === 'new' ? p.preview : p.url;
          return (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              <img src={src} alt="" className="w-full h-full object-cover" />
              {p.kind === 'existing' && (
                <span className="absolute bottom-1 left-1 text-[8px] bg-black/50 text-white px-1 rounded">저장됨</span>
              )}
              <button type="button" onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          );
        })}
      </div>

      {photos.length === 0 && !compressing && (
        <div className="text-center py-3">
          <Image className="w-8 h-8 text-muted-foreground/40 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">사진을 추가하세요</p>
        </div>
      )}

      {/* 압축 중 표시 */}
      {compressing && (
        <div className="flex items-center justify-center gap-2 py-3">
          <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-xs text-muted-foreground">사진 최적화 중...</p>
        </div>
      )}

      {/* 카메라 / 앨범 선택 버튼 */}
      {canAdd && !compressing && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all"
          >
            <Camera className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary">카메라 촬영</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/50 hover:bg-muted active:scale-[0.98] transition-all"
          >
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">앨범 선택</span>
          </button>
        </div>
      )}

      {/* 카메라 전용 input (capture="environment") */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* 갤러리 전용 input (capture 없음 → 앨범 열림) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
