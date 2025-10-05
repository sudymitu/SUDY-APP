import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  imageSrc: string | null;
  aspect: number; // e.g., 16/9 or 9/16
}

const CropModal: React.FC<CropModalProps> = ({ isOpen, onClose, onSave, imageSrc, aspect }) => {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropContainerSize, setCropContainerSize] = useState({ width: 0, height: 0 });
  
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const resetState = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isOpen && imageSrc) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
        resetState();
      };
    }
  }, [isOpen, imageSrc, resetState]);

  useEffect(() => {
    if (!isOpen || !containerRef.current || !imageSize.width) return;

    const container = containerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    
    let cropW, cropH;
    if (containerW / containerH > aspect) { // Container is wider than aspect ratio
      cropH = containerH * 0.9;
      cropW = cropH * aspect;
    } else { // Container is taller
      cropW = containerW * 0.9;
      cropH = cropW / aspect;
    }
    setCropContainerSize({ width: cropW, height: cropH });

    const zoomFitWidth = cropW / imageSize.width;
    const zoomFitHeight = cropH / imageSize.height;
    const newMinZoom = Math.max(zoomFitWidth, zoomFitHeight);
    setMinZoom(newMinZoom);
    setZoom(newMinZoom);
    setPan({ x: 0, y: 0 });

  }, [isOpen, imageSize, aspect]);

  const clampPan = useCallback((newPan: {x: number, y: number}, currentZoom: number) => {
    const imgDisplayW = imageSize.width * currentZoom;
    const imgDisplayH = imageSize.height * currentZoom;

    const maxX = Math.max(0, (imgDisplayW - cropContainerSize.width) / 2);
    const maxY = Math.max(0, (imgDisplayH - cropContainerSize.height) / 2);
    
    return {
      x: Math.max(-maxX, Math.min(maxX, newPan.x)),
      y: Math.max(-maxY, Math.min(maxY, newPan.y)),
    };
  }, [cropContainerSize, imageSize]);

  useEffect(() => {
    setPan(currentPan => clampPan(currentPan, zoom));
  }, [zoom, clampPan]);


  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const newPan = {
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    };
    setPan(clampPan(newPan, zoom));
  };
  
  const handleMouseUpOrLeave = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = zoom - e.deltaY * 0.001;
    setZoom(Math.max(minZoom, Math.min(newZoom, 5)));
  };
  
  const handleSave = () => {
    if (!imageRef.current) return;

    const canvas = document.createElement('canvas');
    
    // The final output should have a decent resolution, not tied to screen display size.
    // Let's aim for a width of 1080 for 9:16 or height of 1080 for 16:9.
    const outputWidth = aspect > 1 ? 1920 : 1080;
    const outputHeight = outputWidth / aspect;

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cropWidthOnImage = cropContainerSize.width / zoom;
    const cropHeightOnImage = cropContainerSize.height / zoom;

    const cropXOnImage = (imageSize.width - cropWidthOnImage) / 2 - (pan.x / zoom);
    const cropYOnImage = (imageSize.height - cropHeightOnImage) / 2 - (pan.y / zoom);

    ctx.drawImage(
      imageRef.current,
      cropXOnImage,
      cropYOnImage,
      cropWidthOnImage,
      cropHeightOnImage,
      0, 0,
      outputWidth,
      outputHeight
    );
    
    onSave(canvas.toDataURL('image/jpeg', 0.95));
  };
  
  if (!isOpen || !imageSrc) return null;

  const imageStyle: React.CSSProperties = {
    position: 'absolute',
    width: imageSize.width,
    height: imageSize.height,
    top: '50%',
    left: '50%',
    // The translate for centering needs to be in the transform property to compose with pan/zoom
    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
    cursor: isPanning ? 'grabbing' : 'grab',
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl p-4 w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Crop Image</h2>
        <div ref={containerRef} className="flex-grow flex items-center justify-center bg-black/50 rounded-md">
            <div
                style={{ width: cropContainerSize.width, height: cropContainerSize.height, overflow: 'hidden', position: 'relative' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
            >
                <div style={imageStyle}>
                    <img ref={imageRef} src={imageSrc} alt="To crop" draggable={false} style={{ width: '100%', height: '100%', maxWidth: 'none' }} />
                </div>
            </div>
        </div>
        <div className="flex items-center gap-4 mt-4 text-white">
            <MagnifyingGlassMinusIcon className="w-5 h-5"/>
            <input
                type="range"
                min={minZoom}
                max={5}
                step={0.01}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <MagnifyingGlassPlusIcon className="w-5 h-5"/>
        </div>
        <div className="flex justify-end gap-4 mt-4">
            <button onClick={onClose} className="px-6 py-2 text-sm font-medium bg-gray-600 rounded-md hover:bg-gray-500 text-white">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Save Crop</button>
        </div>
      </div>
    </div>
  );
};

export default CropModal;
