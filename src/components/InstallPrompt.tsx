import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Share, ChevronUp } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
    const { t } = useTranslation();
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [installState, setInstallState] = useState<'idle' | 'installing' | 'success'>('idle');

    useEffect(() => {
        // Check if prompt was dismissed in the last 90 days.
        const lastPrompt = localStorage.getItem('lastInstallPromptTime');
        const now = Date.now();

        // DEV OVERRIDE: 1 minute for easier testing
        const ninetyDaysInMs = 60 * 1000;

        // For testing/debugging, we might want to override the 90-day wait 
        if (lastPrompt && (now - parseInt(lastPrompt)) < ninetyDaysInMs) {
            console.log("Install prompt skipped due to recent interaction limit.");
            return;
        }

        // Detect iOS since it doesn't support the beforeinstallprompt event natively
        const userAgent = navigator.userAgent;
        const isIOSDevice = !!userAgent.match(/iPad/i) || !!userAgent.match(/iPhone/i);
        // iOS Safari does not support PWA install natively without 'Add to Home Screen' from Share Menu
        const isStandalone = ('standalone' in window.navigator) && ((window.navigator as any).standalone);

        if (isIOSDevice && !isStandalone) {
            console.log("iOS detected, showing manual installation prompt.");
            setIsIOS(true);
            setTimeout(() => setShowPrompt(true), 2000); // Slight delay for smoother UX
            return;
        }

        // Capture the PWA install prompt event for Android/Desktop Chrome
        const handleBeforeInstallPrompt = (e: Event) => {
            console.log("beforeinstallprompt event fired! Capturing banner.");
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setTimeout(() => setShowPrompt(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            // iOS flow is just dismissing Since it's a manual gesture via Safari Share menu
            handleDismiss();
            return;
        }

        if (!deferredPrompt) return;

        setInstallState('installing');

        // Show the native install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        // regardless of outcome, we clear the deferred prompt
        setDeferredPrompt(null);

        if (outcome === 'accepted') {
            setInstallState('success');
            localStorage.setItem('lastInstallPromptTime', Date.now().toString());
            setTimeout(() => {
                setShowPrompt(false);
            }, 5000); // Close automatically after success message
        } else {
            setInstallState('idle');
            handleDismiss();
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('lastInstallPromptTime', Date.now().toString());
    };

    return (
        <AnimatePresence>
            {showPrompt && (
                <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 9999, display: 'flex', justifyContent: 'center' }}>
                    <motion.div
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        style={{
                            width: '100%',
                            maxWidth: '500px',
                            background: '#ffffff',
                            borderTopLeftRadius: '24px',
                            borderTopRightRadius: '24px',
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
                            padding: '24px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '16px'
                        }}
                    >
                        {/* Drag Handle aesthetic */}
                        <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '8px' }} />

                        {installState === 'success' ? (
                            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '80px', height: '80px', background: '#bef264', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
                                    <ChevronUp size={48} />
                                </div>
                                <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0 }}>{t('install_success')}</h3>
                                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.5', margin: 0, maxWidth: '300px' }}>
                                    {t('install_success_desc')}
                                </p>
                                <button
                                    onClick={() => setShowPrompt(false)}
                                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', color: '#64748b', marginTop: '12px', cursor: 'pointer' }}
                                >
                                    حسناً
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div exit={{ scale: 0.9, opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
                                <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src="/vite.svg" alt="App Icon" style={{ width: '32px', height: '32px' }} />
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: '0 0 8px' }}>
                                        {isIOS ? t('ios_install_title') : t('install_title')}
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.5', margin: 0, maxWidth: '320px' }}>
                                        {isIOS ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                                {t('ios_install_desc').split('Share')[0]}
                                                <Share size={18} style={{ color: '#0f172a' }} />
                                                {t('ios_install_desc').split('Share')[1]}
                                            </span>
                                        ) : (
                                            t('install_desc')
                                        )}
                                    </p>
                                </div>

                                {!isIOS ? (
                                    <button
                                        onClick={handleInstallClick}
                                        disabled={installState === 'installing'}
                                        style={{
                                            width: '100%',
                                            background: '#f4d125',
                                            color: '#0f172a',
                                            border: 'none',
                                            padding: '16px',
                                            borderRadius: '16px',
                                            fontSize: '18px',
                                            fontWeight: '900',
                                            cursor: installState === 'installing' ? 'not-allowed' : 'pointer',
                                            opacity: installState === 'installing' ? 0.7 : 1,
                                            boxShadow: '0 4px 15px rgba(244, 209, 37, 0.3)',
                                            marginTop: '8px'
                                        }}
                                    >
                                        {installState === 'installing' ? t('installing') : t('install_btn')}
                                    </button>
                                ) : null}

                                <button
                                    onClick={handleDismiss}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#64748b',
                                        fontSize: '15px',
                                        fontWeight: '800',
                                        padding: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('not_now')}
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
