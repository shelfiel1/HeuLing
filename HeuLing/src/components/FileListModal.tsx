// ============================================================
// HeuLing — 매뉴얼 파일 목록 바텀시트 컴포넌트
// ============================================================
import { FileText, Presentation, X, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ManualFile = {
  name: string;
  url: string;
  mimeType: string;
};

export type ManualGroup = {
  folder: string;
  files: ManualFile[];
};

interface FileListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Q가이드: 그룹 형태 */
  groups?: ManualGroup[];
  /** 업데이트 메뉴얼: 단순 목록 */
  files?: ManualFile[];
  loading?: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return <FileText className="w-5 h-5 text-red-500 shrink-0" />;
  }
  return <Presentation className="w-5 h-5 text-orange-500 shrink-0" />;
}

function getFileLabel(mimeType: string) {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PPT';
  return 'FILE';
}

function FileItem({ file }: { file: ManualFile }) {
  return (
    <button
      onClick={() => window.open(file.url, '_blank')}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                 bg-card border border-border hover:border-primary/40
                 hover:bg-primary/5 active:scale-[0.98] transition-all text-left"
    >
      {getFileIcon(file.mimeType)}
      <span className="flex-1 text-sm font-medium leading-tight break-words">
        {file.name.replace(/\.(pdf|pptx?|ppt)$/i, '')}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded
                         bg-muted text-muted-foreground">
          {getFileLabel(file.mimeType)}
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    </button>
  );
}

function FolderGroup({ group }: { group: ManualGroup }) {
  const [open, setOpen] = useState(true);

  // 폴더명 → 제품 표시명
  const folderLabel = group.folder
    .replace('공통', '📄 공통')
    .replace('SCS', '🧠 SCS (StroCare)')
    .replace('AD', '🔬 AD')
    .replace('PD', '🟡 PD (IPD/NI)')
    .replace('CTP', '🩸 CTP')
    .replace('CTA', '🔴 CTA')
    .replace('BrainPET', '💜 BrainPET');

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                   hover:bg-muted/50 transition-colors"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <span className="text-sm font-semibold text-foreground">{folderLabel}</span>
        <span className="ml-auto text-xs text-muted-foreground">{group.files.length}개</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-2 space-y-1.5"
          >
            {group.files.map(f => (
              <FileItem key={f.url} file={f} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FileListModal({
  open, onClose, title, groups, files, loading,
}: FileListModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 배경 딤 */}
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* 바텀시트 */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50
                       bg-background rounded-t-3xl shadow-2xl
                       max-h-[82vh] flex flex-col"
          >
            {/* 핸들 */}
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-1 shrink-0" />

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <h2 className="text-base font-bold">{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 컨텐츠 */}
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
              {loading && (
                <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
                  불러오는 중...
                </div>
              )}

              {!loading && groups && groups.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  파일이 없습니다.
                </div>
              )}

              {!loading && groups && groups.map(g => (
                <FolderGroup key={g.folder} group={g} />
              ))}

              {!loading && files && files.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  파일이 없습니다.
                </div>
              )}

              {!loading && files && files.map(f => (
                <FileItem key={f.url} file={f} />
              ))}

              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
