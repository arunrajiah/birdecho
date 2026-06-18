import { useCallback, useEffect, useState } from 'react';
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from '../lib/appUpdate';

// Check at most once per app session — a launch-time banner, not a poller.
let checkedThisSession = false;

export interface AppUpdateState {
  update: UpdateInfo | null;
  installing: boolean;
  progress: number;
  error: string | null;
  install: () => Promise<void>;
  dismiss: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (checkedThisSession) return;
    checkedThisSession = true;
    checkForUpdate()
      .then(setUpdate)
      .catch(() => {
        /* offline / rate-limited — stay silent */
      });
  }, []);

  const install = useCallback(async () => {
    setInstalling(true);
    setError(null);
    setProgress(0);
    try {
      await downloadAndInstall(setProgress);
    } catch {
      setError('Download failed. Check your connection or open the Releases page.');
    } finally {
      setInstalling(false);
    }
  }, []);

  return {
    update: dismissed ? null : update,
    installing,
    progress,
    error,
    install,
    dismiss: () => setDismissed(true),
  };
}
