import { useState, useRef, useEffect } from 'react';

/**
 * Hook pour gérer la caméra et la capture de selfie
 * Retourne les refs video/canvas et les fonctions pour start/capture/retake
 */
export function useBuzzerCamera() {
  const [photoData, setPhotoData] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Erreur caméra:', err);
      setError('Impossible d\'accéder à la caméra. Vous pouvez continuer sans photo.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const takeSelfie = () => {
    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setPhotoData(imageData);

      stopCamera();
    }
  };

  const retakeSelfie = () => {
    setPhotoData(null);
    startCamera();
  };

  // Cleanup: arrêter la caméra au démontage du composant
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    photoData,
    error,
    startCamera,
    stopCamera,
    takeSelfie,
    retakeSelfie,
    setPhotoData,
    setError
  };
}
