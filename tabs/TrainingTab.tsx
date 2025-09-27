import React, { useState, useRef, useEffect, useMemo } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, DownloadIcon, FolderOpenIcon, TrashIcon, LockClosedIcon } from '../components/icons/index';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import ImageResult from '../components/ImageResult';
import { analyzeTrainingImages, generateImageFromImageAndText, getBase64FromResponse, generateImageFromText } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { base64ToFile, fileToBase64, dataURLtoBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { useActivation } from '../contexts/ActivationContext';
import DrawingCanvas, { DrawingCanvasRef } from '../components/DrawingCanvas';
import Slider from '../components/Slider';
import SelectInput from '../components/SelectInput';
import { IMAGE_GENERATION_MODELS, ASPECT_RATIO_KEYS } from '../constants';

interface TrainingTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  onConsumeInitialState: () => void;
}

const TrainingTab: React.FC<TrainingTabProps> = ({ initialState, state, setState, onClear, onEnhance, onFullscreen, onConsumeInitialState }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const drawingCanvasRef = useRef<DrawingCanvasRef>(null);
  const { t } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { remaining, decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();
  
  const translatedModels = useMemo(() => IMAGE_GENERATION_MODELS.map(m => ({ ...m, name: t(m.nameKey) })), [t]);
  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.filter(r => r !== 'aspect.original').map(key => t(key)), [t]);

  useEffect(() => {
    if (initialState) {
        const file = base64ToFile(initialState.image, `training-ref-${nanoid(5)}.jpg`, initialState.mimeType);
        setState((prevState: any) => {
            const newRefImages = [...prevState.refImages];
            newRefImages[0] = file;
            return { ...prevState, refImages: newRefImages };
        });
        onConsumeInitialState();
    }
  }, [initialState, setState, onConsumeInitialState]);

  const handleFileChange = (index: number) => (file: File | null) => {
    setState((prevState: any) => {
        const newImages = [...prevState.refImages];
        newImages[index] = file;
        return { ...prevState, refImages: newImages };
    });
  };

  const handleAnalyze = async () => {
    const validImages = state.refImages.filter((f: File | null): f is File => f !== null);
    if (validImages.length === 0) {
      setError(t('training.error.noRefImages'));
      return;
    }
    setIsAnalyzing(true);
    setError(null);

    try {
      const imageDatas = await Promise.all(validImages.map(file => fileToBase64(file)));
      const analysis = await analyzeTrainingImages(state.descriptionPrompt, imageDatas);
      setState({ ...state, analysisResult: analysis });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('training.error.analyzeFailed'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateSketch = async () => {
    const sketchDataUrl = drawingCanvasRef.current?.getCanvasDataURL();
      if (!sketchDataUrl) {
          setError(t('training.error.noSketch'));
          return;
      }

      if (!state.analysisResult && !state.generationPrompt) {
          setError(t('training.error.noPrompt'));
          return;
      }
      
      setIsGenerating(true);
      setError(null);
      setState((prevState: any) => ({ ...prevState, results: [] }));

      try {
          const sketchImage = dataURLtoBase64(sketchDataUrl);

          const generationPromises = [];
          for (let i = 0; i < state.numResults; i++) {
              const finalPrompt = `
                **Task:** Render a photorealistic architectural image based on the provided sketch.
                **Style Guidance (CRITICAL):** Strictly adhere to the following detailed style analysis. This is the primary stylistic instruction.
                **Style Analysis:** """${state.analysisResult || 'A realistic architectural style.'}"""
                ---
                **Additional User Instructions:** ${state.generationPrompt || 'None'}
                ---
                **Creativity Level (0=Strictly adhere to sketch and style, 10=Highly creative interpretation):** ${state.creativity}
                **Negative Prompts:** Do not show text, watermarks, or signatures. Avoid blurry or out-of-focus results.
              `;
              generationPromises.push(generateImageFromImageAndText(finalPrompt, sketchImage.base64, sketchImage.mimeType));
          }
          
          const responses = await Promise.all(generationPromises);
          
          const generationState = { ...state, refImages: [], results: [] };

          const newResults = responses
              .map((res): ImageResultType | null => {
                  const b64 = getBase64FromResponse(res);
                  if (!b64) return null;
                  return { 
                    id: nanoid(), 
                    base64: b64, 
                    mimeType: 'image/jpeg',
                    generationInfo: {
                      originTab: Tab.ImageFromReference,
                      state: generationState
                    }
                  };
              })
              .filter((r): r is ImageResultType => r !== null);

          if (newResults.length > 0) {
              setState((prevState: any) => ({ ...prevState, results: newResults }));
              newResults.forEach(addMedia);
              decrementQuota(5 * newResults.length);
          } else {
              setError(t('render.error.noImageInResponse'));
          }

      } catch (e) {
          console.error(e);
          if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
            setError(t('error.apiQuotaExceeded'));
            forceQuotaDepletion();
          } else {
            setError(t('training.error.generateFailed'));
          }
      } finally {
          setIsGenerating(false);
      }
  };

  const handleGenerateText = async () => {
    if (!state.analysisResult && !state.generationPrompt.trim()) {
        setError(t('training.error.noPrompt'));
        return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: [] }));

    try {
        const finalPrompt = `
            **Style Prompt (LoRA):** """${state.analysisResult}"""
            ---
            **Scene Description:** ${state.generationPrompt}
            ---
            **Instructions:** Create a high-quality, photorealistic architectural image. The primary style MUST be derived from the "Style Prompt (LoRA)". The "Scene Description" dictates the content of the image.
            **Creativity Level (0=Strict, 10=Artistic):** ${state.creativity}
        `;

        const resultBase64s = await generateImageFromText(
            finalPrompt,
            t(state.aspectRatio),
            state.numResults,
            state.imageModel
        );
        
        const generationState = { ...state, refImages: [], results: [] };
        
        const newResults = resultBase64s.map(base64 => ({ 
            id: nanoid(), 
            base64, 
            mimeType: 'image/jpeg',
            generationInfo: {
                originTab: Tab.ImageFromReference,
                state: generationState
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
  
  const handleSaveJson = () => {
    if (!state.analysisResult) return;
    const jsonContent = JSON.stringify({ trainedStylePrompt: state.analysisResult }, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trained_style.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
                    setState({ ...state, analysisResult: json.trainedStylePrompt });
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

  const canGenerate = !isGenerating && !isAnalyzing && (!!state.analysisResult || !!state.generationPrompt.trim());
  const modeButtonClass = (mode: 'text' | 'sketch') => {
      const base = 'w-full py-2 px-4 text-sm font-semibold rounded-md transition-colors focus:outline-none';
      if (state.generationMode === mode) {
          return `${base} bg-blue-600 text-white shadow`;
      }
      return `${base} bg-transparent text-gray-600 dark:text-gray-300 hover:bg-blue-200 dark:hover:bg-blue-900/50`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
      {/* Left Panel: Controls */}
      <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('training.title')}</h2>
            <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        
        {/* Step 1 & 2: Train Style */}
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">1. {t('training.prompt.title')}</h3>
            <textarea value={state.descriptionPrompt} onChange={e => setState({...state, descriptionPrompt: e.target.value})} placeholder={t('training.prompt.placeholder')} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-24 resize-none" />

            <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('training.upload.ref.title')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('training.upload.ref.hint')}</p>
              <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                      <FileUpload 
                          key={i} 
                          id={`ref-upload-training-${i}`} 
                          onFileChange={handleFileChange(i)} 
                          previewUrl={state.refImages[i] ? URL.createObjectURL(state.refImages[i]) : null}
                          onClear={() => handleFileChange(i)(null)}
                      />
                  ))}
              </div>
            </div>

            <button onClick={handleAnalyze} disabled={isAnalyzing || state.refImages.filter(Boolean).length === 0} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors flex items-center justify-center space-x-2">
                {isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : null}
                <span>2. {t('training.button.analyze')}</span>
            </button>

            {state.analysisResult && (
                <div className="bg-gray-200 dark:bg-gray-900/50 p-3 rounded-md space-y-2">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-300 mb-1">{t('training.analysisResult.title')}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">{state.analysisResult}</p>
                    <div className="flex space-x-2 pt-2">
                        <button onClick={handleSaveJson} className="w-full text-sm bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2">
                            <DownloadIcon className="w-4 h-4" />
                            <span>{t('training.button.saveJson')}</span>
                        </button>
                        <button onClick={handleLoadJsonClick} title={!isActivated ? t('tooltip.requiresActivation') : t('training.button.loadJson')} className={`w-full text-sm bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 ${!isActivated ? 'opacity-50 cursor-pointer' : ''}`}>
                            <FolderOpenIcon className="w-4 h-4" />
                            <span>{t('training.button.loadJson')}</span>
                            {!isActivated && <LockClosedIcon className="w-3 h-3 text-yellow-500 ml-1" />}
                        </button>
                        <input type="file" accept=".json" ref={jsonInputRef} onChange={handleJsonFileChange} className="hidden" />
                    </div>
                </div>
            )}
        </div>
        
        {/* Step 3: Mode Toggle */}
        <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">3. {t('training.mode.title')}</h3>
            <div className="flex bg-gray-200 dark:bg-gray-700/50 rounded-lg p-1 space-x-1">
                <button onClick={() => setState({...state, generationMode: 'text'})} className={modeButtonClass('text')}>{t('training.mode.text')}</button>
                <button onClick={() => setState({...state, generationMode: 'sketch'})} className={modeButtonClass('sketch')}>{t('training.mode.sketch')}</button>
            </div>
        </div>

        {/* Step 4: Generation Controls */}
        {state.generationMode === 'sketch' ? (
            <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('training.generate.title.sketch')}</h3>
                <DrawingCanvas ref={drawingCanvasRef} width={320} height={240} />
                <div>
                    <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('training.generate.prompt.title')}</h4>
                    <textarea value={state.generationPrompt} onChange={e => setState({...state, generationPrompt: e.target.value})} placeholder={t('training.generate.prompt.placeholder.sketch')} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none" />
                </div>
                <Slider label={t('enhance.options.creativity')} min={0} max={10} step={1} value={state.creativity} onChange={(v) => setState({ ...state, creativity: v })} />
                <Slider label={t('render.options.resultCount')} min={1} max={4} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />
                <button onClick={handleGenerateSketch} disabled={!canGenerate} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                    {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                    <span>{t('render.button.generate')}</span>
                </button>
            </div>
        ) : (
            <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('training.generate.title.text')}</h3>
                 <div>
                    <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.prompt.title')}</h4>
                    <textarea value={state.generationPrompt} onChange={e => setState({...state, generationPrompt: e.target.value})} placeholder={t('training.generate.prompt.placeholder.text')} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none" />
                </div>
                <SelectInput
                    label={t('quickGenerate.options.model')}
                    options={translatedModels.map(m => m.name)}
                    value={translatedModels.find(m => m.value === state.imageModel)?.name || ''}
                    onChange={(name) => {
                        const model = translatedModels.find(m => m.name === name);
                        if (model) setState({ ...state, imageModel: model.value });
                    }}
                />
                <SelectInput 
                    label={t('render.options.aspectRatio')} 
                    options={translatedAspectRatios} 
                    value={t(state.aspectRatio)} 
                    onChange={(val) => {
                        const key = ASPECT_RATIO_KEYS.find(k => t(k) === val);
                        if(key) setState({ ...state, aspectRatio: key });
                    }} 
                />
                <Slider label={t('enhance.options.creativity')} min={0} max={10} step={1} value={state.creativity} onChange={(v) => setState({ ...state, creativity: v })} />
                <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />
                <button onClick={handleGenerateText} disabled={!canGenerate} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                    {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                    <span>{t('render.button.generate')}</span>
                </button>
            </div>
        )}
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('comparison.result')}</h2>
         {(isAnalyzing || isGenerating) && (
          <div className="flex flex-col items-center justify-center h-full">
            <LoadingSpinner className="w-12 h-12 text-blue-500" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
                {isAnalyzing 
                    ? t('training.status.analyzing') 
                    : t('training.status.generating')}
            </p>
          </div>
        )}
        {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>}
        
        {!isGenerating && state.results.length === 0 && !error && (
            <EmptyStateGuide tabType={Tab.ImageFromReference} />
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

export default TrainingTab;