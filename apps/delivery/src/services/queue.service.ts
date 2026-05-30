import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'ujcha_location_queue';
const MAX_QUEUE = 200;

export type QueuedLocation = {
  orderId: string;
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
};

async function loadQueue(): Promise<QueuedLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedLocation[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedLocation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best-effort
  }
}

export const locationQueue = {
  async enqueue(loc: QueuedLocation): Promise<void> {
    const q = await loadQueue();
    q.push(loc);
    if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
    await saveQueue(q);
  },

  async dequeueAll(): Promise<QueuedLocation[]> {
    const q = await loadQueue();
    await AsyncStorage.removeItem(QUEUE_KEY);
    return q;
  },

  async size(): Promise<number> {
    return (await loadQueue()).length;
  },
};
