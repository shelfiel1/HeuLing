// ============================================================
// HeuLing — 릴리즈 노트 페이지 v5 (Web 핵심 제품 고정 정렬)
// ============================================================
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, ExternalLink, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { api, type ReleaseItem } from '@/api/gasClient';
import { TopBar, BottomNav, PageWrapper, CardSkeleton, ErrorState } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

type CategoryTab = 'All' | 'Web' | 'Engine' | 'OnPremise' | 'Infra' | 'Other';

// 모든 탭에서 항상 맨 앞에 고정될 핵심 제품 순서 — 정확한 이름 매칭 (product-admin 등 부분일치 오류 방지)
const PINNED_EXACT = ['ipd', 'ad', 'scs', 'ctp', 'cta', 'nm', 'common'];

function pinIndex(product: string): number {
  const p = product.toLowerCase().trim().replace(/^heuron\s+/i, '');
  const idx = PINNED_EXACT.indexOf(p);
  return idx >= 0 ? idx : PINNED_EXACT.length;
}

const CATEGORY_TABS: { key: CategoryTab; label: string; emoji: string }[] = [
  { key: 'All',       label: '전체',          emoji: '🏷' },
  { key: 'Web',       label: 'Web',           emoji: '🌐' },
  { key: 'Engine',    label: 'Engine',        emoji: '⚙️' },
  { key: 'OnPremise', label: 'On-premise',    emoji: '🖥' },
  { key: 'Infra',     label: '인프라',         emoji: '🔧' },
  { key: 'Other',     label: '기타',           emoji: '📦' },
];

function isRecent(dateStr: string) {
  const d = new Date(dateStr).getTime();
  return Date.now() - d < 30 * 24 * 60 * 60 * 1000;
}

function productColor(product: string): string {
  const p = product.toLowerCase();
  if (p.includes('ctp'))                        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
  if (p.includes('scs') || p.includes('strocare')) return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30';
  if (p.includes('ad'))                         return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30';
  if (p.includes('ipd'))                        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30';
  if (p.includes('ni'))                         return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30';
  if (p.includes('nm'))                         return 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30';
  if (p.includes('cta'))                        return 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30';
  if (p.includes('agent'))                      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
  if (p.includes('common'))                     return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30';
  return 'bg-primary/10 text-primary border-primary/30';
}

export default function ReleaseNotesPage() {
  const [search, setSearch]           = useState('');
  const [categoryTab, setCategoryTab]  = useState<CategoryTab>('All');
  const [othersOpen, setOthersOpen]    = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['release-notes'],
    queryFn: async () => {
      const res = await api.getReleaseNotes();
      if (!res.success) throw new Error(String(res.error) || '조회 실패');
      return (res.data || []) as ReleaseItem[];
    },
    staleTime: 60 * 60 * 1000,  // 60분 — 야간 캐시 갱신 이후 충분히 유효
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (categoryTab !== 'All') {
      list = list.filter(r => r.category === categoryTab);
    }
    if (search.trim()) {
      list = list.filter(r =>
        r.product.toLowerCase().includes(search.toLowerCase()) ||
        r.version.includes(search)
      );
    }
    // 모든 탭: 핵심 제품 맨 앞 고정 정렬
    if (!search.trim()) {
      list = [...list].sort((a, b) => {
        const ai = pinIndex(a.product);
        const bi = pinIndex(b.product);
        if (ai !== bi) return ai - bi;
        return a.product.localeCompare(b.product);
      });
    }
    return list;
  }, [data, search, categoryTab]);

  // 모든 탭 + 검색 없을 때 핀/기타 분리
  const { pinnedItems, otherItems } = useMemo(() => {
    if (search.trim()) return { pinnedItems: filtered, otherItems: [] };
    const pinned = filtered.filter(r => pinIndex(r.product) < PINNED_EXACT.length);
    const others = filtered.filter(r => pinIndex(r.product) >= PINNED_EXACT.length);
    return { pinnedItems: pinned, otherItems: others };
  }, [filtered, search]);
  // 카테고리별 카운트
  const categoryCounts = useMemo(() => {
    if (!data) return {} as Record<CategoryTab, number>;
    const rec: Record<CategoryTab, number> = {
      All: data.length, Web: 0, Engine: 0, OnPremise: 0, Infra: 0, Other: 0,
    };
    for (const item of data) {
      const c = item.category as CategoryTab;
      if (rec[c] !== undefined) rec[c]++;
    }
    return rec;
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="🏷 릴리즈 노트" showBack />
      <PageWrapper>
        <div className="px-4 pt-4 pb-6 space-y-4">

          {/* 안내 */}
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
            <span className="text-primary text-sm">📌</span>
            <p className="text-xs text-primary/80">Confluence 릴리즈 노트 공간의 제품별 최신 버전입니다.</p>
          </div>

          {/* 카테고리 탭 */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {CATEGORY_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategoryTab(tab.key)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all',
                  categoryTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <span>{tab.emoji}</span>
                {tab.label}
                {data && categoryCounts[tab.key] !== undefined && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    categoryTab === tab.key ? 'bg-white/20' : 'bg-background/60'
                  )}>
                    {categoryCounts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="제품명 또는 버전 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* 건수 + 새로고침 */}
          {!isLoading && !isError && data && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{filtered.length}</span>개 제품
              </p>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => refetch()}>
                <RefreshCw className="w-3 h-3" />새로고침
              </Button>
            </div>
          )}

          {isLoading && <div className="space-y-2"><CardSkeleton count={8} /></div>}
          {isError && (
            <ErrorState
              message={(error as Error)?.message || '데이터를 불러올 수 없습니다.'}
              onRetry={() => refetch()}
            />
          )}

          {/* 릴리즈 목록 */}
          {!isLoading && !isError && filtered.length > 0 && (() => {
            const renderCard = (item: ReleaseItem) => {
              const recent  = isRecent(item.date);
              const color   = productColor(item.product);
              const catInfo = CATEGORY_TABS.find(t => t.key === item.category);
              return (
                <motion.a
                  key={item.product}
                  variants={staggerItem}
                  href={item.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center gap-3 bg-card border rounded-xl p-4',
                    'hover:border-primary/30 hover:shadow-sm transition-all active:scale-[0.98]',
                    'border-border'
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0', color)}>
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{item.product}</p>
                      {recent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 font-semibold">NEW</span>
                      )}
                      {catInfo && categoryTab === 'All' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {catInfo.emoji} {catInfo.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded border', color)}>
                        v{item.version}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.date}</span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </motion.a>
              );
            };

            return (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                {/* 핀된 항목 (항상 표시) */}
                {pinnedItems.map(item => renderCard(item))}

                {/* 기타 그룹 (접기/펼치기) */}
                {otherItems.length > 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setOthersOpen(v => !v)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 flex-shrink-0">
                        기타 {otherItems.length}개
                        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', othersOpen && 'rotate-180')} />
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </button>
                    <AnimatePresence initial={false}>
                      {othersOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-2 overflow-hidden"
                        >
                          {otherItems.map(item => renderCard(item))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })()}

          {!isLoading && !isError && filtered.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <p className="text-4xl">🏷</p>
              <p className="text-sm text-muted-foreground">
                {search ? `"${search}" 검색 결과 없음` : '릴리즈 노트를 불러오는 중...'}
              </p>
            </div>
          )}

        </div>
      </PageWrapper>
      <BottomNav />
    </div>
  );
}
