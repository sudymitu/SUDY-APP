import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImageResult as ImageResultType, EnhanceState } from '../types';
import { DownloadIcon, SparklesIcon, ExpandIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

interface SideBySideComparisonProps {
  originalImageSrc: string | null;
  generatedResult: ImageResultType;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: () => void;
}

const SideBySideComparison: React.FC<SideBySideComparisonProps> = ({ originalImageSrc, generatedResult, onEnhance, onFullscreen }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handlePointerDown = () => {
    isDragging.current = true;
  };
  
  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newPos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(newPos);
  }, []);

  useEffect(() => {
    const currentContainer = containerRef.current;
    
    const moveHandler = (e: TouchEvent) => {
        if (!isDragging.current || !currentContainer) return;
        const rect = currentContainer.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const newPos = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPos(newPos);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    currentContainer?.addEventListener('touchmove', moveHandler);
    currentContainer?.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      currentContainer?.removeEventListener('touchmove', moveHandler);
      currentContainer?.removeEventListener('touchend', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:${generatedResult.mimeType};base64,${generatedResult.base64}`;
    link.download = `result_${generatedResult.id}_sudyapp.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleEnhanceClick = () => {
    onEnhance({ image: generatedResult.base64, mimeType: generatedResult.mimeType });
  };
  
  const generatedImageUrl = `data:${generatedResult.mimeType};base64,${generatedResult.base64}`;

  return (
    <div className="group relative w-full">
        <div ref={containerRef} className="relative aspect-square w-full select-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
            {/* Base Image (Original) */}
            {originalImageSrc && (
                <img
                    src={originalImageSrc}
                    alt="Original"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            )}
            {/* Top Image (Generated) */}
            <div
                className="absolute inset-0 w-full h-full"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
                <img
                    src={generatedImageUrl}
                    alt="Generated"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            </div>
            {/* Slider Handle */}
            <div
                className="absolute top-0 bottom-0 -ml-0.5 w-1 bg-white/80 cursor-ew-resize flex items-center justify-center z-10"
                style={{ left: `${sliderPos}%` }}
                onPointerDown={handlePointerDown}
                onTouchStart={handlePointerDown}
            >
                <div className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center text-gray-800 shadow-lg">
                    <ChevronLeftIcon className="w-4 h-4 -mr-1" />
                    <ChevronRightIcon className="w-4 h-4 -ml-1" />
                </div>
            </div>
             <input
                type="range"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                className="absolute inset-0 w-full h-full cursor-ew-resize opacity-0"
             />
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 space-x-2 z-20">
            <button onClick={handleDownload} className="p-2 bg-gray-800/80 rounded-full text-white hover:bg-blue-600 transition-colors" title="Download">
              <DownloadIcon className="w-6 h-6" />
            </button>
            <button onClick={handleEnhanceClick} className="p-2 bg-gray-800/80 rounded-full text-white hover:bg-blue-600 transition-colors" title="Enhance">
              <SparklesIcon className="w-6 h-6" />
            </button>
             <button onClick={onFullscreen} className="p-2 bg-gray-800/80 rounded-full text-white hover:bg-blue-600 transition-colors" title="View Fullscreen">
              <ExpandIcon className="w-6 h-6" />
            </button>
        </div>
    </div>
  );
};

export default SideBySideComparison;
