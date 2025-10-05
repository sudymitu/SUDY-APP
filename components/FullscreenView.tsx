import React, { useState, useEffect, useRef } from 'react';
import { ImageResult } from '../types';
import { DownloadIcon, ChevronLeftIcon, ChevronRightIcon, DocumentDuplicateIcon, ArrowPathIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ChatBubbleOvalLeftEllipsisIcon, XMarkIcon } from './icons';
import { nanoid } from 'nanoid';

interface FullscreenViewProps {
  images: ImageResult[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSave: (newImage: ImageResult) => void;
  onSendToChatbot: (image: ImageResult) => void;
}

const FilterSlider: React.FC<{label: string, value: number, onChange: (val: number) => void, min: number, max: number, unit: string}> = 
({ label, value, onChange, min, max, unit }) => (
  <div>
    <label className="text-xs text-gray-300 flex justify-between">
      <span>{label}</span>
      <span>{value}{unit}</span>
    </label>
    <input
      type="range"
      min={min} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
    />
  </div>
);

const FullscreenView: React.FC<FullscreenViewProps> = ({ images, currentIndex, onClose, onNext, onPrev, onSave, onSendToChatbot }) => {
  const currentImage = images[currentIndex];
  const imageRef = useRef<HTMLImageElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  
  const initialFilters = { brightness: 100, contrast: 100, saturate: 100, balance: 0 };
  const [filters, setFilters] = useState(initialFilters);

  const [imageInfo, setImageInfo] = useState<{ name: string; dimensions: string; size: string; } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onClose]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFilters(initialFilters);
    if (currentImage && imageRef.current) {
      const img = imageRef.current;
      const calculateInfo = () => {
        const dimensions = `${img.naturalWidth} x ${img.naturalHeight}`;
        const sizeInBytes = Math.ceil((currentImage.base64.length / 4) * 3);
        const size = sizeInBytes > 1024 * 1024
          ? `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`
          : `${(sizeInBytes / 1024).toFixed(2)} KB`;
        const name = `result_${currentImage.id}_sudyapp.jpg`;
        setImageInfo({ name, dimensions, size });
      };
      if (img.complete) calculateInfo();
      else img.onload = calculateInfo;
    }
  }, [currentImage]);


  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:${currentImage.mimeType};base64,${currentImage.base64}`;
    link.download = `result_${currentImage.id}_sudyapp.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFilterString = (f: typeof initialFilters) => {
    let balanceFilter = '';
    if (f.balance > 0) { // Warm effect
        const amount = f.balance / 100 * 0.5; 
        balanceFilter = `sepia(${amount})`;
    } else if (f.balance < 0) { // Cool effect
        const amount = Math.abs(f.balance) / 100;
        // A common trick for a cooling filter is to use hue-rotate towards cyan/blue
        balanceFilter = `hue-rotate(-${amount * 15}deg)`;
    }
    return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) ${balanceFilter}`.trim();
  };
  
  const handleSave = () => {
    const img = imageRef.current;
    if (!img) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.filter = getFilterString(filters);
    ctx.drawImage(img, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const base64 = dataUrl.split(',')[1];
    
    const newImage: ImageResult = {
      id: nanoid(),
      base64,
      mimeType: 'image/jpeg',
      generationInfo: currentImage.generationInfo,
    };
    onSave(newImage);
    alert('Edited image saved to library!');
    onClose();
  };

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    panStartRef.current = { x: clientX - pan.x, y: clientY - pan.y };
  };

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPan({ x: clientX - panStartRef.current.x, y: clientY - panStartRef.current.y });
  };
  
  const handlePanEnd = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const newZoom = zoom - e.deltaY * 0.001;
    const clampedZoom = Math.max(1, Math.min(newZoom, 5));
    if (clampedZoom === 1) setPan({x: 0, y: 0});
    setZoom(clampedZoom); 
  };
  
  const imageStyle: React.CSSProperties = {
    filter: getFilterString(filters),
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
    transition: isPanning ? 'none' : 'transform 0.1s ease-out',
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain'
  };

  const uiContainerClass = `transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={() => setUiVisible(prev => !prev)}
    >
      <div className={`absolute top-4 right-4 flex items-center space-x-4 z-10 ${uiContainerClass}`}>
        <button className="text-white hover:text-blue-400 transition-colors" title="Download Image" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
          <DownloadIcon className="w-8 h-8" />
        </button>
        <button className="text-white text-5xl font-bold" onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close"><XMarkIcon className="w-8 h-8"/></button>
      </div>

      {images.length > 1 && (
        <div className={uiContainerClass}>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full hover:bg-white/30 text-white z-10" onClick={(e) => { e.stopPropagation(); onPrev(); }} title="Previous">
            <ChevronLeftIcon className="w-8 h-8"/>
          </button>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full hover:bg-white/30 text-white z-10" onClick={(e) => { e.stopPropagation(); onNext(); }} title="Next">
            <ChevronRightIcon className="w-8 h-8"/>
          </button>
        </div>
      )}

      <div 
        className="w-full h-full flex items-center justify-center p-16 overflow-hidden" 
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onTouchStart={handlePanStart}
        onTouchMove={handlePanMove}
        onTouchEnd={handlePanEnd}
        onWheel={handleWheel}
        onClick={(e) => e.stopPropagation()}
      >
        {currentImage && (
          <img 
            ref={imageRef}
            src={`data:${currentImage.mimeType};base64,${currentImage.base64}`} 
            alt="Fullscreen view" 
            style={imageStyle}
            draggable={false}
            onClick={() => setUiVisible(prev => !prev)}
          />
        )}
      </div>

      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-80 bg-gray-800/80 p-2 rounded-lg flex items-center space-x-3 text-white backdrop-blur-sm ${uiContainerClass}`} onClick={e => e.stopPropagation()}>
        <MagnifyingGlassMinusIcon className="w-5 h-5"/>
        <input type="range" min="1" max="5" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
        <MagnifyingGlassPlusIcon className="w-5 h-5"/>
      </div>
      
      <div className={`absolute top-1/2 -translate-y-1/2 right-4 w-64 bg-gray-800/80 p-4 rounded-lg space-y-4 text-white backdrop-blur-sm ${uiContainerClass}`} onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-lg border-b border-gray-600 pb-2">Image Details</h3>
          {imageInfo && (
            <div className="text-xs space-y-1 text-gray-300">
                <p><strong className="text-gray-100">Name:</strong> <span className="break-all">{imageInfo.name}</span></p>
                <p><strong className="text-gray-100">Size:</strong> {imageInfo.size}</p>
                <p><strong className="text-gray-100">Dimensions:</strong> {imageInfo.dimensions}</p>
            </div>
          )}
          <h3 className="font-bold text-lg border-b border-gray-600 pb-2 pt-2">Actions & Adjustments</h3>
          <div className="space-y-3">
            <button onClick={() => onSendToChatbot(currentImage)} className="w-full flex items-center justify-center gap-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md py-2 transition-colors">
              <ChatBubbleOvalLeftEllipsisIcon className="w-5 h-5" /> Send to Chatbot
            </button>
            <FilterSlider label="Brightness" value={filters.brightness} onChange={v => setFilters(f => ({...f, brightness: v}))} min={50} max={150} unit="%"/>
            <FilterSlider label="Contrast" value={filters.contrast} onChange={v => setFilters(f => ({...f, contrast: v}))} min={50} max={200} unit="%"/>
            <FilterSlider label="Saturation" value={filters.saturate} onChange={v => setFilters(f => ({...f, saturate: v}))} min={0} max={200} unit="%"/>
            <FilterSlider label="Color Balance" value={filters.balance} onChange={v => setFilters(f => ({...f, balance: v}))} min={-100} max={100} unit=""/>
          </div>
          <div className="flex space-x-2 pt-2">
            <button onClick={() => setFilters(initialFilters)} className="w-full flex items-center justify-center gap-2 text-sm bg-gray-600 hover:bg-gray-500 rounded-md py-2 transition-colors">
              <ArrowPathIcon className="w-4 h-4" /> Reset
            </button>
            <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md py-2 transition-colors">
              <DocumentDuplicateIcon className="w-4 h-4" /> Save
            </button>
          </div>
      </div>
    </div>
  );
};

export default FullscreenView;