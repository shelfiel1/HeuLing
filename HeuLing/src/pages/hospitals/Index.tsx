// ============================================================
// HeuLing — 병원 조회 목록 페이지 v4 (국내/해외 + 필터 재구성)
// ============================================================
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Building2, ChevronRight, LogOut, Wifi, WifiOff, MapPin, ExternalLink } from 'lucide-react';
import { api, type HospitalListItem, type HospitalProduct, type ReleaseItem } from '@/api/gasClient';
import { useAuth } from '@/hooks/useAuth';
import { ROUTE_PATHS } from '@/lib/index';
import { TopBar, BottomNav, PageWrapper, StatusBadge, CardSkeleton, EmptyState, ErrorState } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { springPresets, staggerContainer, staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

// 최신버전 바 고정 정렬 순서 — 정확한 이름 매칭 (product-admin 등 부분일치 오류 방지)
const VERSION_PIN_EXACT = ['ipd', 'ad', 'scs', 'ctp', 'cta', 'nm', 'common'];
function versionPinIdx(product: string): number {
  const p = product.toLowerCase().trim().replace(/^heuron\s+/i, '');
  const idx = VERSION_PIN_EXACT.indexOf(p);
  return idx >= 0 ? idx : VERSION_PIN_EXACT.length;
}

// ── 탭 타입 ──────────────────────────────────────────────────
type RegionTab  = 'domestic' | 'overseas';
type FilterMode = '전체' | '정상' | '과제' | '데모' | '납품' | '임상시청' | '기타' | '만료임박';

const DOMESTIC_FILTERS: FilterMode[] = ['전체', '정상', '과제', '데모', '기타', '만료임박'];
const OVERSEAS_FILTERS: FilterMode[] = ['전체', '데모', '납품', '임상시청', '기타', '만료임박'];

// 병원의 가장 급한 만료일(일수) 계산
function getMinExpDays(products: HospitalProduct[]): number {
  const today = new Date().getTime();
  let min = Infinity;
  for (const p of products) {
    if (!p.만료일) continue;
    const d = new Date(String(p.만료일)).getTime();
    const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    if (diff < min) min = diff;
  }
  return min;
}

function hasRemoteAccess(products: HospitalProduct[]): boolean {
  return products.some(p => {
    const r = String(p['원격'] || '').trim().toLowerCase();
    return r && r !== '불가능' && r !== 'x' && r !== '없음';
  });
}

// 필터 분류에 맞는 제품이 있는지 확인
function matchesFilter(hospital: HospitalListItem, filter: FilterMode): boolean {
  const prods = hospital.products;
  if (filter === '전체') return true;
  if (filter === '만료임박') {
    return prods.some(p => p.상태 === '만료' || p.상태 === '만료예정');
  }
  // 필터분류 필드로 판단
  return prods.some(p => {
    const fc = String(p.필터분류 || '');
    if (filter === '정상')   return fc === '정상';
    if (filter === '과제')   return fc === '과제';
    if (filter === '데모')   return fc === '데모';
    if (filter === '납품')   return fc === '납품';
    if (filter === '임상시청') return fc === '임상시청';
    if (filter === '기타')   return fc === '기타';
    return false;
  });
}

function filterCount(data: HospitalListItem[], filter: FilterMode): number {
  return data.filter(h => matchesFilter(h, filter)).length;
}

// 필터 탭별 색상
function filterColor(filter: FilterMode, active: boolean): string {
  if (!active) return 'bg-muted text-muted-foreground hover:bg-muted/80';
  switch (filter) {
    case '만료임박': return 'bg-yellow-500 text-white shadow-sm';
    case '데모':    return 'bg-blue-500 text-white shadow-sm';
    case '정상':    return 'bg-green-500 text-white shadow-sm';
    case '과제':    return 'bg-purple-500 text-white shadow-sm';
    case '납품':    return 'bg-green-500 text-white shadow-sm';
    case '임상시청': return 'bg-orange-500 text-white shadow-sm';
    case '기타':    return 'bg-slate-500 text-white shadow-sm';
    default:        return 'bg-primary text-primary-foreground shadow-sm';
  }
}

function filterEmoji(filter: FilterMode): string {
  switch (filter) {
    case '만료임박': return '⚠️';
    case '데모':    return '🔬';
    case '정상':    return '✅';
    case '과제':    return '📋';
    case '납품':    return '✅';
    case '임상시청': return '🔬';
    case '기타':    return '📦';
    default:        return '';
  }
}

export default function HospitalsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch]         = useState('');
  const [regionTab, setRegionTab]   = useState<RegionTab>('domestic');
  const [filter, setFilter]         = useState<FilterMode>('전체');

  // 탭 전환 시 필터 초기화
  const handleRegionChange = (tab: RegionTab) => {
    setRegionTab(tab);
    setFilter('전체');
    setSearch('');
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hospitals', regionTab],
    queryFn: async () => {
      const res = await api.getHospitalList(regionTab);
      if (!res.success) throw new Error(res.error || '데이터 로드 실패');
      return (res.data || []) as HospitalListItem[];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });

  const FILTER_TABS = regionTab === 'overseas' ? OVERSEAS_FILTERS : DOMESTIC_FILTERS;

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (search.trim()) {
      list = list.filter(h => h.hospitalName.toLowerCase().includes(search.toLowerCase()));
    }
    if (filter !== '전체') {
      if (filter === '만료임박') {
        list = [...list]
          .filter(h => h.products.some(p => p.상태 === '만료' || p.상태 === '만료예정'))
          .sort((a, b) => getMinExpDays(a.products) - getMinExpDays(b.products));
      } else {
        list = list.filter(h => matchesFilter(h, filter));
      }
    }
    return list;
  }, [data, search, filter]);

  const counts = useMemo(() => {
    if (!data) return {} as Record<FilterMode, number>;
    const rec = {} as Record<FilterMode, number>;
    for (const f of FILTER_TABS) rec[f] = filterCount(data, f);
    return rec;
  }, [data, FILTER_TABS]);

  // 릴리즈 캐시 — 최신버전 바용
  const { data: releases } = useQuery({
    queryKey: ['releases'],
    queryFn: async () => {
      const res = await api.getReleaseNotes();
      return (res.data || []) as ReleaseItem[];
    },
    staleTime: 60 * 60 * 1000,
  });

  // 지도 URL 생성 (국내: 네이버, 해외: Google)
  const getMapUrl = (hospitalName: string, isOverseas: boolean): string => {
    return isOverseas
      ? `https://maps.google.com/?q=${encodeURIComponent(hospitalName)}`
      : `https://map.naver.com/v5/search/${encodeURIComponent(hospitalName)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        title="병원 조회"
        rightElement={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.name}</span>
            <Button variant="ghost" size="icon" onClick={signOut} className="w-8 h-8">
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        }
      />

      <PageWrapper>
        <div className="px-4 pt-4 space-y-3">

          {/* 국내/해외 탭 */}
          <div className="flex gap-2 bg-muted/40 rounded-xl p-1">
            {(['domestic', 'overseas'] as RegionTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => handleRegionChange(tab)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                  regionTab === tab
                    ? 'bg-white dark:bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'domestic' ? '🇰🇷 국내' : '🌏 해외'}
              </button>
            ))}
          </div>

          {/* 검색바 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`${regionTab === 'domestic' ? '국내' : '해외'} 병원명 검색...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>

          {/* 필터 탭 */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {FILTER_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all',
                  filterColor(tab, filter === tab)
                )}
              >
                {filterEmoji(tab) && <span>{filterEmoji(tab)}</span>}
                {tab}
                {data && counts[tab] !== undefined && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    filter === tab ? 'bg-white/20' : 'bg-background/60'
                  )}>
                    {counts[tab]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 요약 + 최신버전 바 */}
          {!isLoading && !isError && data && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {filter !== '전체' && <span className="font-medium text-foreground">[{filter}] </span>}
                  <span className="font-semibold text-foreground">{filtered.length}</span>개 병원
                  {search && ` (검색 결과)`}
                </p>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
                  새로고침
                </Button>
              </div>
              {/* 최신버전 칩 바 */}
              {releases && releases.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {(() => {
                    // 중복 제거: 같은 제품명은 날짜 최신 것 1개만
                    const seen = new Map<string, typeof releases[0]>();
                    for (const r of releases) {
                      const key = r.product.toLowerCase().trim();
                      const prev = seen.get(key);
                      if (!prev || r.date > prev.date) seen.set(key, r);
                    }
                    return [...seen.values()].sort((a, b) => {
                      const ai = versionPinIdx(a.product);
                      const bi = versionPinIdx(b.product);
                      if (ai !== bi) return ai - bi;
                      return a.product.localeCompare(b.product);
                    }).map((r) => (
                    <a
                      key={r.product}
                      href={r.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full
                                 bg-primary/8 border border-primary/20 hover:bg-primary/15
                                 transition-colors text-[10px] font-medium text-primary/80"
                    >
                      <span className="font-semibold text-foreground/70">
                        {r.product.replace('Heuron ', '')}
                      </span>
                      <span className="font-mono">{r.version}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                    </a>
                  ));
                  })()}
                </div>
              )}
            </div>
          )}

          {isLoading && <CardSkeleton count={6} />}
          {isError && (
            <ErrorState
              message={(error as Error)?.message || '데이터를 불러올 수 없습니다.'}
              onRetry={() => refetch()}
            />
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState
              icon={<Building2 className="w-12 h-12" />}
              title={
                search ? `"${search}" 검색 결과 없음`
                  : filter !== '전체' ? `[${filter}] 해당 병원 없음`
                  : '등록된 병원이 없습니다.'
              }
              description={search ? '다른 검색어를 입력해보세요.' : undefined}
            />
          )}

          {/* 병원 목록 */}
          {!isLoading && !isError && filtered.length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-2 pb-4"
            >
              {filtered.map((hospital) => {
                const products    = hospital.products || [];
                const hasExpiring = products.some(p => p.상태 === '만료예정' || p.상태 === '만료');
                const demoCount   = products.filter(p => p.필터분류 === '데모').length;
                const normalCount = products.filter(p => p.필터분류 === '정상' || p.필터분류 === '납품').length;
                const otherCount  = products.length - demoCount - normalCount;
                const hasRemote   = hasRemoteAccess(products);
                const minDays     = filter === '만료임박' ? getMinExpDays(products) : null;

                return (
                  <motion.div
                    key={hospital.hospitalName}
                    variants={staggerItem}
                    onClick={() => navigate(`/hospitals/${encodeURIComponent(hospital.hospitalName)}?region=${regionTab}`)}
                    className={cn(
                      'bg-card border border-border rounded-xl p-4',
                      'hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer active:scale-[0.98]'
                    )}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">
                              {hospital.hospitalName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {hospital.region && <span className="mr-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded">{hospital.region}</span>}
                              {demoCount > 0 && normalCount > 0
                                ? `데모 ${demoCount}건 · 상용 ${normalCount}건`
                                : demoCount > 0 ? `데모 ${demoCount}건`
                                : normalCount > 0 ? `상용 ${normalCount}건`
                                : otherCount > 0 ? `${otherCount}건`
                                : `${products.length}건`
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        {/* 지도 바로가기 버튼 */}
                        <a
                          href={getMapUrl(hospital.hospitalName, hospital.isOverseas ?? false)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                          title={hospital.isOverseas ? 'Google Maps' : '네이버 지도'}
                        >
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                        </a>
                        {minDays !== null && minDays !== Infinity && (
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                            minDays < 0
                              ? 'bg-destructive text-destructive-foreground'
                              : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                          )}>
                            {minDays < 0 ? `D+${Math.abs(minDays)}` : `D-${minDays}`}
                          </span>
                        )}
                        {hasRemote
                          ? <Wifi className="w-3.5 h-3.5 text-green-500" />
                          : <WifiOff className="w-3.5 h-3.5 text-muted-foreground/40" />
                        }
                        {hasExpiring && filter !== '만료임박' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-medium">
                            만료임박
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    {products.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-3 ml-10">
                        {products.slice(0, 4).map((p, i) => {
                          const expShort = p.만료일 ? String(p.만료일).slice(0, 7) : '';
                          const isCloud  = String(p.제품유형 || '').toLowerCase().includes('cloud');
                          return (
                            <div key={i} className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium text-foreground">{String(p.제품명 || '')}</span>
                              {p.버전 && (
                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
                                  {String(p.버전)}
                                </span>
                              )}
                              {/* 제품유형 뱃지 */}
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                isCloud
                                  ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
                                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                              )}>
                                {isCloud ? '☁️ Cloud' : '🖥 On-premise'}
                              </span>
                              {expShort ? (
                                <span className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                  p.상태 === '만료' ? 'bg-destructive/15 text-destructive' :
                                  p.상태 === '만료예정' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                                  'bg-green-500/10 text-green-700 dark:text-green-400'
                                )}>
                                  ~{expShort}
                                </span>
                              ) : (
                                <StatusBadge status={String(p.상태 || '')} />
                              )}
                              {p.설치장소 && (
                                <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
                                  📍{String(p.설치장소)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {products.length > 4 && (
                          <span className="text-xs text-muted-foreground">+{products.length - 4}종</span>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </PageWrapper>

      <BottomNav />
    </div>
  );
}
