import { useCallback, useState } from 'react';

export type ThinkingOverlayState = {
  visible: boolean;
  failed: boolean;
  message?: string;
};

export type UseThinkingOverlay = {
  state: ThinkingOverlayState;
  start: () => void;
  success: () => void;
  fail: (msg?: string) => void;
  cancel: () => void;
  retry: (cb: () => Promise<void>) => () => void;
};

export function useThinkingOverlay(): UseThinkingOverlay {
  const [state, setState] = useState<ThinkingOverlayState>({ visible: false, failed: false });

  const start = useCallback(() => {
    setState({ visible: true, failed: false, message: undefined });
  }, []);

  const success = useCallback(() => {
    setState({ visible: false, failed: false, message: undefined });
  }, []);

  const fail = useCallback((msg?: string) => {
    setState({ visible: true, failed: true, message: msg });
  }, []);

  const cancel = useCallback(() => {
    setState({ visible: false, failed: false, message: undefined });
  }, []);

  const retry = useCallback((cb: () => Promise<void>) => {
    return () => {
      setState(s => ({ ...s, failed: false }));
      cb().catch(() => {
        setState({ visible: true, failed: true, message: 'Retry failed. Check connection and try again.' });
      });
    };
  }, []);

  return { state, start, success, fail, cancel, retry };
}
