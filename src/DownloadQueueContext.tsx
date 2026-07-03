console.log('[DIAG 5] DownloadQueueContext loading');
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { File, Paths } from 'expo-file-system';

import { usePlayer } from './PlayerContext';
import { importRemoteTrack } from './library';
import { saveAnalysis } from './analysis';
import { initNotifications, notifyDownloadComplete } from './notifications';
import { toast } from './components/Toast';
import {
  ServerJob,
  getJob,
  jobFileUrl,
  submitDownload,
} from './downloaderClient';
import { DownloadFormat, getDownloadFormat, getServerUrl } from './settings';

export type DownloadItemStatus =
  | 'queued'
  | 'processing'
  | 'downloading'
  | 'saving'
  | 'done'
  | 'error';

export type DownloadItem = {
  id: string;
  url: string;
  format: DownloadFormat;
  status: DownloadItemStatus;
  progress: number; // 0–100
  title?: string;
  artist?: string;
  error?: string;
  serverJobId?: string;
  trackId?: string;
  addedAt: number;
  completedAt?: number;
};

export const ACTIVE_STATUSES: DownloadItemStatus[] = [
  'queued',
  'processing',
  'downloading',
  'saving',
];

type QueueContextValue = {
  items: DownloadItem[];
  activeCount: number;
  enqueue: (url: string, format?: DownloadFormat) => boolean;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
};

const DownloadQueueContext = createContext<QueueContextValue | null>(null);

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const QUEUE_FILE = 'downloads-queue.json';

function queueFile(): File {
  return new File(Paths.document, QUEUE_FILE);
}

function loadPersistedQueue(): DownloadItem[] {
  try {
    const f = queueFile();
    if (!f.exists) return [];
    const raw = JSON.parse(f.textSync()) as DownloadItem[];
    if (!Array.isArray(raw)) return [];
    // Anything mid-flight when the app died goes back to the queue.
    return raw.map((item) =>
      item.status === 'processing' || item.status === 'downloading' || item.status === 'saving'
        ? { ...item, status: 'queued' as const, progress: 0 }
        : item,
    );
  } catch {
    return [];
  }
}

function persistQueue(items: DownloadItem[]): void {
  try {
    queueFile().write(JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to persist download queue', err);
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let nextItemId = Date.now();

export function DownloadQueueProvider({ children }: { children: React.ReactNode }) {
  const { reloadLibrary } = usePlayer();

  const itemsRef = useRef<DownloadItem[]>(loadPersistedQueue());
  const [items, setItems] = useState<DownloadItem[]>(itemsRef.current);
  const pumping = useRef(false);

  const mutate = useCallback((updater: (prev: DownloadItem[]) => DownloadItem[]) => {
    itemsRef.current = updater(itemsRef.current);
    setItems(itemsRef.current);
    persistQueue(itemsRef.current);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<DownloadItem>) => {
      mutate((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
    },
    [mutate],
  );

  /** Process one queue item start-to-finish. */
  const processItem = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const base = getServerUrl();
      patch(id, { status: 'processing', error: undefined, progress: 0 });

      try {
        const jobId = await submitDownload(base, item.url, item.format);
        patch(id, { serverJobId: jobId });

        let consecutiveFailures = 0;
        for (let i = 0; i < 900; i++) {
          await sleep(800);

          let job: ServerJob;
          try {
            job = await getJob(base, jobId);
            consecutiveFailures = 0;
          } catch {
            if (++consecutiveFailures >= 15) {
              throw new Error('Lost connection to the server.');
            }
            continue;
          }

          if (job.status === 'error') {
            throw new Error(job.error || 'Download failed.');
          }
          if (job.status === 'downloading') {
            patch(id, {
              status: 'downloading',
              progress: job.progress || 0,
              title: job.title ?? undefined,
              artist: job.artist ?? undefined,
            });
          } else if (job.status === 'done') {
            patch(id, {
              status: 'saving',
              progress: 100,
              title: job.title ?? undefined,
              artist: job.artist ?? undefined,
            });
            const track = await importRemoteTrack({
              fileUrl: jobFileUrl(base, jobId),
              title: job.title || 'Unknown title',
              artist: job.artist || '',
              ext: job.ext || 'mp3',
            });
            if (job.analysis?.peaks?.length) {
              saveAnalysis(track.fileName, {
                peaks: job.analysis.peaks,
                pitch: job.analysis.pitch,
                durationSec: job.analysis.durationSec,
              });
            }
            reloadLibrary();
            patch(id, { status: 'done', trackId: track.id, completedAt: Date.now() });

            const label = [job.artist, job.title].filter(Boolean).join(' – ') || item.url;
            toast(`Downloaded: ${label}`, 'success');
            notifyDownloadComplete('Download complete', label);
            return;
          }
        }
        throw new Error('Timed out waiting for the download.');
      } catch (err: any) {
        const message = String(err?.message || err);
        patch(id, { status: 'error', error: message });
        toast(`Download failed: ${message}`, 'error');
      }
    },
    [patch, reloadLibrary],
  );

  /** Sequential pump: drains the queue one item at a time. */
  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    try {
      while (true) {
        const next = itemsRef.current.find((i) => i.status === 'queued');
        if (!next) break;
        await processItem(next.id);
      }
    } finally {
      pumping.current = false;
    }
  }, [processItem]);

  const enqueue = useCallback(
    (url: string, format?: DownloadFormat): boolean => {
      const trimmed = url.trim();
      if (!trimmed) return false;
      const duplicate = itemsRef.current.find(
        (i) => i.url === trimmed && ACTIVE_STATUSES.includes(i.status),
      );
      if (duplicate) {
        toast('Already in the download queue', 'info');
        return false;
      }
      const item: DownloadItem = {
        id: `dl-${nextItemId++}`,
        url: trimmed,
        format: format ?? getDownloadFormat(),
        status: 'queued',
        progress: 0,
        addedAt: Date.now(),
      };
      mutate((prev) => [...prev, item]);
      toast('Added to download queue', 'success');
      void pump();
      return true;
    },
    [mutate, pump],
  );

  const retry = useCallback(
    (id: string) => {
      patch(id, { status: 'queued', error: undefined, progress: 0 });
      void pump();
    },
    [patch, pump],
  );

  const remove = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      // Never yank an item that's mid-flight; UI disables this too.
      if (!item || item.status === 'processing' || item.status === 'downloading' || item.status === 'saving') {
        return;
      }
      mutate((prev) => prev.filter((i) => i.id !== id));
    },
    [mutate],
  );

  const clearCompleted = useCallback(() => {
    mutate((prev) => prev.filter((i) => i.status !== 'done'));
  }, [mutate]);

  // Startup: notifications setup + resume any queued work from last session.
  useEffect(() => {
    void initNotifications();
    void pump();
  }, [pump]);

  const activeCount = useMemo(
    () => items.filter((i) => ACTIVE_STATUSES.includes(i.status)).length,
    [items],
  );

  const value = useMemo<QueueContextValue>(
    () => ({ items, activeCount, enqueue, retry, remove, clearCompleted }),
    [items, activeCount, enqueue, retry, remove, clearCompleted],
  );

  return (
    <DownloadQueueContext.Provider value={value}>{children}</DownloadQueueContext.Provider>
  );
}

export function useDownloadQueue(): QueueContextValue {
  const ctx = useContext(DownloadQueueContext);
  if (!ctx) throw new Error('useDownloadQueue must be used within DownloadQueueProvider');
  return ctx;
}
