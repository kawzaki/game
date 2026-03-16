import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COOLING_PERIOD_MS = 2 * 30 * 24 * 60 * 60 * 1000; // 2 months

const PWAInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [hasScrolled, setHasScrolled] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);

        const handleScroll = () => {
            if (window.scrollY > 150) {
                setHasScrolled(true);
            }
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    useEffect(() => {
        if (!deferredPrompt || !hasScrolled) return;

        // Check if already in standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
        if (isStandalone) return;

        // Check cooling period from localStorage
        const lastDismissed = localStorage.getItem('pwa_install_prompt_dismissed');
        if (lastDismissed) {
            const timePassed = Date.now() - parseInt(lastDismissed, 10);
            if (timePassed < COOLING_PERIOD_MS) {
                console.log('PWA Install Prompt in cooling period');
                return;
            }
        }

        setIsVisible(true);
    }, [deferredPrompt, hasScrolled]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        
        // Show the prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        // We once used the prompt, clear it
        setDeferredPrompt(null);
        setIsVisible(false);
        
        // Set cooling period even if accepted or dismissed
        localStorage.setItem('pwa_install_prompt_dismissed', Date.now().toString());
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('pwa_install_prompt_dismissed', Date.now().toString());
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        left: '20px',
                        right: '20px',
                        zIndex: 2000,
                        background: '#fff',
                        padding: '16px',
                        borderRadius: '20px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        border: '1px solid #e2e8f0',
                        direction: 'rtl',
                        maxWidth: '500px',
                        margin: '0 auto'
                    }}
                >
                    <div style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '12px', 
                        background: 'var(--brand-yellow)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0,
                        boxShadow: '0 4px 10px rgba(251, 191, 36, 0.3)'
                    }}>
                        <Download size={22} color="#000" strokeWidth={2.5} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: '15px', color: '#1e293b', marginBottom: '2px' }}>ثبّت التطبيق! 📱</div>
                        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>تمتع بتجربة لعب أسرع وأسهل دائمًا من الشاشة الرئيسية.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                            onClick={handleInstall}
                            style={{ 
                                background: '#000', 
                                color: '#fff', 
                                border: 'none', 
                                padding: '10px 20px', 
                                borderRadius: '12px', 
                                fontWeight: 900, 
                                fontSize: '14px', 
                                cursor: 'pointer',
                                transition: 'transform 0.1s active',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                        >
                            تثبيت
                        </button>
                        <button 
                            onClick={handleDismiss}
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: '#94a3b8', 
                                cursor: 'pointer', 
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PWAInstallPrompt;
