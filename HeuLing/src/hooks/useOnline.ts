// ============================================================
// HeuLing — Online/Offline 상태 훅 + 큐 싱크
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { getQueue, removeFromQueue } from '@/lib/offlineDB';
import { GAS_API_URL } from '@/lib/index';

interface UseOnlineReturn {
  isOnline: boolean;
  pendingCount: number;
  syncPending: () => Promise<void>;
  isSyncing: boolean;
}

function getUserEmail(): string {
  return localStorage.getItem('heuling_user_email') || '';
}

export function useOnline(): UseOnlineReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const updatePendingCount = useCallback(async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
  }, []);

  useEffect(() => {
    updatePendingCount();
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [updatePendingCount]);

  const syncPending = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    const queue = await getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    const email = getUserEmail();

    for (const item of queue) {
      try {
        const resp = await fetch(GAS_API_URL, {
          method: 'POST',
          redirect: 'follow',
          body: JSON.stringify({ ...item.payload, email }),
        });
        if (resp.ok) {
          await removeFromQueue(item.id);
        }
      } catch {
        // 실패 시 다음 항목으로 넘어감
      }
    }

    await updatePendingCount();
    setIsSyncing(false);
  }, [isOnline, isSyncing, updatePendingCount]);

  // 온라인 복귀 시 자동 싱크
  useEffect(() => {
    if (isOnline) {
      syncPending();
    }
  }, [isOnline, syncPending]);

  return { isOnline, pendingCount, syncPending, isSyncing };
}
