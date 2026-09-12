import { useEffect, useRef } from 'react';

const CHECK_INTERVAL = 1000 * 30; // Check every 30 seconds

export const forceClearCacheAndReload = async () => {
    try {
        console.log('[VersionChecker] Forcing cache wipe and service worker unregistration...');
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                await reg.unregister();
            }
        }
        localStorage.removeItem('app_version');
    } catch (e) {
        console.error('[VersionChecker] Error clearing cache:', e);
    }
    window.location.href = window.location.pathname + '?refresh=' + Date.now();
};

export const VersionChecker = () => {
    const isChecking = useRef(false);

    useEffect(() => {
        const checkVersion = async () => {
            if (isChecking.current) return;
            isChecking.current = true;

            try {
                const response = await fetch(`/api/version?t=${Date.now()}`);
                if (!response.ok) return;
                const data = await response.json();
                
                const serverVersion = data.version;
                const serverCommit = data.commit;

                // Check if current client git hash differs from server commit
                // @ts-ignore
                const currentGitHash = typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : null;
                const cachedVersion = localStorage.getItem('app_version');

                const hasCommitMismatch = Boolean(serverCommit && currentGitHash && serverCommit !== 'unknown' && serverCommit !== currentGitHash);
                const hasVersionMismatch = Boolean(cachedVersion && cachedVersion !== serverVersion);

                if (hasCommitMismatch || hasVersionMismatch) {
                    console.log(`[VersionChecker] Update detected! Commit: ${currentGitHash} -> ${serverCommit}, Version: ${cachedVersion} -> ${serverVersion}`);
                    localStorage.setItem('app_version', serverVersion);
                    await forceClearCacheAndReload();
                    return;
                }

                if (!cachedVersion && serverVersion) {
                    localStorage.setItem('app_version', serverVersion);
                }
            } catch (error) {
                console.warn('[VersionChecker] Failed to check version:', error);
            } finally {
                isChecking.current = false;
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    return null;
};
