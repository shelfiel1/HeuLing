// ============================================================
// HeuLing — Layout: BottomNav + TopBar + Page Wrapper
// ============================================================
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, ClipboardPlus, PackagePlus,
  PackageMinus, CheckSquare, Wifi, WifiOff, RotateCcw, Bell, ClipboardCheck
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';
import { useOnline } from '@/hooks/useOnline';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { springPresets } from '@/lib/motion';

// ── 하단 네비게이션 아이템 ─────────────────────────────────────
const NAV_ITEMS = [
  { path: ROUTE_PATHS.HOSPITALS,      icon: Building2,       label: '병원조회' },
  { path: ROUTE_PATHS.CS_FORM,        icon: ClipboardPlus,   label: 'CS등록' },
  { path: ROUTE_PATHS.SERVICE_REPORT, icon: ClipboardCheck,  label: '확인서' },
  { path: ROUTE_PATHS.WITHDRAW,       icon: PackageMinus,    label: '철수' },
  { path: ROUTE_PATHS.MY_ISSUES,      icon: CheckSquare,     label: '더보기' },
  { path: ROUTE_PATHS.NOTICES,        icon: Bell,            label: '공지' },
];

// ── 온라인 상태 배너 ──────────────────────────────────────────
function OnlineBanner() {
  const { isOnline, pendingCount, syncPending, isSyncing } = useOnline();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2 text-xs font-medium',
      isOnline
        ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
        : 'bg-destructive/15 text-destructive'
    )}>
      <div className="flex items-center gap-2">
        {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {isOnline
          ? `대기 중인 항목 ${pendingCount}건 — 온라인 전환됨`
          : '오프라인 모드 — 입력은 저장 후 온라인 시 자동 업로드'}
      </div>
      {isOnline && pendingCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={syncPending}
          disabled={isSyncing}
        >
          <RotateCcw className={cn('w-3 h-3 mr-1', isSyncing && 'animate-spin')} />
          {isSyncing ? '업로드 중...' : '지금 업로드'}
        </Button>
      )}
    </div>
  );
}

// ── 탑바 ──────────────────────────────────────────────────────
interface TopBarProps {
  title: React.ReactNode;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export function TopBar({ title, showBack, rightElement }: TopBarProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 bg-background/95 border-b border-border">
      <OnlineBanner />
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="뒤로"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {!showBack && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">H</span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">HeuLing</span>
            </div>
          )}
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
        </div>
        {rightElement}
      </div>
    </header>
  );
}

// ── 하단 네비게이션 바 ─────────────────────────────────────────
export function BottomNav() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { pendingCount } = useOnline();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-background/95 border-t border-border safe-area-pb">
      <div className="grid grid-cols-6 h-16"> {/* 6탭 */}
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === ROUTE_PATHS.HOSPITALS && location.pathname.startsWith('/hospitals'));
          const Icon = item.icon;
          const showBadge = item.path === ROUTE_PATHS.MY_ISSUES && pendingCount > 0;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 transition-colors relative',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 inset-x-2 h-0.5 bg-primary rounded-b-full"
                  transition={springPresets.snappy}
                />
              )}
              <div className="relative">
                <Icon className={cn('w-5 h-5', isActive && 'stroke-[2.5]')} />
                {showBadge && (
                  <Badge className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground border-0">
                    {pendingCount}
                  </Badge>
                )}
              </div>
              <span className={cn('text-[10px] font-medium leading-none', isActive && 'font-semibold')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── 페이지 래퍼 ───────────────────────────────────────────────
interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={springPresets.gentle}
        className={cn('pb-20 min-h-screen', className)}
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}

// ── 상태 배지 ─────────────────────────────────────────────────
interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = {
    '정상':     'bg-green-500/15 text-green-600 dark:text-green-400',
    '데모':     'bg-primary/15 text-primary',
    '만료예정': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
    '만료':     'bg-destructive/15 text-destructive',
    '회수':     'bg-muted text-muted-foreground',
  };
  const style = status ? (styles[status as keyof typeof styles] || 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground';

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', style, className)}>
      {status || '-'}
    </span>
  );
}

// ── 요청유형 배지 ─────────────────────────────────────────────
interface RequestTypeBadgeProps {
  type?: string;
  className?: string;
}

export function RequestTypeBadge({ type, className }: RequestTypeBadgeProps) {
  const styles: Record<string, string> = {
    '장애':           'bg-destructive/15 text-destructive',
    '트러블슈팅':     'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
    '라이선스업데이트': 'bg-primary/15 text-primary',
    '제품업데이트':   'bg-accent/20 text-accent-foreground',
    '문의':           'bg-secondary text-secondary-foreground',
    '기타':           'bg-muted text-muted-foreground',
  };
  const style = type ? (styles[type] || 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground';

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', style, className)}>
      {type || '-'}
    </span>
  );
}

// ── 로딩 스켈레톤 ─────────────────────────────────────────────
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-5 bg-muted rounded-full w-14" />
          </div>
          <div className="h-3 bg-muted rounded w-24 mt-2" />
        </div>
      ))}
    </div>
  );
}

// ── 빈 상태 ───────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
    </div>
  );
}

// ── 에러 상태 ─────────────────────────────────────────────────
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-foreground mb-1">오류가 발생했습니다</p>
      <p className="text-xs text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="w-3 h-3 mr-2" />
          다시 시도
        </Button>
      )}
    </div>
  );
}
