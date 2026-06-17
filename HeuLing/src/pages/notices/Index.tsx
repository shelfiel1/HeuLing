// ============================================================
// HeuLing — 공지사항 & 엔지니어 공유 페이지 v9
// 공지사항(일반/업무/기타) | 엔지니어공유(SW/HW/OS/고객관리/기타)
// 읽기 전용 — 구글 시트에서만 입력
// ============================================================
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, ChevronDown, Loader2, Building2 } from 'lucide-react';
import { api } from '@/api/gasClient';
import { TopBar, BottomNav, PageWrapper } from '@/components/Layout';
import { cn } from '@/lib/utils';
import { springPresets } from '@/lib/motion';

// ─── 타입 ────────────────────────────────────────────────────
type NoticeItem = {
  no: string;
  항목: string;
  type: 'notice' | 'engineer';
  날짜: string;
  최상단노출: boolean;
  병원명: string;
  작성자: string;
  구분: string;
  내용: string;
  상세내용: string;
};

// ─── 항목별 스타일 ────────────────────────────────────────────
const ITEM_STYLE: Record<string, { color: string; emoji: string }> = {
  '일반공지':  { color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',   emoji: '📢' },
  '업무공지':  { color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30', emoji: '📋' },
  '기타공지':  { color: 'bg-gray-400/10 text-gray-600 dark:text-gray-400 border-gray-400/30',    emoji: '📌' },
  'SW이슈':   { color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30', emoji: '💻' },
  'HW이슈':   { color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30', emoji: '🔧' },
  'OS이슈':   { color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',    emoji: '🖥️' },
  '고객관리':  { color: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30',    emoji: '🏥' },
  '기타이슈':  { color: 'bg-muted text-muted-foreground border-muted-foreground/30',              emoji: '⚙️' },
};

function getItemStyle(항목: string) {
  return ITEM_STYLE[항목] ?? { color: 'bg-muted text-muted-foreground border-muted-foreground/30', emoji: '📄' };
}

// ─── 공지 탭 서브 필터 ────────────────────────────────────────
const NOTICE_FILTERS  = ['전체', '일반공지', '업무공지', '기타공지'] as const;
const ENGINEER_FILTERS = ['전체', 'SW이슈', 'HW이슈', 'OS이슈', '고객관리', '기타이슈'] as const;

// ─── 단일 카드 ────────────────────────────────────────────────
function NoticeCard({ item }: { item: NoticeItem }) {
  const [expanded, setExpanded] = useState(false);
  const style = getItemStyle(item.항목);
  const hasDetail = !!item.상세내용.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springPresets.gentle}
      className={cn(
        'bg-card border rounded-xl overflow-hidden',
        item.최상단노출 ? 'border-primary/40 shadow-sm' : 'border-border'
      )}
    >
      <div
        className="px-4 py-3 space-y-2"
        onClick={() => hasDetail && setExpanded(v => !v)}
      >
        {/* 상단 행 */}
        <div className="flex items-start gap-2">
          {item.최상단노출 && (
            <Pin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          )}
          <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0', style.color)}>
            {style.emoji} {item.항목}
          </span>
          {item.구분 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
              {item.구분}
            </span>
          )}
          <div className="flex-1" />
          {hasDetail && (
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')} />
          )}
        </div>

        {/* 내용 */}
        <p className={cn(
          'text-sm text-foreground leading-snug',
          !expanded && 'line-clamp-2'
        )}>
          {item.내용 || '(내용 없음)'}
        </p>

        {/* 메타 정보 */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{item.날짜 || ''}</span>
          {item.작성자 && (
            <>
              <span>·</span>
              <span>{item.작성자}</span>
            </>
          )}
          {item.병원명 && item.type === 'engineer' && (
            <>
              <span>·</span>
              <Building2 className="w-3 h-3" />
              <span>{item.병원명}</span>
            </>
          )}
        </div>
      </div>

      {/* 상세내용 펼치기 */}
      <AnimatePresence>
        {expanded && hasDetail && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1 font-medium">상세내용</p>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {item.상세내용}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function NoticesPage() {
  const [mainTab, setMainTab] = useState<'notice' | 'engineer'>('notice');
  const [noticeFilter, setNoticeFilter]   = useState<typeof NOTICE_FILTERS[number]>('전체');
  const [engineerFilter, setEngineerFilter] = useState<typeof ENGINEER_FILTERS[number]>('전체');

  const { data, isLoading } = useQuery({
    queryKey: ['notices', 'all'],
    queryFn: async () => {
      const res = await api.getNotices('all');
      return (res.data || []) as NoticeItem[];
    },
    staleTime: 3 * 60 * 1000,
  });

  const allNotices  = (data || []).filter(d => d.type === 'notice');
  const allEngineer = (data || []).filter(d => d.type === 'engineer');

  const noticeCount   = allNotices.length;
  const engineerCount = allEngineer.length;

  const filteredNotice  = noticeFilter  === '전체' ? allNotices  : allNotices.filter(d => d.항목 === noticeFilter);
  const filteredEngineer = engineerFilter === '전체' ? allEngineer : allEngineer.filter(d => d.항목 === engineerFilter);

  const currentItems = mainTab === 'notice' ? filteredNotice : filteredEngineer;

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="🔔 공지사항" />
      <PageWrapper>
        <div className="pb-28">

          {/* ── 메인 탭 ── */}
          <div className="flex border-b border-border sticky top-14 bg-background/95 z-10">
            {([
              { key: 'notice' as const,   label: '공지사항',     count: noticeCount },
              { key: 'engineer' as const, label: '엔지니어 공유', count: engineerCount },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setMainTab(tab.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative',
                  mainTab === tab.key
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                    mainTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {tab.count}
                  </span>
                )}
                {mainTab === tab.key && (
                  <motion.div
                    layoutId="notice-tab-indicator"
                    className="absolute bottom-0 inset-x-4 h-0.5 bg-primary rounded-full"
                    transition={springPresets.snappy}
                  />
                )}
              </button>
            ))}
          </div>

          {/* ── 서브 필터 ── */}
          <div className="px-4 py-2 overflow-x-auto">
            <div className="flex gap-2 w-max">
              {(mainTab === 'notice' ? NOTICE_FILTERS : ENGINEER_FILTERS).map(f => {
                const active = mainTab === 'notice' ? noticeFilter === f : engineerFilter === f;
                const style = f !== '전체' ? getItemStyle(f) : null;
                return (
                  <button
                    key={f}
                    onClick={() => {
                      if (mainTab === 'notice') setNoticeFilter(f as typeof NOTICE_FILTERS[number]);
                      else setEngineerFilter(f as typeof ENGINEER_FILTERS[number]);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
                      active
                        ? (style ? style.color + ' border-current' : 'bg-primary text-primary-foreground border-primary')
                        : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30'
                    )}
                  >
                    {f !== '전체' && style?.emoji} {f}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 목록 ── */}
          <div className="px-4 space-y-3 pt-2">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && currentItems.length === 0 && (
              <div className="text-center py-16 space-y-2">
                <p className="text-4xl">🔔</p>
                <p className="text-sm text-muted-foreground">등록된 내용이 없습니다.</p>
                <p className="text-xs text-muted-foreground/60">구글 시트에서 입력 후 확인하세요.</p>
              </div>
            )}

            {!isLoading && currentItems.map((item, i) => (
              <NoticeCard key={`${item.no}-${i}`} item={item} />
            ))}
          </div>
        </div>
      </PageWrapper>
      <BottomNav />
    </div>
  );
}
