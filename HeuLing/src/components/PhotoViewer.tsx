// ============================================================
// HeuLing — 사진 뷰어 컴포넌트 (썸네일 그리드 + 풀스크린 모달)
// Google Drive URL 자동 썸네일 변환 지원
// ============================================================
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ImageOff, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Google Drive URL → 썸네일/뷰 URL 변환 ───────────────────
function toThumbUrl(url: string): string {
  if (!url) return url;
  // https://drive.google.com/file/d/FILE_ID/view...
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w400`;
  // https://drive.google.com/open?id=FILE_ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w400`;
  return url;
}
function toFullUrl(url: string): string {
  if (!url) return url;
  // Drive URL → 고해상도 thumbnail (img 태그로 직접 로딩 가능)
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w2000`;
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w2000`;
  return url;
}
function toDriveViewUrl(url: string): string {
  if (!url) return url;
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/file/d/${m1[1]}/view`;
  return url;
}

interface PhotoViewerProps {
  /** 표시할 사진 URL 배열 */
  urls: string[];
  /** 그리드 컬럼 수 (기본 3) */
  cols?: 2 | 3 | 4;
  /** 썸네일 최대 표시 개수 (초과 시 +N 표시, 기본 무제한) */
  maxPreview?: number;
  /** 빈 상태 표시 여부 (기본 true) */
  showEmpty?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function PhotoViewer({
  urls,
  cols = 3,
  maxPreview,
  showEmpty = true,
  className,
}: PhotoViewerProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const colsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[cols];

  const validUrls = (urls || []).filter(Boolean);
  if (validUrls.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="flex items-center justify-center py-4 gap-2">
        <ImageOff className="w-4 h-4 text-muted-foreground/40" />
        <span className="text-xs text-muted-foreground">등록된 사진 없음</span>
      </div>
    );
  }

  const previewUrls = maxPreview ? validUrls.slice(0, maxPreview) : validUrls;
  const extraCount  = maxPreview ? Math.max(0, validUrls.length - maxPreview) : 0;

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex(i => i !== null ? Math.max(0, i - 1) : 0);
  const nextPhoto = () => setLightboxIndex(i => i !== null ? Math.min(validUrls.length - 1, i + 1) : 0);

  return (
    <>
      {/* 썸네일 그리드 */}
      <div className={cn('grid gap-1.5', colsClass, className)}>
        {previewUrls.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => openLightbox(idx)}
            className="relative aspect-square rounded-lg overflow-hidden bg-muted
                       hover:opacity-90 active:scale-[0.97] transition-all"
          >
            <img
              src={toThumbUrl(url)}
              alt={`사진 ${idx + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={e => {
                const t = e.currentTarget;
                t.style.display = 'none';
                const p = t.parentElement;
                if (p) {
                  const fallback = document.createElement('div');
                  fallback.className = 'absolute inset-0 flex items-center justify-center';
                  fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                  p.appendChild(fallback);
                }
              }}
            />
            {/* 마지막 썸네일에 +N 오버레이 */}
            {extraCount > 0 && idx === previewUrls.length - 1 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">+{extraCount}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 전체 사진 수 표시 */}
      {validUrls.length > 1 && (
        <p className="text-[10px] text-muted-foreground text-right mt-1">
          총 {validUrls.length}장
        </p>
      )}

      {/* 풀스크린 라이트박스 */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full
                       bg-white/10 hover:bg-white/20 flex items-center justify-center
                       transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Drive에서 원본 열기 */}
          <a
            href={toDriveViewUrl(validUrls[lightboxIndex])}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute top-4 right-16 z-10 w-10 h-10 rounded-full
                       bg-white/10 hover:bg-white/20 flex items-center justify-center
                       transition-colors"
            title="Drive에서 원본 열기"
          >
            <ExternalLink className="w-4 h-4 text-white" />
          </a>

          {/* 인덱스 표시 */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <span className="text-white/70 text-sm">
              {lightboxIndex + 1} / {validUrls.length}
            </span>
          </div>

          {/* 이전 버튼 */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); prevPhoto(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10
                         w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                         flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}

          {/* 이미지 */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={toFullUrl(validUrls[lightboxIndex])}
              alt={`사진 ${lightboxIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
              draggable={false}
            />
          </div>

          {/* 다음 버튼 */}
          {lightboxIndex < validUrls.length - 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); nextPhoto(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10
                         w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                         flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}

          {/* 하단 썸네일 스트립 */}
          {validUrls.length > 1 && (
            <div
              className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 px-4 overflow-x-auto"
              onClick={e => e.stopPropagation()}
            >
              {validUrls.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className={cn(
                    'flex-shrink-0 w-12 h-12 rounded overflow-hidden transition-all',
                    idx === lightboxIndex
                      ? 'ring-2 ring-white opacity-100'
                      : 'opacity-50 hover:opacity-80'
                  )}
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
