// ============================================================
// HeuLing — Auth Hook v3 (직원목록 시트 연동 + 부서 지원)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { HEURON_DOMAIN, GAS_API_URL } from '@/lib/index';

// 부서 타입: 임원 / 영업 / TE / 연구 / 품질 / '' (미지정)
export type StaffDept = '임원' | '영업' | 'TE' | '연구' | '품질' | '';

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  role: '관리자' | '일반';
  dept: StaffDept;   // v3: 부서
}

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, name: string) => Promise<boolean>;
  signOut: () => void;
  isAuthenticated: boolean;
  /** 영업 담당자 여부 */
  isSales: boolean;
  /** TE 담당자 여부 (미지정 포함) */
  isTE: boolean;
}

async function syncWithGAS(
  email: string,
  name: string,
): Promise<{ name: string; role: '관리자' | '일반'; dept: StaffDept }> {
  try {
    const url = `${GAS_API_URL}?action=getOrRegisterStaff&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
    const res  = await fetch(url, { redirect: 'follow' });
    const json = await res.json() as {
      success: boolean;
      data?: { name: string; role: string; dept?: string };
    };
    if (json.success && json.data) {
      const deptRaw = (json.data.dept || '') as string;
      const validDepts: StaffDept[] = ['임원', '영업', 'TE', '연구', '품질'];
      const dept = validDepts.includes(deptRaw as StaffDept)
        ? (deptRaw as StaffDept)
        : '';
      return {
        name: json.data.name || name,
        role: (json.data.role === '관리자' ? '관리자' : '일반') as '관리자' | '일반',
        dept,
      };
    }
  } catch { /* 네트워크 오류 시 기본값 */ }
  return { name, role: '일반', dept: '' };
}

export function useAuth(): UseAuthReturn {
  const [user, setUser]           = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('heuling_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        if (parsed.email.endsWith(HEURON_DOMAIN)) {
          setUser(parsed);
        } else {
          localStorage.removeItem('heuling_user');
          localStorage.removeItem('heuling_user_email');
        }
      } catch {
        localStorage.removeItem('heuling_user');
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async (email: string, name: string): Promise<boolean> => {
    if (!email.endsWith(HEURON_DOMAIN)) return false;
    const staffInfo = await syncWithGAS(email, name);
    const newUser: AuthUser = {
      email,
      name:  staffInfo.name,
      role:  staffInfo.role,
      dept:  staffInfo.dept,
    };
    setUser(newUser);
    localStorage.setItem('heuling_user', JSON.stringify(newUser));
    localStorage.setItem('heuling_user_email', email);
    return true;
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('heuling_user');
    localStorage.removeItem('heuling_user_email');
    window.location.href = '/login';
  }, []);

  const isSales = user?.dept === '영업';
  const isTE    = !isSales; // 영업이 아니면 TE 흐름 (TE, 임원, 연구, 품질, 미지정 포함)

  return {
    user,
    isLoading,
    signIn,
    isAuthenticated: !!user,
    signOut,
    isSales,
    isTE,
  };
}
