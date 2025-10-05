import React, { useState, useEffect, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, TrashIcon } from '../components/icons/index';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import ImageComparison from '../components/ImageComparison';
import { upscaleImageTo4K, getBase64FromResponse } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { base64ToFile, fileToDataURL, fileToBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';

interface Upscale4KTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  onConsumeInitialState: () => void;
}

const Upscale4KTab: React.FC<Upscale4KTabProps> = ({ initialState, state, setState, onClear, onEnhance, onFullscreen, onConsumeInitialState }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { t } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { remaining, decrementQuota, forceQuotaDepletion } = useApiQuota();

  const handleFileChange = useCallback(async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        setState((s: any) => ({ ...s, sourceImageFile: file, sourceImageUrl: dataUrl, result: null }));
    } else {
        onClear();
    }
  }, [setState, onClear]);

  useEffect(() => {
    if (initialState) {
        const file = base64ToFile(initialState.image, `upscale-source-${nanoid(5)}.jpg`, initialState.mimeType);
        handleFileChange(file);
        onConsumeInitialState();
    }
  }, [initialState, handleFileChange, onConsumeInitialState]);

  const handleGenerate = async () => {
    if (!state.sourceImageFile) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    setIsGenerating(true);
    setError(null);

    try {
      const { base64, mimeType } = await fileToBase64(state.sourceImageFile);
      const response = await upscaleImageTo4K(base64, mimeType);
      const resultB64 = getBase64FromResponse(response);
      
      if (resultB64) {
        const generationState = { ...state, sourceImageFile: null, sourceImageUrl: `data:${mimeType};base64,${base64}` };
        const newResult: ImageResultType = {
          id: nanoid(),
          base64: resultB64,
          mimeType: 'image/jpeg',
          generationInfo: {
            originTab: Tab.Upscale4K,
            state: generationState,
          }
        };
        setState((prevState: any) => ({ ...prevState, result: newResult }));
        addMedia(newResult);
        decrementQuota(10);
      } else {
        setError(t('render.error.noImageInResponse'));
      }

    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('upscale.error.generateFailed'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = !isGenerating && !!state.sourceImageFile;

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
      <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('upscale.title')}</h2>
            <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        
        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('upscale.upload.title')}</h3>
            <div className="w-full max-w-sm mx-auto lg:max-w-none lg:mx-0">
              <FileUpload id="upscale-upload" onFileChange={handleFileChange} previewUrl={state.sourceImageUrl} onClear={() => handleFileChange(null)} containerClassName="h-60 lg:aspect-square" />
            </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md border border-yellow-300/50 dark:border-yellow-700/40">
            {t('upscale.note')}
        </p>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
          <span>{isGenerating ? t('render.button.generating') : t('upscale.button.generate')}</span>
        </button>
      </div>

      <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] flex items-center justify-center">
         {isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <LoadingSpinner className="w-12 h-12 text-blue-500" />
            <p className="mt-4 text-gray-600 dark:text-gray-400 font-semibold">{t('upscale.status.generating')}</p>
          </div>
        ) : error ? (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md text-center">{error}</div>
        ) : state.result ? (
             <ImageComparison
                originalImage={state.sourceImageFile}
                generatedResult={state.result}
                onEnhance={onEnhance}
                onFullscreen={() => onFullscreen([state.result], 0)}
                resultTitle={t('comparison.result')}
            />
        ) : (
            <EmptyStateGuide tabType={Tab.Upscale4K} />
        )}
      </div>
    </div>
  );
};

export default Upscale4KTab;
