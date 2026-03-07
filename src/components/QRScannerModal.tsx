import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

interface QRScannerModalProps {
    onClose: () => void;
    onScanSuccess: (code: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose, onScanSuccess }) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        let html5QrCode: Html5Qrcode;

        const startScanner = async () => {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length) {
                    setHasPermission(true);
                    html5QrCode = new Html5Qrcode("reader");
                    scannerRef.current = html5QrCode;

                    await html5QrCode.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0
                        },
                        (decodedText) => {
                            // Parse out the room code. It might be a full URL like "?room=ABCD12" or just the raw code.
                            try {
                                const url = new URL(decodedText);
                                const roomParam = url.searchParams.get('room');
                                if (roomParam) {
                                    onScanSuccess(roomParam);
                                } else {
                                    // Fallback: assume the code itself is the URL if it's 6 chars
                                    onScanSuccess(decodedText);
                                }
                            } catch (e) {
                                // Not a valid URL, so maybe they just generated a pure text QR code of XYZ
                                onScanSuccess(decodedText.trim().toUpperCase());
                            }
                        },
                        () => {
                            // Ignore standard frame scan failures as it scans constantly
                        }
                    );
                } else {
                    setHasPermission(false);
                }
            } catch (err) {
                console.error("Error asking for camera permissions", err);
                setHasPermission(false);
            }
        };

        startScanner();

        return () => {
            // Cleanup: stop scanner and wipe it when component unmounts
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
            }
        };
    }, [onScanSuccess]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            zIndex: 5000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{ width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Camera size={20} color="#0f172a" />
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>مسح رمز QR</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Scanner Body */}
                <div style={{ padding: '20px', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {hasPermission === false && (
                        <p style={{ textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>
                            لا يمكن الوصول إلى الكاميرا. يرجى التحقق من الأذونات.
                        </p>
                    )}
                    {hasPermission === null && (
                        <p style={{ textAlign: 'center', color: '#64748b' }}>جاري تشغيل الكاميرا...</p>
                    )}

                    <div id="reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', display: hasPermission ? 'block' : 'none' }}></div>
                </div>

                <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
                    وجه الكاميرا نحو رمز الدعوة الخاص بالغرفة
                </div>

            </div>
        </div>
    );
};
