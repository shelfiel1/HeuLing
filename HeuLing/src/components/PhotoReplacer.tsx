// ══════════════════════════════════════════════════════════════════
// PhotoReplacer.tsx — 범용 사진 교체 컴포넌트
// 사용법: 영수증, CS, 제품현황 등 어디서든 사용 가능
//
// import PhotoReplacer from '@/components/PhotoReplacer';
//
// <PhotoReplacer
//   currentUrl="https://drive.google.com/uc?export=view&id=..."
//   currentFileId="파일ID"
//   sheetType="receipt"          // 'receipt'|'domestic'|'cs'|'custom'
//   rowIndex={5}
//   fileIdCol={10}               // sheetType='receipt'이면 생략 가능
//   fileNameCol={11}
//   fileUrlCol={12}
//   folderHint="receipt_김성환_2026-06"  // 선택사항
//   onSuccess={(newUrl) => console.log(newUrl)}
// />
// ══════════════════════════════════════════════════════════════════
import React, { useRef, useState } from 'react';

import { GAS_API_URL } from '@/lib/index';
const GAS_URL = GAS_API_URL;

interface PhotoReplacerProps {
  currentUrl:   string;
  currentFileId?: string;
  sheetType:    'receipt' | 'domestic' | 'cs' | 'custom';
  rowIndex:     number;
  sheetName?:   string;       // sheetType='custom'일 때 필수
  fileIdCol?:   number;
  fileNameCol?: number;
  fileUrlCol?:  number;
  folderHint?:  string;
  maxSizeKB?:   number;       // 기본값 없음 (무압축). 숫자 지정 시 압축
  onSuccess?:   (newUrl: string) => void;
  onClose?:     () => void;
}

// ── 이미지 리사이즈 (선택적) ─────────────────────────────────────
async function resizeIfNeeded(
  file: File,
  maxSizeKB: number | undefined
): Promise<{ base64: string; mimeType: string; fileName: string }> {
  const mimeType = file.type || 'image/jpeg';
  const fileName = file.name;

  // 스캔 문서 등: maxSizeKB 미지정 시 원본 그대로 (무압축)
  if (!maxSizeKB) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1];
        resolve({ base64: b64, mimeType, fileName });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 압축 필요 시 Canvas로 리사이즈
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const canvas = document.createElement('canvas');
      let quality = 0.92;

      // 목표 크기에 맞게 반복 축소
      const tryCompress = () => {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
        if (sizeKB <= maxSizeKB || quality <= 0.3) {
          resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', fileName: fileName.replace(/\.[^.]+$/, '.jpg') });
        } else if (quality > 0.5) {
          quality -= 0.1;
          tryCompress();
        } else {
          width = Math.round(width * 0.8);
          height = Math.round(height * 0.8);
          quality = 0.85;
          tryCompress();
        }
      };
      tryCompress();
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── GAS 호출 ─────────────────────────────────────────────────────
async function callGAS(action: string, payload: object): Promise<{ success: boolean; data?: any; error?: string }> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

// ── 컴포넌트 본체 ────────────────────────────────────────────────
export default function PhotoReplacer({
  currentUrl,
  currentFileId,
  sheetType,
  rowIndex,
  sheetName,
  fileIdCol,
  fileNameCol,
  fileUrlCol,
  folderHint,
  maxSizeKB,
  onSuccess,
  onClose,
}: PhotoReplacerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelected(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setMsg('');
  };

  const handleReplace = async () => {
    if (!selected) return;
    setLoading(true);
    setMsg('');
    try {
      const { base64, mimeType, fileName } = await resizeIfNeeded(selected, maxSizeKB);
      const result = await callGAS('replacePhoto', {
        sheetType,
        rowIndex,
        sheetName,
        fileIdCol,
        fileNameCol,
        fileUrlCol,
        oldFileId:      currentFileId || '',
        newFileBase64:  base64,
        newFileName:    fileName,
        newMimeType:    mimeType,
        folderHint:     folderHint || '',
      });
      if (result.success) {
        setMsg('✅ 사진 교체 완료!');
        onSuccess?.(result.data.newFileUrl);
      } else {
        setMsg('❌ 실패: ' + result.error);
      }
    } catch (err: any) {
      setMsg('❌ 오류: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between rounded-t-2xl bg-blue-800 px-4 py-3">
          <span className="font-bold text-white">📷 사진 교체</span>
          {onClose && (
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">×</button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* 현재 사진 */}
          <div>
            <p className="text-xs text-gray-500 mb-1">현재 사진</p>
            {currentUrl ? (
              <img src={currentUrl} alt="현재" className="w-full max-h-40 object-contain rounded border bg-gray-50" />
            ) : (
              <div className="w-full h-24 flex items-center justify-center rounded border bg-gray-50 text-gray-400 text-sm">사진 없음</div>
            )}
          </div>

          {/* 새 사진 선택 */}
          <div>
            <p className="text-xs text-gray-500 mb-1">새 사진 선택</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 text-sm hover:bg-blue-50 transition"
            >
              📁 파일 선택 (카메라 / 갤러리 / 스캔)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {maxSizeKB ? `압축 기준: ${maxSizeKB}KB` : '원본 해상도 그대로 저장 (스캔 문서 권장)'}
            </p>
          </div>

          {/* 미리보기 */}
          {preview && (
            <div>
              <p className="text-xs text-gray-500 mb-1">새 사진 미리보기</p>
              <img src={preview} alt="새 사진" className="w-full max-h-48 object-contain rounded border bg-gray-50" />
            </div>
          )}

          {/* 메시지 */}
          {msg && (
            <p className={`text-sm text-center font-medium ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            {onClose && (
              <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">
                취소
              </button>
            )}
            <button
              onClick={handleReplace}
              disabled={!selected || loading}
              className="flex-1 py-2 rounded-lg bg-blue-700 text-white text-sm font-bold disabled:opacity-40 hover:bg-blue-800 transition"
            >
              {loading ? '교체 중...' : '사진 교체하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
