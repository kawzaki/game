import { useEffect, useRef } from 'react';

const CHECK_INTERVAL = 1000 * 60 * 5; // Check every 5 minutes

export const VersionChecker = () => {
    const currentVersion = useRef<string | null>(null);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                const response = await fetch('/api/version');
                const data = await response.json();
                const serverVersion = data.version;

                if (!currentVersion.current) {
                    // First check on mount
                    const cachedVersion = localStorage.getItem('app_version');
                    if (cachedVersion && cachedVersion !== serverVersion) {
                        console.log(`Version mismatch detected on startup: ${cachedVersion} -> ${serverVersion}`);
                        localStorage.setItem('app_version', serverVersion);
                        window.location.reload();
                    } else {
                        currentVersion.current = serverVersion;
                        localStorage.setItem('app_version', serverVersion);
                    }
                    return;
                }

                if (serverVersion !== currentVersion.current) {
                    console.log(`New version available: ${serverVersion}`);
                    localStorage.setItem('app_version', serverVersion);
                    window.location.reload();
                }
            } catch (error) {
                console.error('Failed to check version:', error);
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    return null; // This component doesn't render anything
};
