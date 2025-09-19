
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
            // Verifica suporte a mediaDevices
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Este navegador não suporta acesso à câmera (getUserMedia API)');
            }

            console.log('Iniciando acesso à câmera...');

            // Lista dispositivos disponíveis
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('Câmeras disponíveis:', videoDevices.length);
            videoDevices.forEach((device, index) => {
                console.log(`Câmera ${index + 1}:`, device.label || 'Sem nome');
            });

            // Para câmera anterior se existir
            if (stream) {
                console.log('Parando stream anterior...');
                stream.getTracks().forEach(track => track.stop());
            }

            // Tenta obter acesso à câmera
            console.log('Solicitando acesso à câmera...');
            const constraints = {
                video: { 
                    width: { ideal: 512 }, 
                    height: { ideal: 512 },
                    facingMode: 'user',
                    // Se houver câmeras disponíveis, tenta usar a primeira
                    ...(videoDevices.length > 0 ? { deviceId: { exact: videoDevices[0].deviceId } } : {})
                }
            };
            console.log('Usando constraints:', constraints);

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Stream obtido com sucesso');

            if (videoRef.current) {
                console.log('Configurando video element...');
                videoRef.current.srcObject = newStream;
                videoRef.current.onloadedmetadata = () => {
                    console.log('Metadados do vídeo carregados:', {
                        width: videoRef.current?.videoWidth,
                        height: videoRef.current?.videoHeight
                    });
                };
            } else {
                console.warn('Elemento de vídeo não encontrado');
            }

            setStream(newStream);
            onReady();
            console.log('Câmera inicializada com sucesso');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
            console.error('Erro detalhado ao acessar a câmera:', {
                name: err instanceof Error ? err.name : 'Unknown',
                message: errorMessage,
                fullError: err
            });
            onError(`Erro ao acessar a câmera: ${errorMessage}`);
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
                onCanPlay={() => {
                    console.log('Vídeo pronto para reprodução');
                    videoRef.current?.play().catch(e => {
                        console.error('Erro ao iniciar reprodução:', e);
                        onError('Não foi possível iniciar a reprodução do vídeo');
                    });
                }}
                onError={(e) => {
                    const error = (e.target as HTMLVideoElement).error;
                    console.error('Erro no elemento de vídeo:', error);
                    onError(`Erro na reprodução do vídeo: ${error?.message || 'Erro desconhecido'}`);
                }}
            />
            <canvas ref={canvasRef} className="hidden" />
        </>
    );
});
