import React, { useState, useEffect, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, WandIcon, TrashIcon } from '../components/icons/index';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import ImageResult from '../components/ImageResult';
import { generateImageFromImageAndText, getBase64FromResponse, analyzeImagesWithText } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { base64ToFile, fileToDataURL, fileToBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';

interface TechnicalDrawingTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  onConsumeInitialState: () => void;
}

const TechnicalDrawingTab: React.FC<TechnicalDrawingTabProps> = ({ initialState, state, setState, onClear, onEnhance, onFullscreen, onConsumeInitialState }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { remaining, decrementQuota, forceQuotaDepletion } = useApiQuota();

  const handleFileChange = useCallback(async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        setState((s: any) => ({ ...s, sourceImageFile: file, sourceImageUrl: dataUrl }));
    } else {
        setState((s: any) => ({ ...s, sourceImageFile: null, sourceImageUrl: null }));
    }
  }, [setState]);

  useEffect(() => {
    if (initialState) {
        const file = base64ToFile(initialState.image, `tech-drawing-source-${nanoid(5)}.jpg`, initialState.mimeType);
        handleFileChange(file);
        onConsumeInitialState();
    }
  }, [initialState, handleFileChange, onConsumeInitialState]);
  
  const handleAnalyze = async () => {
    if (!state.sourceImageFile) {
      setError(t('render.error.noImageAnalyze'));
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const { base64, mimeType } = await fileToBase64(state.sourceImageFile);
      const analysisPrompt = `Analyze this architectural image (exterior or interior). Provide a concise, one-sentence description of its key geometric features, shapes, and structural elements. This will be used for technical drawings.
      
If the user has already written a description, use it as a starting point, refine it for accuracy and technical detail based on the image, but keep the core idea.
User's current description: "${state.prompt || 'Not provided'}"

For example, if the user writes "modern house" and the image shows a two-story flat-roofed building, a good refined prompt would be: 'A two-story modern house with a flat roof, large rectangular windows, and a cantilevered second floor.'`;
      const analysis = await analyzeImagesWithText(analysisPrompt, [{ base64, mimeType }], language);
      setState({ ...state, prompt: analysis });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('render.error.analyzeFailed'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!state.sourceImageFile) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    if (!state.prompt) {
      setError(t('techDraw.error.noPrompt'));
      return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: [] }));

    try {
      const { base64, mimeType } = await fileToBase64(state.sourceImageFile);
      const views = [
          { name: t('techDraw.result.front'), term: "front elevation" },
          { name: t('techDraw.result.left'), term: "left side elevation" },
          { name: t('techDraw.result.right'), term: "right side elevation" },
          { name: t('techDraw.result.rear'), term: "rear elevation" }
      ];

      const generationPromises = views.map(view => {
        const fullPrompt = `
        **Instruction:** Based on the provided image and this description: "${state.prompt}", generate a technical drawing of the **${view.term}**.
        **Output Style Requirements:** The drawing must be a **completely flat, 2D orthographic** projection. It must be a **clean, minimalist, black and white line drawing** in the style of a professional CAD program. The background must be pure white. Lines should be thin and precise.
        **Negative Prompts (CRITICAL):** Do NOT include any of the following: perspective, 3D rendering, shading, shadows, gradients, colors, textures, materials, text, dimensions, annotations, people, vegetation, or any realistic elements. The output must be the image only.
        `;
        return generateImageFromImageAndText(fullPrompt, base64, mimeType);
      });

      const responses = await Promise.all(generationPromises);

      const generationState = { ...state, sourceImageFile: null, sourceImageUrl: `data:${mimeType};base64,${base64}` };

      const newResults = responses
        .map((res): ImageResultType | null => {
            const b64 = getBase64FromResponse(res);
            if (!b64) return null;
            return { 
                id: nanoid(), 
                base64: b64, 
                mimeType: 'image/jpeg',
                generationInfo: {
                  originTab: Tab.TechnicalDrawing,
                  state: generationState,
                }
            };
        })
        .filter((r): r is ImageResultType => r !== null);


      if (newResults.length < 4) {
        setError(t('techDraw.error.partialResults', { count: String(newResults.length) }));
      }
      
      if (newResults.length > 0) {
        setState((prevState: any) => ({ ...prevState, results: newResults }));
        newResults.forEach(addMedia);
        decrementQuota(10);
      }

    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('techDraw.error.generateFailed'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = !isGenerating && !isAnalyzing && !!state.sourceImageFile && !!state.prompt;

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
      {/* Left Panel: Controls */}
      <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('techDraw.title')}</h2>
            <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        
        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('techDraw.upload.title')}</h3>
            <div className="w-full max-w-sm mx-auto lg:max-w-none lg:mx-0">
              <FileUpload id="tech-drawing-upload" onFileChange={handleFileChange} previewUrl={state.sourceImageUrl} onClear={() => handleFileChange(null)} containerClassName="h-60 lg:aspect-square" />
            </div>
        </div>

        <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !state.sourceImageFile}
            className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
            {isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : <WandIcon className="w-5 h-5" />}
            <span>{isAnalyzing ? t('render.button.analyzing') : t('render.button.analyze')}</span>
        </button>

        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('techDraw.prompt.title')}</h3>
            <textarea
                value={state.prompt}
                onChange={(e) => setState({ ...state, prompt: e.target.value })}
                placeholder={t('techDraw.prompt.placeholder')}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-24 resize-none"
            />
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md border border-yellow-300/50 dark:border-yellow-700/40">
            {t('techDraw.note')}
        </p>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
          <span>{isGenerating ? t('render.button.generating') : t('techDraw.button.generate')}</span>
        </button>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('comparison.result')}</h2>
         {(isAnalyzing || isGenerating) && (
          <div className="flex flex-col items-center justify-center h-full">
            <LoadingSpinner className="w-12 h-12 text-blue-500" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t('techDraw.status.generating')}</p>
          </div>
        )}
        {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>}
        
        {!isGenerating && state.results.length === 0 && !error && (
            <EmptyStateGuide tabType={Tab.TechnicalDrawing} />
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {state.results.map((result: ImageResultType, index: number) => (
                <ImageResult key={result.id} result={result} onEnhance={onEnhance} onFullscreen={() => onFullscreen(state.results, index)} />
            ))}
        </div>
      </div>
    </div>
  );
};

export default TechnicalDrawingTab;
