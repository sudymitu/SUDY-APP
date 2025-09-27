import React, { useState, useCallback, useEffect, useRef } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, ChevronUpIcon, ChevronDownIcon, ArrowPathIcon, ExpandIcon, SelectionIcon, ArrowUturnDownIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, CursorArrowRaysIcon } from '../components/icons';
import { ImageResult as ImageResultType, EnhanceState } from '../types';
import { generateImageFromImageAndText, getBase64FromResponse } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, dataURLtoBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import Slider from '../components/Slider';

const cropDataURL = (dataUrl: string, crop: { x: number, y: number, width: number, height: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const sourceX = img.naturalWidth * crop.x;
            const sourceY = img.naturalHeight * crop.y;
            const sourceWidth = img.naturalWidth * crop.width;
            const sourceHeight = img.naturalHeight * crop.height;

            if (sourceWidth <= 0 || sourceHeight <= 0) {
                reject(new Error("Crop dimensions must be positive."));
                return;
            }

            // Aim for a resolution around 1MP for quality, respecting aspect ratio.
            const TARGET_PIXELS = 1024 * 1024;
            const aspectRatio = sourceWidth / sourceHeight;
            
            const targetWidth = Math.sqrt(TARGET_PIXELS * aspectRatio);
            const targetHeight = targetWidth / aspectRatio;

            canvas.width = Math.round(targetWidth);
            canvas.height = Math.round(targetHeight);

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            } else {
                reject(new Error("Could not get canvas context."));
            }
        };
        img.onerror = () => reject(new Error("Failed to load image for cropping."));
        img.src = dataUrl;
    });
};


interface VirtualTourTabProps {
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
}

const VirtualTourTab: React.FC<VirtualTourTabProps> = ({ state, setState, onClear, onEnhance, onFullscreen }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const [activeTool, setActiveTool] = useState<'navigate' | 'select'>('navigate');
  const [selection, setSelection] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const { t } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();

  const currentImageUrl = state.history[state.historyIndex];

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelection(null);
  }, [currentImageUrl]);

  useEffect(() => {
    if (timelineRef.current && state.historyIndex >= 0) {
        const activeElement = timelineRef.current.children[state.historyIndex] as HTMLElement;
        if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [state.historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isLoading || isSelecting) return;

        if (e.key === 'ArrowLeft' && state.historyIndex > 0) {
            setState((prevState: any) => ({ ...prevState, historyIndex: prevState.historyIndex - 1 }));
        } else if (e.key === 'ArrowRight' && state.historyIndex < state.history.length - 1) {
            setState((prevState: any) => ({ ...prevState, historyIndex: prevState.historyIndex + 1 }));
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.history.length, state.historyIndex, setState, isLoading, isSelecting]);


  const handleFileChange = useCallback(async (file: File | null) => {
    if (file) {
      const dataUrl = await fileToDataURL(file);
      setState((s: any) => ({ 
        ...s, 
        originalImageFile: file, 
        originalImageUrl: dataUrl, 
        history: [dataUrl],
        historyIndex: 0,
      }));
    } else {
      onClear();
    }
  }, [setState, onClear]);

  const handleNavigate = useCallback(async (direction: string, options?: { region?: {startX: number, startY: number, endX: number, endY: number} }) => {
    if (!currentImageUrl) {
      setError(t('virtualTour.error.noImage'));
      return;
    }
    setIsLoading(true);
    setError(null);
    setSelection(null);

    try {
      let imageToSend: { base64: string, mimeType: string };
      let finalPrompt: string;

      if(direction === 'ai-zoom' && options?.region) {
          const { region } = options;
          const cropRect = {
              x: Math.min(region.startX, region.endX),
              y: Math.min(region.startY, region.endY),
              width: Math.abs(region.endX - region.startX),
              height: Math.abs(region.endY - region.startY),
          };
          
          const croppedDataUrl = await cropDataURL(currentImageUrl, cropRect);
          imageToSend = dataURLtoBase64(croppedDataUrl);
          finalPrompt = t('virtualTour.prompts.aiZoom');
      } else {
          imageToSend = dataURLtoBase64(currentImageUrl);
          const intensityKey = `virtualTour.prompts.intensity.${state.movementIntensity}`;
          const intensityDescription = t(intensityKey);
          const directionPrompts: Record<string, string> = {
            'forward': t('virtualTour.prompts.forward', { intensityDescription }),
            'backward': t('virtualTour.prompts.backward', { intensityDescription }),
            'strafe-left': t('virtualTour.prompts.strafeLeft', { intensityDescription }),
            'strafe-right': t('virtualTour.prompts.strafeRight', { intensityDescription }),
            'move-up': t('virtualTour.prompts.moveUp', { intensityDescription }),
            'move-down': t('virtualTour.prompts.moveDown', { intensityDescription }),
            'look-left': t('virtualTour.prompts.lookLeft'),
            'look-right': t('virtualTour.prompts.lookRight'),
            'look-up': t('virtualTour.prompts.lookUp'),
            'look-down': t('virtualTour.prompts.lookDown'),
            'turn-180': t('virtualTour.prompts.turn180'),
          };
          const navigationCommand = directionPrompts[direction];
          finalPrompt = t('virtualTour.prompts.main', {
              navigationCommand: navigationCommand,
              userPrompt: state.prompt || t('none')
          });
      }
      
      const response = await generateImageFromImageAndText(finalPrompt, imageToSend.base64, imageToSend.mimeType);
      const resultB64 = getBase64FromResponse(response);

      if (resultB64) {
        const newImageUrl = `data:image/jpeg;base64,${resultB64}`;
        
        setState((prevState: any) => {
            const newHistory = prevState.history.slice(0, prevState.historyIndex + 1);
            newHistory.push(newImageUrl);
            return {
                ...prevState,
                history: newHistory,
                historyIndex: newHistory.length - 1,
            };
        });
        
        const newImageForLibrary: ImageResultType = { id: nanoid(), base64: resultB64, mimeType: 'image/jpeg' };
        addMedia(newImageForLibrary);
        decrementQuota(5);
        setActiveTool('navigate');
      } else {
        setError(t('render.error.noImageInResponse'));
      }

    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('render.error.generateFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentImageUrl, state.movementIntensity, state.prompt, t, setState, addMedia, decrementQuota, forceQuotaDepletion]);

  const handleGoToSelection = () => {
    if (selection && (Math.abs(selection.endX - selection.startX) > 0.05 || Math.abs(selection.endY - selection.startY) > 0.05)) {
        handleNavigate('ai-zoom', { region: selection });
    }
  };

  const handleReset = () => {
      if (state.originalImageUrl) {
          setState({ ...state, history: [state.originalImageUrl], historyIndex: 0 });
      }
  };
  
  const handleTimelineClick = (index: number) => {
    setState({ ...state, historyIndex: index });
  };

  const getRelativeCoords = useCallback((e: MouseEvent | TouchEvent) => {
    const container = imageContainerRef.current;
    const img = imageRef.current;
    if (!container || !img) return null;
    const containerRect = container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const imgRect = img.getBoundingClientRect();
    const relativeX = (clientX - imgRect.left) / imgRect.width;
    const relativeY = (clientY - imgRect.top) / imgRect.height;

    return {
        containerX: clientX - containerRect.left,
        containerY: clientY - containerRect.top,
        imageX: Math.max(0, Math.min(1, relativeX)),
        imageY: Math.max(0, Math.min(1, relativeY)),
    };
  }, []);

  const handleContainerMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getRelativeCoords(e.nativeEvent);
    if (!coords) return;
    if (activeTool === 'select') {
        setIsSelecting(true);
        setSelection({ startX: coords.imageX, startY: coords.imageY, endX: coords.imageX, endY: coords.imageY });
    } else if (activeTool === 'navigate' && zoom > 1) {
        setIsPanning(true);
        panStartRef.current = { x: coords.containerX - pan.x, y: coords.containerY - pan.y };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
        const coords = getRelativeCoords(e);
        if (!coords) return;
        if (isSelecting && selection) {
            setSelection(prev => prev ? { ...prev, endX: coords.imageX, endY: coords.imageY } : null);
        } else if (isPanning) {
            setPan({ x: coords.containerX - panStartRef.current.x, y: coords.containerY - panStartRef.current.y });
        }
    };
    const handleMouseUp = () => {
        setIsSelecting(false);
        setIsPanning(false);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleMouseMove);
        window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isSelecting, isPanning, selection, pan, getRelativeCoords]);
  
  const handleWheel = (e: React.WheelEvent) => {
    const newZoom = zoom - e.deltaY * 0.005;
    const clampedZoom = Math.max(1, Math.min(newZoom, 5));
    if (clampedZoom === 1) setPan({x: 0, y: 0});
    setZoom(clampedZoom);
  };

  const imageStyle: React.CSSProperties = {
    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
    cursor: activeTool === 'select' ? 'crosshair' : (isPanning ? 'grabbing' : (zoom > 1 ? 'grab' : 'default')),
    transition: isPanning ? 'none' : 'transform 0.1s ease-out',
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  };
  
  const selectionStyle: React.CSSProperties = selection ? {
      position: 'absolute',
      left: `${Math.min(selection.startX, selection.endX) * 100}%`,
      top: `${Math.min(selection.startY, selection.endY) * 100}%`,
      width: `${Math.abs(selection.endX - selection.startX) * 100}%`,
      height: `${Math.abs(selection.endY - selection.startY) * 100}%`,
      border: '2px dashed #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      pointerEvents: 'none',
  } : {};
  
  const toolButtonClass = (tool: 'navigate' | 'select') => `flex-1 p-3 rounded-md hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 ${activeTool === tool ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`;

  const NavButton: React.FC<{ direction: string; label: string; icon: React.ReactNode; className?: string }> = ({ direction, label, icon, className }) => (
    <button
      onClick={() => handleNavigate(direction)}
      disabled={isLoading || !currentImageUrl}
      title={label}
      className={`p-3 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center aspect-square ${className}`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
      {/* Left Panel: Controls */}
      <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('VirtualTour')}</h2>
            <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        
        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('virtualTour.upload.title')}</h3>
            <FileUpload id="virtual-tour-upload" onFileChange={handleFileChange} previewUrl={state.originalImageUrl} onClear={onClear} containerClassName="h-48" />
        </div>

        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('virtualTour.prompt.title')}</h3>
            <textarea value={state.prompt} onChange={e => setState({ ...state, prompt: e.target.value })} placeholder={t('virtualTour.prompt.placeholder')} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-24 resize-none" />
        </div>
        
        <div className="space-y-4 border-t border-gray-300 dark:border-gray-700 pt-4">
             <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 text-center">{t('virtualTour.controls.tools')}</h3>
             <div className="flex gap-2">
                 <button onClick={() => { setActiveTool('navigate'); setSelection(null); }} className={toolButtonClass('navigate')}>
                    <CursorArrowRaysIcon className="w-6 h-6"/> <span>{t('virtualTour.controls.navigate')}</span>
                 </button>
                 <button onClick={() => setActiveTool('select')} className={toolButtonClass('select')}>
                    <SelectionIcon className="w-6 h-6"/> <span>{t('virtualTour.controls.selectRegion')}</span>
                 </button>
             </div>
             {selection && activeTool === 'select' && (
                <button onClick={handleGoToSelection} className="w-full mt-2 p-3 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2" disabled={isLoading}>
                    {isLoading ? <LoadingSpinner className="w-5 h-5"/> : <SparklesIcon className="w-5 h-5"/>}
                    <span>{t('virtualTour.controls.goToSelection')}</span>
                </button>
             )}
        </div>

        <div className="space-y-4 border-t border-gray-300 dark:border-gray-700 pt-4">
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 text-center">{t('virtualTour.controls.title')}</h3>
            <Slider label={t('virtualTour.controls.intensity')} min={1} max={5} step={1} value={state.movementIntensity} onChange={(v) => setState({ ...state, movementIntensity: v })} />
            <div className="flex justify-around items-start">
                <div className="flex flex-col items-center gap-2">
                    <h4 className="text-sm font-semibold mb-1">{t('virtualTour.controls.move')}</h4>
                    <NavButton direction="forward" label={t('virtualTour.controls.forward')} icon={<ArrowUpIcon className="w-6 h-6"/>}/>
                    <div className="flex gap-2">
                         <NavButton direction="strafe-left" label={t('virtualTour.controls.strafeLeft')} icon={<ArrowLeftIcon className="w-6 h-6"/>}/>
                         <NavButton direction="backward" label={t('virtualTour.controls.backward')} icon={<ArrowDownIcon className="w-6 h-6"/>}/>
                         <NavButton direction="strafe-right" label={t('virtualTour.controls.strafeRight')} icon={<ArrowRightIcon className="w-6 h-6"/>}/>
                    </div>
                    <div className="flex gap-2 w-full pt-1">
                        <NavButton direction="move-up" label={t('virtualTour.controls.moveUp')} icon={<span className="font-bold text-sm">UP</span>} className="flex-1"/>
                        <NavButton direction="move-down" label={t('virtualTour.controls.moveDown')} icon={<span className="font-bold text-sm">DOWN</span>} className="flex-1"/>
                    </div>
                </div>

                 <div className="flex flex-col items-center gap-2">
                    <h4 className="text-sm font-semibold mb-1">{t('virtualTour.controls.look')}</h4>
                    <NavButton direction="look-up" label={t('virtualTour.controls.lookUp')} icon={<ChevronUpIcon className="w-6 h-6"/>}/>
                     <div className="flex gap-2">
                        <NavButton direction="look-left" label={t('virtualTour.controls.lookLeft')} icon={<ArrowUturnLeftIcon className="w-6 h-6"/>}/>
                        <NavButton direction="turn-180" label={t('virtualTour.controls.turn180')} icon={<ArrowUturnDownIcon className="w-6 h-6"/>} />
                        <NavButton direction="look-right" label={t('virtualTour.controls.lookRight')} icon={<ArrowUturnRightIcon className="w-6 h-6"/>}/>
                    </div>
                     <NavButton direction="look-down" label={t('virtualTour.controls.lookDown')} icon={<ChevronDownIcon className="w-6 h-6"/>}/>
                </div>
            </div>
             <button onClick={handleReset} title={t('virtualTour.controls.reset')} className="w-full mt-4 p-3 bg-red-500/20 text-red-500 rounded-md hover:bg-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center" disabled={isLoading}><ArrowPathIcon className="w-6 h-6"/></button>
        </div>
      </div>

      <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] flex flex-col items-center justify-center">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <LoadingSpinner className="w-12 h-12 text-blue-500" />
                <p className="mt-4 text-gray-600 dark:text-gray-400 font-semibold">{t('virtualTour.status.generating')}</p>
            </div>
        ) : error ? (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md text-center">{error}</div>
        ) : currentImageUrl ? (
            <div className="w-full h-full flex flex-col gap-4">
                <div 
                    ref={imageContainerRef}
                    className="flex-grow relative group overflow-hidden bg-black/20 rounded-lg"
                    onMouseDown={handleContainerMouseDown}
                    onWheel={handleWheel}
                >
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                        <img ref={imageRef} src={currentImageUrl} alt="Current view" style={imageStyle}/>
                        {selection && <div className="absolute inset-0 pointer-events-none"><div style={selectionStyle}></div></div>}
                    </div>
                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setZoom(z => Math.min(5, z + 0.5))} className="p-2 bg-gray-800/60 text-white rounded-md hover:bg-gray-700"><MagnifyingGlassPlusIcon className="w-5 h-5"/></button>
                        <button onClick={() => setZoom(z => z > 1 ? Math.max(1, z - 0.5) : 1)} className="p-2 bg-gray-800/60 text-white rounded-md hover:bg-gray-700"><MagnifyingGlassMinusIcon className="w-5 h-5"/></button>
                    </div>
                </div>
                {state.history.length > 1 && (
                    <div className="flex-shrink-0">
                        <h3 className="text-sm font-semibold mb-2 text-center">{t('virtualTour.timeline.title')}</h3>
                         <div ref={timelineRef} className="flex gap-2 overflow-x-auto p-2 bg-gray-200 dark:bg-gray-900/50 rounded-lg no-scrollbar">
                            {state.history.map((imgSrc: string, index: number) => (
                                <img
                                    key={index}
                                    src={imgSrc}
                                    alt={`History step ${index + 1}`}
                                    onClick={() => handleTimelineClick(index)}
                                    className={`h-20 w-auto rounded-md cursor-pointer border-4 ${index === state.historyIndex ? 'border-blue-500' : 'border-transparent hover:border-gray-400'}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        ) : (
            <div className="text-center text-gray-500">
                <p>{t('render.status.placeholder')}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default VirtualTourTab;
