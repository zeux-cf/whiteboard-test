import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { BoardRole } from '../shared/model';
import { BoardSession } from './board-session';

export function useBoardCollaboration(boardId: string, role: BoardRole) {
  const session = useMemo(() => new BoardSession(boardId, role), [boardId, role]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);

  return {
    ...state,
    commit: session.commit,
    undo: session.undo,
    redo: session.redo,
    setCursor: session.setCursor,
  };
}
