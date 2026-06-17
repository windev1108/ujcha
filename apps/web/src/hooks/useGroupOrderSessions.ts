'use client';
import { useState, useEffect } from 'react';
import type { GroupOrderStatus } from '@/services/group-order/api';

export interface GroupOrderSessionMeta {
  token: string;
  expiresAt: string;
  type: 'delivery' | 'pickup' | 'table';
  status: GroupOrderStatus;
}

const META_PREFIX = 'group_order_meta_';
const SESSION_PREFIX = 'group_order_session_';
const PARTICIPANT_PREFIX = 'group_order_participant_';
const UPDATE_EVENT = 'ujcha:group-session-update';

export function clearGroupOrderSession(token: string) {
  localStorage.removeItem(`${META_PREFIX}${token}`);
  localStorage.removeItem(`${SESSION_PREFIX}${token}`);
  localStorage.removeItem(`${PARTICIPANT_PREFIX}${token}`);
  // Notify all useGroupOrderSessions hooks in the same tab immediately
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function useGroupOrderSessions(): [GroupOrderSessionMeta[], boolean] {
  const [sessions, setSessions] = useState<GroupOrderSessionMeta[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    function load() {
      const now = Date.now();
      const result: GroupOrderSessionMeta[] = [];
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(META_PREFIX)) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const meta = JSON.parse(raw) as GroupOrderSessionMeta;
          if (!meta?.expiresAt || !meta?.token) continue;
          const expiresMs = new Date(meta.expiresAt).getTime();
          if (expiresMs <= now || meta.status === 'completed' || meta.status === 'cancelled') {
            clearGroupOrderSession(meta.token);
            continue;
          }
          result.push(meta);
        } catch { /* skip invalid */ }
      }
      setSessions(result);
      setIsReady(true);
    }

    load();
    const id = setInterval(load, 30_000);
    window.addEventListener(UPDATE_EVENT, load);
    window.addEventListener('storage', load);
    return () => {
      clearInterval(id);
      window.removeEventListener(UPDATE_EVENT, load);
      window.removeEventListener('storage', load);
    };
  }, []);

  return [sessions, isReady];
}
