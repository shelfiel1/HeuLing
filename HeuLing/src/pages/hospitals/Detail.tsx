// ============================================================
// HeuLing — 병원 상세 페이지 v4
// ============================================================
import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Phone, Clock, MapPin,
  ClipboardPlus, RefreshCw, Monitor, User, Wifi, WifiOff,
  ExternalLink, Tag
} from 'lucide-react';
import { api } from '@/api/gasClient';
import { TopBar, BottomNav, PageWrapper, StatusBadge, RequestTypeBadge, CardSkeleton, ErrorState } from '@/components/Layout';
import { ROUTE_PATHS } from '@/lib/index';
import type { Contact, CSRecord } from '@/lib/index';
import type { HospitalProduct } from '@/api/gasClient';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { springPresets } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { PhotoViewer } from '@/components/PhotoViewer';

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hospitalName = decodeURIComponent(id || '');
  const region = (searchParams.get('region') || 'domestic') as 'domestic' | 'overseas';
  const isOverseas = region === 'overseas';
  const [detailView, setDetailView] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hospital-detail', hospitalName, region],
    queryFn: async () => {
      const res = await api.getHospitalDetail(hospitalName, region);
      if (!res.success) throw new Error(String(res.error) || '데이터 로드 실패');
      return res.data as {
        hospitalName: string;
        isOverseas: boolean;
        products: HospitalProduct[];
        contacts: Contact[];
        csHistory: CSRecord[];
      };
    },
    staleTime: 15 * 60 * 1000,
  });

  // 지도 URL — 국내: 네이버, 해외: Google
  const mapUrl = isOverseas
    ? `https://maps.google.com/?q=${encodeURIComponent(hospitalName)}`
    : `https://map.naver.com/v5/search/${encodeURIComponent(hospitalName)}`;

  const mapLabel = isOverseas ? 'Google Maps' : '네이버 지도';

  const handleCSRegister = () => {
    navigate(`${ROUTE_PATHS.CS_FORM}?hospital=${encodeURIComponent(hospitalName)}`);
  };

  const handleUpdate = () => {
    navigate(`${ROUTE_PATHS.UPDATE_FORM}?hospital=${encodeURIComponent(hospitalName)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        title={
          <span className="flex items-center gap-2">
            {isOverseas && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">🌏 해외</span>}
            <span>{hospitalName}</span>
          </span>
        }
        showBack
      />

      <PageWrapper>
        <div className="px-4 pt-4 space-y-4">
          {isLoading && <CardSkeleton count={3} />}
          {isError && (
            <ErrorState
              message={(error as Error)?.message || '데이터를 불러올 수 없습니다.'}
              onRetry={() => refetch()}
            />
          )}

          {data && (
            <>
              {/* 빠른 액션 버튼 */}
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleCSRegister} className="h-12 gap-2 text-sm">
                  <ClipboardPlus className="w-4 h-4" />
                  CS 등록
                </Button>
                <Button variant="outline" onClick={handleUpdate} className="h-12 gap-2 text-sm">
                  <RefreshCw className="w-4 h-4" />
                  제품현황 이력 업데이트
                </Button>
              </div>

              {/* 지도 보기 — 국내: 네이버, 해외: Google */}
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-4 py-3 rounded-xl
                           border border-border bg-muted/30 hover:bg-muted/60
                           active:scale-[0.98] transition-all"
                onClick={e => e.stopPropagation()}
              >
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground flex-1 truncate">{hospitalName}</span>
                <span className="text-xs text-muted-foreground shrink-0">{mapLabel} →</span>
              </a>

              {/* 탭 */}
              <Tabs defaultValue="products">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="products" className="text-xs">
                    제품정보 ({data.products?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="text-xs">
                    연락처 ({data.contacts?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">
                    CS이력 ({data.csHistory?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* 제품 정보 탭 */}
                <TabsContent value="products" className="mt-3 space-y-3">
                  {(data.products || []).length === 0 ? (
                    <div className="text-center py-8">
                      <Monitor className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">등록된 제품이 없습니다.</p>
                    </div>
                  ) : (
                    (data.products || []).map((product, i) => {
                      const isCloud = String(product.제품유형 || '').toLowerCase().includes('cloud');
                      const mgmtCode = String(product.관리코드 || '');

                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...springPresets.gentle, delay: i * 0.05 }}
                          className="bg-card border border-border rounded-xl p-4 space-y-3"
                        >
                          {/* 헤더: 제품명 + 상태 + 제품유형 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Monitor className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-sm">{String(product.제품명 || '')}</p>
                                  {/* 제품유형 뱃지 */}
                                  <span className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                    isCloud
                                      ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
                                      : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                                  )}>
                                    {isCloud ? '☁️ Cloud' : '🖥 On-premise'}
                                  </span>
                                </div>
                                {/* 설치유형 */}
                                {product.설치유형 && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {String(product.설치유형)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <StatusBadge status={String(product.상태 || '')} />
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 ml-10 text-xs">
                            {/* 버전 + 최신버전 */}
                            {product.버전 && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">버전</span>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <p className="font-mono font-medium">{String(product.버전)}</p>
                                  {product.최신버전 && product.최신버전 !== product.버전 && (
                                    <a
                                      href={String(product.최신버전URL || '#')}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition-colors text-[10px] font-medium"
                                    >
                                      <span>최신 {String(product.최신버전)}</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                      <span>↗</span>
                                    </a>
                                  )}
                                  {product.최신버전 && product.최신버전 === product.버전 && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 text-[10px] font-medium">
                                      ✅ 최신버전
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* IP — 국내만 */}
                            {!isOverseas && product.IP && (
                              <div>
                                <span className="text-muted-foreground">IP</span>
                                <p className="font-mono font-medium mt-0.5">{String(product.IP)}</p>
                              </div>
                            )}
                            {/* 관리코드 (PC번호) */}
                            {mgmtCode && (
                              <div>
                                <span className="text-muted-foreground">관리코드</span>
                                <p className="font-mono font-medium mt-0.5">{mgmtCode}</p>
                              </div>
                            )}
                            {/* 원격 접속 */}
                            <div>
                              <span className="text-muted-foreground">원격</span>
                              {(() => {
                                const r  = String(product['원격'] || '').trim();
                                const rn = String(product['원격번호'] || '').trim();
                                const ok = r && r !== '불가능' && r !== 'X' && r !== 'x' && r !== '없음';
                                if (!ok) return (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <WifiOff className="w-3 h-3 text-muted-foreground/50" />
                                    <span className="text-muted-foreground text-xs">불가능</span>
                                  </div>
                                );
                                return (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Wifi className="w-3 h-3 text-green-500" />
                                    <span className="font-medium text-green-700 dark:text-green-400 text-xs">
                                      {rn || '가능'}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            {/* 만료일 */}
                            {product.만료일 && (
                              <div>
                                <span className="text-muted-foreground">만료일</span>
                                <p className={cn(
                                  'font-medium mt-0.5',
                                  product.상태 === '만료예정' || product.상태 === '만료' ? 'text-destructive' : ''
                                )}>
                                  {String(product.만료일)}
                                </p>
                              </div>
                            )}
                            {/* 설치일 */}
                            {product.설치일 && (
                              <div>
                                <span className="text-muted-foreground">설치일</span>
                                <p className="font-medium mt-0.5">{String(product.설치일)}</p>
                              </div>
                            )}
                            {/* 설치장소 */}
                            {product.설치장소 && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">설치 장소</span>
                                <p className="font-medium mt-0.5">📍 {String(product.설치장소)}</p>
                              </div>
                            )}
                          </div>

                          {/* 릴리즈 노트 링크 버튼 (별도 행) */}
                          <a
                            href="/releases"
                            onClick={e => { e.preventDefault(); navigate('/releases'); }}
                            className="flex items-center gap-2 ml-10 mt-1 text-xs text-primary/80 hover:text-primary transition-colors"
                          >
                            <Tag className="w-3 h-3" />
                            <span>릴리즈 노트 확인</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </motion.div>
                      );
                    })
                  )}
                </TabsContent>

                {/* 연락처 탭 */}
                <TabsContent value="contacts" className="mt-3 space-y-2">
                  {(data.contacts || []).length === 0 ? (
                    <div className="text-center py-8">
                      <User className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">등록된 연락처가 없습니다.</p>
                    </div>
                  ) : (
                    (data.contacts || []).map((contact, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springPresets.gentle, delay: i * 0.05 }}
                        className="bg-card border border-border rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{String(contact.이름 || '')}</p>
                              {contact.부서 && (
                                <p className="text-xs text-muted-foreground">{String(contact.부서)}</p>
                              )}
                            </div>
                          </div>
                          {contact.연락처 && (
                            <a
                              href={`tel:${String(contact.연락처)}`}
                              className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-lg transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">{String(contact.연락처)}</span>
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </TabsContent>

                {/* CS 이력 탭 */}
                <TabsContent value="history" className="mt-3 space-y-2">
                  {(data.csHistory || []).length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">CS 이력이 없습니다.</p>
                    </div>
                  ) : (
                    <>
                      {/* 간략히 / 사진 보기 토글 — 항상 표시 */}
                      <div className="flex items-center justify-end gap-1 mb-1">
                        <button
                          type="button"
                          onClick={() => setDetailView(false)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                            !detailView
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          )}
                        >
                          📋 간략히
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailView(true)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                            detailView
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          )}
                        >
                          🖼 자세히
                        </button>
                      </div>

                      {(data.csHistory || []).map((cs, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...springPresets.gentle, delay: i * 0.04 }}
                          className="bg-card border border-border rounded-xl p-4 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <RequestTypeBadge type={String(cs.요청유형 || '')} />
                                {(() => {
                                  const s = (cs as Record<string,unknown>)['csStatus'] as string | undefined
                                         || (cs as Record<string,unknown>)['진행상태'] as string | undefined
                                         || '진행중';
                                  const cfgMap: Record<string, string> = {
                                    '접수':   'bg-blue-500/10 text-blue-600 border-blue-500/30',
                                    '진행중': 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
                                    '완료':   'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
                                    '보류':   'bg-gray-400/10 text-gray-500 border-gray-400/30',
                                  };
                                  const cls = cfgMap[s] ?? cfgMap['진행중'];
                                  return (
                                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', cls)}>{s}</span>
                                  );
                                })()}
                                <span className="font-medium text-sm truncate">{String(cs.제품명 || '')}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{String(cs.접수일시 || '')}</p>
                            </div>
                            {cs.담당자 && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">{String(cs.담당자)}</span>
                            )}
                          </div>
                          {cs.접수내용 && (
                            <p className={cn('text-xs text-foreground/80', !detailView && 'line-clamp-2')}>
                              {String(cs.접수내용)}
                            </p>
                          )}
                          {cs.처리및조치사항 && (
                            <p className={cn('text-xs text-muted-foreground', !detailView && 'line-clamp-1')}>
                              → {String(cs.처리및조치사항)}
                            </p>
                          )}
                          {detailView && (cs as Record<string,unknown>)['처리내용서술형'] && (
                            <div className="mt-1.5 pt-1.5 border-t border-border/40">
                              <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">처리내용 (서술형)</p>
                              <p className="text-xs text-foreground/80 whitespace-pre-wrap">
                                {String((cs as Record<string,unknown>)['처리내용서술형'])}
                              </p>
                            </div>
                          )}
                          {detailView && (cs as Record<string,unknown>)['비고'] && (
                            <div className="mt-1 pt-1 border-t border-border/40">
                              <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">비고</p>
                              <p className="text-xs text-foreground/80">
                                {String((cs as Record<string,unknown>)['비고'])}
                              </p>
                            </div>
                          )}
                          {detailView && (() => {
                            const rawUrls = (cs as Record<string,unknown>)['사진URL'];
                            let photoList: string[] = [];
                            if (Array.isArray(rawUrls)) {
                              photoList = (rawUrls as string[]).filter(Boolean);
                            } else if (typeof rawUrls === 'string' && rawUrls.trim()) {
                              photoList = rawUrls.split(',').map(u => u.trim()).filter(Boolean);
                            }
                            if (photoList.length === 0) return null;
                            return (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <p className="text-[10px] text-muted-foreground mb-1.5">📷 첨부 사진 {photoList.length}장</p>
                                <PhotoViewer urls={photoList} cols={3} maxPreview={6} showEmpty={false} />
                              </div>
                            );
                          })()}
                        </motion.div>
                      ))}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </PageWrapper>

      <BottomNav />
    </div>
  );
}
