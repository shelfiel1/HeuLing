// ============================================================
// HeuLing — 로그인 페이지 (Google 계정 로그인)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ROUTE_PATHS } from '@/lib/index';
import { springPresets } from '@/lib/motion';

// ── Google Identity Services 타입 ────────────────────────────
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

// ── JWT 페이로드 디코딩 (검증 없이 클라이언트 표시용) ──────────
function decodeJwt(token: string): Record<string, string> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    // 한글 등 멀티바이트 문자 깨짐 방지: TextDecoder 사용
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

// Google OAuth Client ID
// ※ Google Cloud Console > API 및 서비스 > 사용자 인증 정보 > OAuth 클라이언트 ID
// 아래 값을 본인 프로젝트의 Client ID로 교체하세요.
const GOOGLE_CLIENT_ID = '490053197148-4357umsmvcci2cco3n7tsc1dqcepevd6.apps.googleusercontent.com';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate   = useNavigate();
  const btnRef     = useRef<HTMLDivElement>(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [noClientId, setNoClientId] = useState(false);

  // Google 로그인 콜백
  const handleCredential = async (response: { credential: string }) => {
    setError('');
    setLoading(true);
    try {
      const payload = decodeJwt(response.credential);
      const email   = payload.email || '';
      const name    = payload.name  || payload.email?.split('@')[0] || '';

      if (!email.endsWith('@iheuron.com')) {
        setError('@iheuron.com 계정만 로그인 가능합니다.');
        setLoading(false);
        return;
      }

      const ok = await signIn(email, name);
      if (ok) {
        navigate(ROUTE_PATHS.HOSPITALS);
      } else {
        setError('로그인에 실패했습니다. 관리자에게 문의하세요.');
      }
    } catch {
      setError('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // GSI 초기화
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setNoClientId(true);
      return;
    }

    const initGSI = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id:         GOOGLE_CLIENT_ID,
        callback:          handleCredential,
        auto_select:       false,
        cancel_on_tap_outside: true,
        hd:                'iheuron.com',   // iheuron.com 계정만 표시
      });
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          type:  'standard',
          theme: 'outline',
          size:  'large',
          text:  'signin_with',
          width: '320',
          logo_alignment: 'left',
          locale: 'ko',
        });
      }
    };

    // GSI 스크립트 로드 대기
    if (window.google) {
      initGSI();
    } else {
      const timer = setInterval(() => {
        if (window.google) { initGSI(); clearInterval(timer); }
      }, 200);
      return () => clearInterval(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springPresets.gentle}
          className="w-full max-w-sm space-y-8"
        >
          {/* 로고 */}
          <div className="text-center space-y-3">
            <div
              className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg"
              style={{ boxShadow: '0 8px 24px -4px color-mix(in srgb, var(--primary) 40%, transparent)' }}
            >
              <span className="text-primary-foreground text-2xl font-bold">H</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">HeuLing</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Heuron · TE팀 현장 관리 시스템
              </p>
            </div>
          </div>

          {/* 로그인 버튼 영역 */}
          <div className="space-y-4">
            {/* Google 로그인 버튼 */}
            {!noClientId && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  @iheuron.com Google 계정으로 로그인
                </p>
                <div ref={btnRef} className="w-full flex justify-center" />
              </div>
            )}

            {/* Client ID 미설정 시 안내 */}
            {noClientId && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  ⚙️ Google 로그인 설정 필요
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Google Cloud Console에서 OAuth 클라이언트 ID를 발급받아
                  관리자에게 등록 요청해 주세요.
                </p>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline"
                >
                  Google Cloud Console 바로가기 →
                </a>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-2">
                <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span className="text-sm text-muted-foreground">로그인 중...</span>
              </div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/20"
              >
                <p className="text-xs text-destructive">{error}</p>
              </motion.div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            계정 문의: 관리자에게 연락하세요
          </p>
        </motion.div>
      </div>

      <div className="text-center pb-8">
        <p className="text-xs text-muted-foreground/50">© 2026 Heuron TE Team</p>
      </div>
    </div>
  );
}
