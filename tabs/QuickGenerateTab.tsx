import React, { useState, useMemo, useRef, useEffect } from 'react';
import SelectInput from '../components/SelectInput';
import Slider from '../components/Slider';
import { SparklesIcon, LoadingSpinner, FolderOpenIcon, TrashIcon, WandIcon, LockClosedIcon } from '../components/icons/index';
import { ASPECT_RATIO_KEYS, IMAGE_GENERATION_MODELS } from '../constants';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import ImageResult from '../components/ImageResult';
import { generateImageFromText, optimizePrompt } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { ARCH_PROMPTS, INTERIOR_PROMPTS } from '../promptSuggestions';
import { useActivation } from '../contexts/ActivationContext';

interface QuickGenerateTabProps {
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
}

const QuickGenerateTab: React.FC<QuickGenerateTabProps> = ({ state, setState, onClear, onEnhance, onFullscreen }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ arch: string[], interior: string[] }>({ arch: [], interior: [] });
  
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { remaining, decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();

  useEffect(() => {
    const shuffleArray = (array: string[]) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    setSuggestions({
        arch: shuffleArray(ARCH_PROMPTS).slice(0, 6),
        interior: shuffleArray(INTERIOR_PROMPTS).slice(0, 6)
    });
  }, []);

  const translatedModels = useMemo(() => IMAGE_GENERATION_MODELS.map(m => ({ ...m, name: t(m.nameKey) })), [t]);
  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.filter(r => r !== 'aspect.original').map(key => t(key)), [t]);

  const handleSuggestionClick = (suggestion: string) => {
    setState((prevState: any) => ({
      ...prevState,
      prompt: prevState.prompt ? `${prevState.prompt}, ${suggestion}` : suggestion
    }));
  };

  const handleOptimizePrompt = async () => {
    if (!state.prompt.trim()) {
        setError(t('quickGenerate.error.noPrompt'));
        return;
    }
    setIsOptimizing(true);
    setError(null);
    try {
        const optimized = await optimizePrompt(state.prompt, language);
        setState({ ...state, prompt: optimized });
    } catch (e) {
        console.error(e);
        setError(t('quickGenerate.optimize.error'));
    } finally {
        setIsOptimizing(false);
    }
  };

  const handleGenerate = async () => {
      if (!state.prompt.trim()) {
          setError(t('quickGenerate.error.noPrompt'));
          return;
      }

      setIsGenerating(true);
      setError(null);
      setState((prevState: any) => ({ ...prevState, results: [] }));

      const finalPrompt = `
        **LoRA/Trained Style:** ${state.loraPrompt || 'None'}
        **User Prompt:** ${state.prompt}
        **Creativity Level (0=faithful, 10=highly creative):** ${state.creativity}`;

      try {
          const resultBase64s = await generateImageFromText(finalPrompt, t(state.aspectRatio), state.numResults, state.imageModel);
          const newResults = resultBase64s.map(base64 => ({ 
            id: nanoid(), 
            base64, 
            mimeType: 'image/jpeg',
            generationInfo: {
              originTab: Tab.QuickGenerate,
              state: { ...state, results: [] }
            }
          }));
          setState((prevState: any) => ({ ...prevState, results: newResults }));
          newResults.forEach(addMedia);
          decrementQuota(15);
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
                const json = JSON.parse(content);
                if (json.trainedStylePrompt && typeof json.trainedStylePrompt === 'string') {
                    setState({ ...state, loraPrompt: json.trainedStylePrompt });
                    setError(null);
                } else {
                    setError(t('render.error.invalidJson'));
                }
            } catch (err) {
                setError(t('render.error.readJsonFailed'));
                console.error(err);
            }
        };
        reader.readAsText(file);
    }
    if(e.target) e.target.value = '';
  };

  const SuggestionButton: React.FC<{suggestion: string}> = ({ suggestion }) => (
    <button
      onClick={() => handleSuggestionClick(suggestion)}
      className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full px-3 py-1 hover:bg-blue-500/50 dark:hover:bg-blue-600/60 transition-colors text-left"
    >
      {suggestion.split(',')[0]}
    </button>
  );
  
  const canGenerate = !isGenerating && !isOptimizing && !!state.prompt.trim();

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
      {/* Left Panel: Controls */}
      <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('quickGenerate.title')}</h2>
            <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        
        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.prompt.title')}</h3>
            <textarea value={state.prompt} onChange={e => setState({ ...state, prompt: e.target.value })} placeholder={t('quickGenerate.prompt.placeholder')} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-32 resize-none" />
        </div>
        
        <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('quickGenerate.optimize.title')}</h3>
            <button 
                onClick={handleOptimizePrompt}
                disabled={isOptimizing || !state.prompt.trim()}
                className="w-full py-2 px-2 rounded-md text-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                    {isOptimizing ? <LoadingSpinner className="w-4 h-4"/> : <WandIcon className="w-4 h-4"/>}
                    <span>{isOptimizing ? t('quickGenerate.optimize.optimizing') : t('quickGenerate.optimize.button')}</span>
            </button>
        </div>
        
        <div className="space-y-4">
            <div>
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.suggestions.arch')}</h3>
                <div className="flex flex-wrap gap-2">
                    {suggestions.arch.map((p, i) => <SuggestionButton key={`arch-${i}`} suggestion={p} />)}
                </div>
            </div>
             <div>
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.suggestions.interior')}</h3>
                <div className="flex flex-wrap gap-2">
                    {suggestions.interior.map((p, i) => <SuggestionButton key={`int-${i}`} suggestion={p} />)}
                </div>
            </div>
        </div>


        <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('quickGenerate.options.title')}</h3>
             <SelectInput
                label={t('quickGenerate.options.model')}
                options={translatedModels.map(m => m.name)}
                value={translatedModels.find(m => m.value === state.imageModel)?.name || ''}
                onChange={(name) => {
                    const model = translatedModels.find(m => m.name === name);
                    if (model) setState({ ...state, imageModel: model.value });
                }}
            />
            <Slider label={t('enhance.options.creativity')} min={0} max={10} step={1} value={state.creativity} onChange={(v) => setState({ ...state, creativity: v })} />
            <p className="text-xs text-gray-500 -mt-3 px-1">{t('enhance.options.creativityHint')}</p>

            <SelectInput 
                label={t('render.options.aspectRatio')} 
                options={translatedAspectRatios} 
                value={t(state.aspectRatio)} 
                onChange={(val) => {
                    const key = ASPECT_RATIO_KEYS.find(k => t(k) === val);
                    if(key) setState({ ...state, aspectRatio: key });
                }} 
            />
            <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />

             <div>
                <input type="file" accept=".json" ref={jsonInputRef} onChange={handleJsonFileChange} className="hidden" />
                <button 
                  onClick={handleLoadJsonClick}
                  title={!isActivated ? t('tooltip.requiresActivation') : t('quickGenerate.button.loadLora')}
                  className={`w-full text-sm bg-gray-300/80 dark:bg-gray-700/80 text-gray-800 dark:text-white font-medium py-2 px-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 ${!isActivated ? 'opacity-50 cursor-pointer' : ''}`}
                >
                    <FolderOpenIcon className="w-4 h-4" />
                    <span>{t('quickGenerate.button.loadLora')}</span>
                    {!isActivated && <LockClosedIcon className="w-3 h-3 text-yellow-500 ml-1" />}
                </button>
                {state.loraPrompt && <p className="text-xs text-green-600 dark:text-green-400 px-1 pt-1">{t('render.lora.loaded')}</p>}
            </div>
            
            <button onClick={handleGenerate} disabled={!canGenerate} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                 {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                 <span>{t('render.button.generate')}</span>
            </button>
        </div>

      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('comparison.result')}</h2>
         {isGenerating && (
          <div className="flex flex-col items-center justify-center h-full">
            <LoadingSpinner className="w-12 h-12 text-blue-500" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t('quickGenerate.status.generating')}</p>
          </div>
        )}
        {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>}
        
        {!isGenerating && state.results.length === 0 && !error && (
            <EmptyStateGuide tabType={Tab.QuickGenerate} />
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {state.results.map((result: ImageResultType, index: number) => (
                <ImageResult key={result.id} result={result} onEnhance={onEnhance} onFullscreen={() => onFullscreen(state.results, index)} />
            ))}
        </div>
      </div>
    </div>
  );
};

export default QuickGenerateTab;