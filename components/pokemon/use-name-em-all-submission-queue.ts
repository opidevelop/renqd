"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type QueuedSubmission<T> = {
  answer: string;
  key: number;
  value: T;
};

export function useNameEmAllSubmissionQueue<T>(
  processSubmission: (answer: string, value: T) => Promise<void>,
) {
  const queueRef = useRef<QueuedSubmission<T>[]>([]);
  const queuedKeysRef = useRef<Set<number>>(new Set());
  const processingRef = useRef(false);
  const processRef = useRef(processSubmission);
  useEffect(() => { processRef.current = processSubmission; }, [processSubmission]);
  const [pending, setPending] = useState(false);

  const enqueue = useCallback((answer: string, value: T, key: number) => {
    if (!answer.trim() || queuedKeysRef.current.has(key)) return false;
    queuedKeysRef.current.add(key);
    queueRef.current.push({ answer, value, key });

    if (!processingRef.current) {
      processingRef.current = true;
      setPending(true);
      void (async () => {
        while (queueRef.current.length > 0) {
          const next = queueRef.current.shift();
          if (!next) continue;
          try {
            await processRef.current(next.answer, next.value);
          } catch {
            // The caller owns visible error handling; keep the queue moving.
          } finally {
            queuedKeysRef.current.delete(next.key);
          }
        }
        processingRef.current = false;
        setPending(false);
      })();
    }
    return true;
  }, []);

  return { enqueue, pending, queuedKeysRef };
}
