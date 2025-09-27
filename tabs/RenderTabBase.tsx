import React, { useState, useMemo, useRef } from 'react';
import FileUpload from '../components/FileUpload';
import SelectInput from '../components/SelectInput';
import Slider from '../components/Slider';
import { SparklesIcon, LoadingSpinner, WandIcon, TrashIcon, FolderOpenIcon, LockClosedIcon } from '../components/icons/index';
import { ASPECT_RATIO_KEYS, RENDER_VIEW_KEYS } from '../constants';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import ImageComparison from '../components/ImageComparison';
import { getBase64FromResponse, analyzeImageForRenderPrompt, generateImageFromImageAndText } from '../services/geminiService';
import { nanoid } from 'nanoid';
import MultiSelectCheckbox from '../components/MultiSelectCheckbox';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, fileToBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { useActivation } from '../contexts/ActivationContext';

interface RenderTabBaseProps {
  tabType: Tab;
  title: string;
  promptPlaceholder: string;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  renderViewKeys?: string[];
}

const RenderTabBase: React.FC<RenderTabBaseProps> = ({ tabType, title, promptPlaceholder, state, setState, onClear, onEnhance, onFullscreen, renderViewKeys = RENDER_VIEW_KEYS }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();


  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.map(key => t(key)), [t]);
  const translatedRenderViews = useMemo(() => renderViewKeys.map(key => t(key)), [t, renderViewKeys]);
  
  const canGenerateMultiple = useMemo(() => {
    return state.renderViews.length > 1 || (state.renderViews.length === 1 && state.renderViews[0] !== RENDER_VIEW_KEYS[0]);
  }, [state.renderViews]);

  const handleFileChange = async (file: File | null) => {
    if (file) {
      const dataUrl = await fileToDataURL(file);
      setState({ ...state, mainImageFile: file, mainImageUrl: dataUrl });
    } else {
      setState({ ...state, mainImageFile: null, mainImageUrl: null });
    }
  };
  
  const handleAnalyze = async () => {
      if (!state.mainImageFile) {
        setError(t('render.error.noImageAnalyze'));
        return;
      }
      setIsAnalyzing(true);
      setError(null);
      
      try {
          const { base64, mimeType } = await fileToBase64(state.mainImageFile);
          const prompts = await analyzeImageForRenderPrompt(base64, mimeType, state.prompt, language);
          
          // FIX: The `analyzeImageForRenderPrompt` service returns a single string, not an object.
          // This updates the main prompt with the returned string.
          setState({
            ...state,
            prompt: prompts,
          });

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
    if (!state.mainImageFile) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: []}));

    try {
        const sourceImageInfo = await fileToBase64(state.mainImageFile);
        
        const viewsToRender = state.renderViews.filter((v: string) => v !== RENDER_VIEW_KEYS[0]);
        if (viewsToRender.length === 0) {
            viewsToRender.push(RENDER_VIEW_KEYS[0]);
        }
        
        const generationPromises = [];

        for (let i = 0; i < state.numResults; i++) {
            const currentView = viewsToRender[i % viewsToRender.length];
            
            const fullPrompt = `
                **MASTER PROMPT:**
                """
                ${state.prompt}
                """

                **STYLE GUIDE (LoRA):**
                """
                ${state.loraPrompt}
                """

                **TECHNICAL REQUESTS:**
                - **Render View:** ${t(currentView)}
                - **Aspect Ratio:** ${t(state.aspectRatio)}

                **PRIMARY DIRECTIVE:**
                Your goal is a photorealistic enhancement and transformation. Use the source image as the primary base for structure, colors, and composition. Use the **MASTER PROMPT** and **STYLE GUIDE** to guide your stylistic changes. Add realistic lighting, shadows, and environmental context while adhering to the provided inputs. The final result should be a beautiful, high-quality architectural render that respects the source image but elevates it based on the prompts.

                **NEGATIVE PROMPTS:** watermark, text, signature, blurry, out of focus, cgi, render, unreal engine, fake.
            `;
            generationPromises.push(generateImageFromImageAndText(fullPrompt, sourceImageInfo.base64, sourceImageInfo.mimeType));
        }

        const responses = await Promise.all(generationPromises);
        
        const generationState = { ...state, mainImageFile: null, mainImageUrl: `data:${sourceImageInfo.mimeType};base64,${sourceImageInfo.base64}` };

        const newResults = responses
            .map((res): ImageResultType | null => {
                const b64 = getBase64FromResponse(res);
                if (!b64) return null;
                return { 
                  id: nanoid(), 
                  base64: b64, 
                  mimeType: 'image/jpeg',
                  generationInfo: {
                    originTab: tabType,
                    state: generationState
                  }
                };
            })
            .filter((r): r is ImageResultType => r !== null);
        
        if (newResults.length > 0) {
            setState((prevState: any) => ({ ...prevState, results: newResults }));
            newResults.forEach(addMedia);
            decrementQuota(10 * generationPromises.length);
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
      setIsGenerating(false);
    }
  };
  
  const handleLoadJsonClick = () => {
    if (!isActivated) {
      openActivationModal();
    } else {
      jsonInputRef.current?.click();
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                // Prettify the JSON for display
                const parsedContent = JSON.parse(content);
                setState({ ...state, loraPrompt: JSON.stringify(parsedContent, null, 2) });
                setError(null);
            } catch (err) {
                setError(t('render.error.readJsonFailed'));
                console.error(err);
            }
        };
        reader.readAsText(file);
    }
    if(e.target) e.target.value = '';
  };

  const canGenerate = !isGenerating && !isAnalyzing && !!state.mainImageFile;

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
      {/* Left Panel: Controls */}
      <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.upload.title')}</h3>
            <div className="w-full max-w-sm mx-auto lg:max-w-none lg:mx-0">
              <FileUpload id={`main-upload-${title}`} onFileChange={handleFileChange} previewUrl={state.mainImageUrl} onClear={() => setState({...state, mainImageFile: null, mainImageUrl: null})} containerClassName="h-60 lg:aspect-square" />
            </div>
        </div>
        
        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.prompt.title')}</h3>
            <textarea
                value={state.prompt}
                onChange={(e) => setState({ ...state, prompt: e.target.value })}
                placeholder={promptPlaceholder}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-24 resize-none"
            />
        </div>

        <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !state.mainImageFile}
            className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
            {isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : <WandIcon className="w-5 h-5" />}
            <span>{isAnalyzing ? t('render.button.analyzing') : t('render.button.optimizePrompt')}</span>
        </button>

         <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.lora.title')}</h3>
            <textarea
                value={state.loraPrompt}
                onChange={(e) => setState({ ...state, loraPrompt: e.target.value })}
                placeholder={t('render.lora.placeholder')}
                className="w-full bg-white dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-md p-2 h-32 resize-none font-mono text-xs"
            />
            <div className="flex space-x-2 pt-2">
                <input type="file" accept=".json" ref={jsonInputRef} onChange={handleJsonFileChange} className="hidden" />
                <button 
                  onClick={handleLoadJsonClick} 
                  title={!isActivated ? t('tooltip.requiresActivation') : t('render.button.loadLora')}
                  className={`w-full text-sm bg-gray-300/80 dark:bg-gray-700/80 text-gray-800 dark:text-white font-medium py-2 px-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 ${!isActivated ? 'opacity-50 cursor-pointer' : ''}`}
                >
                    <FolderOpenIcon className="w-4 h-4" />
                    <span>{t('render.button.loadLora')}</span>
                     {!isActivated && <LockClosedIcon className="w-3.5 h-3.5 ml-1" />}
                </button>
                 {state.loraPrompt && <p className="text-xs text-green-600 dark:text-green-400 px-1 pt-1 flex-grow text-right">{t('render.lora.loaded')}</p>}
            </div>
        </div>

        <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('enhance.creativeOptions.title')}</h3>
          
          <SelectInput 
              label={t('render.options.aspectRatio')} 
              options={translatedAspectRatios} 
              value={t(state.aspectRatio)} 
              onChange={(val) => {
                  const key = ASPECT_RATIO_KEYS[translatedAspectRatios.indexOf(val)];
                  setState({ ...state, aspectRatio: key });
              }} 
          />
        
          <MultiSelectCheckbox 
              label={t('render.options.renderView')} 
              options={translatedRenderViews} 
              selectedOptions={state.renderViews.map((v: string) => t(v))} 
              onChange={(selected) => {
                  const keys = selected.map(s => renderViewKeys[translatedRenderViews.indexOf(s)]);
                  setState({ ...state, renderViews: keys });
              }} 
          />
        
          <div>
            <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} disabled={!canGenerateMultiple && state.numResults > 1}/>
            {!canGenerateMultiple && <p className="text-xs text-gray-500 mt-1">{t('render.options.multipleResultsHint')}</p>}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
          <span>{isGenerating ? t('render.button.generating') : t('render.button.generate')}</span>
        </button>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('comparison.result')}</h2>
        
        {isGenerating && (
          <div className="flex flex-col items-center justify-center h-full">
            <LoadingSpinner className="w-12 h-12 text-blue-500" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">{t('render.status.generating')}</p>
          </div>
        )}
        {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>}
        
        {!isGenerating && state.results.length === 0 && !error && (
            <EmptyStateGuide tabType={tabType} />
        )}

        {state.results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.results.map((result: ImageResultType, index: number) => (
                    <ImageComparison 
                        key={result.id} 
                        originalImage={state.mainImageFile} 
                        generatedResult={result} 
                        onEnhance={onEnhance} 
                        onFullscreen={() => onFullscreen(state.results, index)} 
                    />
                ))}
            </div>
        )}

      </div>
    </div>
  );
};

export default RenderTabBase;