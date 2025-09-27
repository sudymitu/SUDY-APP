import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileUpload from '../components/FileUpload';
// FIX: Imported VideoCameraIcon to resolve reference error.
import { SparklesIcon, LoadingSpinner, TrashIcon, WandIcon, VideoCameraIcon } from '../components/icons/index';
import { EnhanceState, Tab, VideoResult } from '../types';
import { startVideoGeneration, checkVideoOperationStatus, optimizeVideoPrompt } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { base64ToFile, fileToDataURL, fileToBase64, dataURLtoBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import VideoResultComponent from '../components/VideoResult';
import CropModal from '../components/CropModal';

interface VeoTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onConsumeInitialState: () => void;
}

const VeoTab: React.FC<VeoTabProps> = ({ initialState, state, setState, onClear, onConsumeInitialState }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState('');
  const [pollingMessageIndex, setPollingMessageIndex] = useState(0);
  const isPollingRef = useRef(false);

  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();

  const handleFileChange = useCallback(async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        // This setState will trigger the useEffect below to check for cropping
        setState((s: any) => ({ ...s, sourceImageFile: file, sourceImageUrl: dataUrl, result: null }));
    } else {
        onClear();
    }
  }, [setState, onClear]);

  useEffect(() => {
    if (initialState) {
        const file = base64ToFile(initialState.image, `veo-source-${nanoid(5)}.jpg`, initialState.mimeType);
        handleFileChange(file);
        onConsumeInitialState();
    }
  }, [initialState, handleFileChange, onConsumeInitialState]);

  // Effect to check and trigger cropping whenever the image or aspect ratio changes.
  useEffect(() => {
    if (state.sourceImageUrl) {
      const img = new Image();
      img.src = state.sourceImageUrl;
      img.onload = () => {
        const imageRatio = img.naturalWidth / img.naturalHeight;
        const targetRatio = state.aspectRatio === '16:9' ? 16 / 9 : 9 / 16;
        if (Math.abs(imageRatio - targetRatio) > 0.01) { // Tolerance for float precision
          setImageToCrop(state.sourceImageUrl);
          setIsCropModalOpen(true);
        } else {
          // If it already matches, ensure the modal is closed.
          setIsCropModalOpen(false);
          setImageToCrop(null);
        }
      };
    }
  }, [state.aspectRatio, state.sourceImageUrl]);


   const handleCropComplete = (croppedDataUrl: string) => {
    setState((s: any) => ({ 
        ...s, 
        sourceImageUrl: croppedDataUrl, 
        result: null 
    }));
    setIsCropModalOpen(false);
    setImageToCrop(null);
  };
  
  const handleOptimizePrompt = async () => {
    if (!state.prompt.trim()) {
      return;
    }
    setIsOptimizing(true);
    setError(null);
    try {
        const optimized = await optimizeVideoPrompt(state.prompt, language);
        setState({ ...state, prompt: optimized });
    } catch (e) {
        console.error(e);
        setError(t('quickGenerate.optimize.error'));
    } finally {
        setIsOptimizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!state.sourceImageUrl) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    if (!state.prompt.trim()) {
        setError(t('quickGenerate.error.noPrompt'));
        return;
    }

    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, result: null }));
    isPollingRef.current = true;

    try {
        const { base64, mimeType } = dataURLtoBase64(state.sourceImageUrl);

        setGenerationStatus(t('veo.status.starting'));
        let operation = await startVideoGeneration(state.prompt, base64, mimeType, state.aspectRatio);
        
        const pollingMessages = [
            t('veo.status.polling_1'),
            t('veo.status.polling_2'),
            t('veo.status.polling_3'),
            t('veo.status.polling_4'),
        ];
        
        while (isPollingRef.current && !operation.done) {
            setGenerationStatus(pollingMessages[pollingMessageIndex % pollingMessages.length]);
            setPollingMessageIndex(prev => prev + 1);
            await new Promise(resolve => setTimeout(resolve, 10000));
            if (!isPollingRef.current) break;
            operation = await checkVideoOperationStatus(operation);
        }

        if (!isPollingRef.current) { // Check if cancelled
            setIsGenerating(false);
            setGenerationStatus('');
            return;
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
            setGenerationStatus(t('veo.status.downloading'));
            const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
            
            const blob = await response.blob();
            const videoUrl = URL.createObjectURL(blob);
            
            const newResult: VideoResult = {
                id: nanoid(),
                url: videoUrl,
                posterBase64: base64,
                generationInfo: {
                    originTab: Tab.Veo,
                    state: { ...state, sourceImageFile: null, sourceImageUrl: `data:${mimeType};base64,${base64}` }
                }
            };
            setState((prevState: any) => ({ ...prevState, result: newResult }));
            addMedia(newResult);
            decrementQuota(25); // Video generation is expensive
        } else {
            setError(t('veo.error.noDownloadLink'));
        }

    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('veo.error.generateFailed'));
      }
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
      setPollingMessageIndex(0);
      isPollingRef.current = false;
    }
  };

  const handleCancel = () => {
      isPollingRef.current = false;
      setIsGenerating(false);
      setGenerationStatus('');
  };

  const canGenerate = !isGenerating && !!state.sourceImageUrl && !!state.prompt.trim();

  const aspectButtonClass = (ratio: '16:9' | '9:16') => {
    const base = 'w-full text-sm font-semibold py-2 px-3 rounded-md transition-colors';
    return state.aspectRatio === ratio
      ? `${base} bg-blue-600 text-white shadow-md`
      : `${base} bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600`;
  };

  return (
    <>
      <CropModal 
        isOpen={isCropModalOpen}
        onClose={() => setIsCropModalOpen(false)}
        onSave={handleCropComplete}
        imageSrc={imageToCrop}
        aspect={state.aspectRatio === '16:9' ? 16/9 : 9/16}
      />
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
        {/* Left Panel: Controls */}
        <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('veo.title')}</h2>
              <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                  <TrashIcon className="w-5 h-5" />
              </button>
          </div>
          
          <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('veo.upload.title')}</h3>
              <div className="w-full max-w-sm mx-auto lg:max-w-none lg:mx-0">
                <FileUpload id="veo-upload" onFileChange={handleFileChange} previewUrl={state.sourceImageUrl} onClear={() => handleFileChange(null)} containerClassName="h-60 lg:aspect-square" />
              </div>
          </div>
          
          <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">Aspect Ratio</h3>
              <div className="flex gap-2">
                <button onClick={() => setState({...state, aspectRatio: '16:9'})} className={aspectButtonClass('16:9')}>16:9 Landscape</button>
                <button onClick={() => setState({...state, aspectRatio: '9:16'})} className={aspectButtonClass('9:16')}>9:16 Portrait</button>
              </div>
          </div>

          <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('veo.prompt.title')}</h3>
              <textarea
                  value={state.prompt}
                  onChange={(e) => setState({ ...state, prompt: e.target.value })}
                  placeholder={t('veo.prompt.placeholder')}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-32 resize-none"
              />
          </div>
          <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('quickGenerate.optimize.title')}</h3>
              <button 
                  onClick={handleOptimizePrompt}
                  disabled={isOptimizing || !state.prompt.trim()}
                  className="w-full py-2 px-2 rounded-md text-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                      {isOptimizing ? <LoadingSpinner className="w-4 h-4"/> : <WandIcon className="w-4 h-4"/>}
                      <span>{isOptimizing ? t('quickGenerate.optimize.optimizing') : t('veo.button.optimize')}</span>
              </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md border border-yellow-300/50 dark:border-yellow-700/40">
              {t('veo.note')}
          </p>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
            <span>{isGenerating ? t('render.button.generating') : t('veo.button.generate')}</span>
          </button>
        </div>

        {/* Right Panel: Results */}
        <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] flex items-center justify-center">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <LoadingSpinner className="w-12 h-12 text-blue-500" />
              <p className="mt-4 text-gray-600 dark:text-gray-400 font-semibold">{generationStatus || t('veo.status.generating')}</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">{t('veo.status.generatingHint')}</p>
              <button onClick={handleCancel} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Cancel</button>
            </div>
          ) : error ? (
              <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md text-center">{error}</div>
          ) : state.result ? (
              <div className="w-full max-w-lg mx-auto">
                  <VideoResultComponent result={state.result} viewMode="single" />
              </div>
          ) : (
              <div className="text-center text-gray-500">
                  <div className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600">
                      <VideoCameraIcon />
                  </div>
                  <h3 className="mt-2 text-lg font-medium text-gray-800 dark:text-gray-300">Video Generation</h3>
                  <p>Results will appear here.</p>
              </div>
          )}
        </div>
      </div>
    </>
  );
};

export default VeoTab;