
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

interface CameraFeedProps {
    onReady: () => void;
    onError: (message: string) => void;
}

export interface CameraFeedRef {
    captureFrame: () => { base64Data: string, mimeType: string } | null;
    startStream: () => void;
}

export const CameraFeed = forwardRef<CameraFeedRef, CameraFeedProps>(({ onReady, onError }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isMirrored, setIsMirrored] = useState(true);

    const startStream = async () => {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            const newStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 512 }, 
                    height: { ideal: 512 },
                    facingMode: 'user' 
                } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
            setStream(newStream);
            onReady();
        } catch (err) {
            console.error("Erro ao acessar a câmera:", err);
            onError("Não foi possível acessar a câmera. Por favor, verifique as permissões no seu navegador.");
        }
    };
    
    useEffect(() => {
        startStream();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
        captureFrame: () => {
            if (videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    if (isMirrored) {
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                    }
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const mimeType = 'image/jpeg';
                    const base64Data = canvas.toDataURL(mimeType).split(',')[1];
                    return { base64Data, mimeType };
                }
            }
            return null;
        },
        startStream: () => {
             if (videoRef.current && stream) {
                videoRef.current.play();
             }
        }
    }));

    return (
        <>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isMirrored ? 'transform scale-x-[-1]' : ''}`}
                onCanPlay={() => videoRef.current?.play()}
            />
            <canvas ref={canvasRef} className="hidden" />
        </>
    );
});
