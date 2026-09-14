import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { updateMatch } from '../firebase';

const KEY = '@ahscore/offlineMatchQueue';

type QueuedUpdate = {
  matchId: string;
  data: Record<string, any>;
  at: number;
};

async function readQueue(): Promise<QueuedUpdate[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedUpdate[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(-40)));
}

export async function queueMatchUpdate(matchId: string, data: Record<string, any>) {
  const queue = await readQueue();
  queue.push({ matchId, data, at: Date.now() });
  await writeQueue(queue);
}

export async function persistMatchUpdate(matchId: string, data: Record<string, any>) {
  try {
    await updateMatch(matchId, data);
    return true;
  } catch {
    await queueMatchUpdate(matchId, data);
    return false;
  }
}

export async function flushMatchQueue(): Promise<number> {
  const queue = await readQueue();
  if (!queue.length) return 0;
  const remaining: QueuedUpdate[] = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      await updateMatch(item.matchId, item.data);
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  return flushed;
}

let attached = false;
export function attachOfflineFlush() {
  if (attached) return;
  attached = true;
  AppState.addEventListener('change', state => {
    if (state === 'active') flushMatchQueue().catch(() => {});
  });
  flushMatchQueue().catch(() => {});
}
