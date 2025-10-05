import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import SelectInput from '../components/SelectInput';
import Slider from '../components/Slider';
import { SparklesIcon, LoadingSpinner, WandIcon, TrashIcon, FolderOpenIcon, LockClosedIcon } from '../components/icons/index';
import { ASPECT_RATIO_KEYS } from '../constants';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import SideBySideComparison from '../components/SideBySideComparison';
import { getBase64FromResponse, analyzeImageForRenderPrompt, generateImageFromImageAndText, generateLineArtFromImage, analyzeImageForStyle } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, fileToBase64, dataURLtoBase64, base64ToFile } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { useActivation } from '../contexts/ActivationContext';


const PromptBank: React.FC<{ 
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    onSelect: (prompt: string) => void 
}> = ({ activeCategory, setActiveCategory, onSelect }) => {
    const { t } = useTranslation();
    const categories = ['exterior', 'interior', 'landscape', 'planning'];

    const getPromptsForCategory = (category: string): string[] => {
        try {
            const key = `promptBank.${category}.prompts`;
            const promptsJson = t(key);
            if (promptsJson === key) return []; // Translation not found
            return JSON.parse(promptsJson);
        } catch (e) {
            console.error(`Failed to parse prompts for category: ${category}`, e);
            return [];
        }
    };
    
    return (
        <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.promptBank.title')}</h3>
            <div className="flex border-b border-gray-300 dark:border-gray-700 mb-2 overflow-x-auto no-scrollbar">
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeCategory === cat ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border-b-2 border-transparent'}`}
                    >
                        {t(`render.promptBank.${cat}`)}
                    </button>
                ))}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {getPromptsForCategory(activeCategory).map((prompt, index) => (
                    <button
                        key={`${activeCategory}-${index}`}
                        onClick={() => onSelect(prompt)}
                        className="w-full text-left text-xs p-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
        </div>
    );
};

interface RenderTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  onConsumeInitialState: () => void;
}

const getImageDimensions = (dataUrl: string): Promise<{ width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const RenderTab: React.FC<RenderTabProps> = ({ initialState, state, setState, onClear, onEnhance, onFullscreen, onConsumeInitialState }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();

  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.map(key => t(key)), [t]);
  
  const handleFileChange = useCallback(async (file: File | null) => {
    if (file) {
      const dataUrl = await fileToDataURL(file);
      const dimensions = await getImageDimensions(dataUrl);
      setImageDimensions(dimensions);
      setState((prevState: any) => ({ 
        ...prevState, 
        mainImageFile: file, 
        mainImageUrl: dataUrl, 
        processedImageUrl: dataUrl,
        lineArtImage: null,
        aspectRatio: 'aspect.original',
        adaptationMode: null,
      }));
    } else {
      setState((prevState: any) => ({ ...prevState, mainImageFile: null, mainImageUrl: null, processedImageUrl: null, lineArtImage: null }));
      setImageDimensions(null);
    }
  }, [setState]);

  useEffect(() => {
    if (initialState) {
        const file = base64ToFile(initialState.image, `render-ai-source-${nanoid(5)}.jpg`, initialState.mimeType);
        handleFileChange(file);
        onConsumeInitialState();
    }
  }, [initialState, handleFileChange, onConsumeInitialState]);

  const handleRefImageChange = async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        setState({ ...state, refImageFile: file, refImageUrl: dataUrl });
    } else {
        setState({ ...state, refImageFile: null, refImageUrl: null });
    }
  };

  const parseAspectRatio = useCallback((ratioStr: string): number | null => {
      if (!ratioStr || ratioStr === t('aspect.original')) return null;
      const ratioMatch = ratioStr.match(/(\d+:\d+)/);
      if (!ratioMatch) return null;

      const [w, h] = ratioMatch[0].split(':').map(Number);
      if (isNaN(w) || isNaN(h) || h === 0) return null;
      return w / h;
  }, [t]);

  useEffect(() => {
    const processImage = async () => {
        if (!state.mainImageUrl || !imageDimensions || state.aspectRatio === 'aspect.original') {
            if(state.mainImageUrl) setState((s:any) => ({...s, processedImageUrl: s.mainImageUrl}));
            return;
        }

        const targetAspectRatio = parseAspectRatio(t(state.aspectRatio));
        if (targetAspectRatio === null) return;

        const originalAspectRatio = imageDimensions.width / imageDimensions.height;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
            if (state.adaptationMode === 'crop') {
                let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
                if (targetAspectRatio > originalAspectRatio) { // Taller than target
                    sHeight = img.width / targetAspectRatio;
                    sy = (img.height - sHeight) / 2;
                } else { // Wider than target
                    sWidth = img.height * targetAspectRatio;
                    sx = (img.width - sWidth) / 2;
                }
                canvas.width = sWidth;
                canvas.height = sHeight;
                ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

            } else if (state.adaptationMode === 'extend') {
                let newWidth, newHeight;
                if (targetAspectRatio > originalAspectRatio) { // Wider than original
                    newWidth = img.height * targetAspectRatio;
                    newHeight = img.height;
                } else { // Taller than original
                    newWidth = img.width;
                    newHeight = img.width / targetAspectRatio;
                }
                canvas.width = newWidth;
                canvas.height = newHeight;
                
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const dx = (newWidth - img.width) / 2;
                const dy = (newHeight - img.height) / 2;

                ctx.drawImage(img, dx, dy);
            }
             setState((s:any) => ({...s, processedImageUrl: canvas.toDataURL('image/jpeg')}));
        };
        img.src = state.mainImageUrl;
    };
    processImage();
  }, [state.aspectRatio, state.adaptationMode, state.mainImageUrl, imageDimensions, t, parseAspectRatio, setState]);
  
  const handleAnalyze = async () => {
      if (!state.processedImageUrl) {
        setError(t('render.error.noImageAnalyze'));
        return;
      }
      setIsAnalyzing(true);
      setError(null);
      
      try {
          const { base64, mimeType } = dataURLtoBase64(state.processedImageUrl);
          
          const promptPromise = analyzeImageForRenderPrompt(base64, mimeType, state.prompt, language);
          
          const lineArtPromise = state.useLineArt 
            ? generateLineArtFromImage(base64, mimeType).then(res => getBase64FromResponse(res))
            : Promise.resolve(null);

          const [masterPrompt, lineArtBase64] = await Promise.all([promptPromise, lineArtPromise]);
          
          setState({
            ...state,
            prompt: masterPrompt,
            lineArtImage: lineArtBase64 ? `data:image/jpeg;base64,${lineArtBase64}` : null,
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

  const getPromptsForCategory = (category: string): string[] => {
    try {
        const key = `promptBank.${category}.prompts`;
        const promptsJson = t(key);
        if (promptsJson === key) return []; // Translation not found
        return JSON.parse(promptsJson);
    } catch (e) {
        console.error(`Failed to parse prompts for category: ${category}`, e);
        return [];
    }
  };


  const handleGenerate = async () => {
    if (!state.processedImageUrl) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: []}));

    try {
        let styleAnalysis = '';
        if (state.refImageFile) {
            setIsAnalyzing(true);
            const refImageInfo = await fileToBase64(state.refImageFile);
            styleAnalysis = await analyzeImageForStyle(refImageInfo.base64, refImageInfo.mimeType, language);
            setIsAnalyzing(false);
        }

        let sourceImageInfo;
        let imageSourceDescription;

        if (state.useLineArt && state.lineArtImage) {
            sourceImageInfo = dataURLtoBase64(state.lineArtImage);
            imageSourceDescription = "Use the provided black and white line art image as the absolute structural blueprint for the scene.";
        } else {
            sourceImageInfo = dataURLtoBase64(state.processedImageUrl);
            imageSourceDescription = "Use the provided full-color source image as the primary base for structure.";
        }
        
        const generationPromises = [];
        const randomPrompts = state.useRandomPrompts ? getPromptsForCategory(state.promptBankCategory) : [];

        for (let i = 0; i < state.numResults; i++) {
            let currentPrompt = state.prompt;
            if (state.useRandomPrompts && randomPrompts.length > 0) {
                currentPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
            }
            const fullPrompt = `
                **TASK:** Photorealistically render a new image by combining a main subject from a source image with a new atmosphere and style.

                **UNBREAKABLE RULE #1: PRESERVE THE SUBJECT'S MATERIALS.**
                You are given a source image containing a primary architectural subject. You **MUST** identify this subject (e.g., a building, an interior room). The materials, textures, and colors of **THIS SUBJECT** must be **PRESERVED EXACTLY** as they are in the source image. For example, if the building in the source image is made of white concrete and dark wood, it must remain white concrete and dark wood in the final render. This is the highest priority instruction. Any change to the subject's material is a failure.

                **UNBREAKABLE RULE #2: APPLY NEW ATMOSPHERE.**
                The "STYLE GUIDE" below (derived from a mood reference image) defines the new **ENVIRONMENT, ATMOSPHERE, LIGHTING, and COLOR PALETTE** for the entire scene. You must place the preserved subject into this new context. The mood reference image's content (e.g., if it's a picture of a forest) should only inform the environment, not change the primary subject's architecture.

                **EXECUTION FLOW:**
                1.  Analyze the source image to understand the primary subject's structure and materials.
                2.  Analyze the Style Guide to understand the target atmosphere.
                3.  Place the **UNCHANGED** subject into the **NEW** atmosphere.

                ---
                **SOURCE IMAGE CONTEXT:**
                -   ${imageSourceDescription}

                **STYLE GUIDE (from mood reference image):**
                """
                ${styleAnalysis || 'Not specified. Rely on User Prompt and LoRA Style.'}
                """

                **USER PROMPT (specific instructions):**
                """
                ${currentPrompt}
                """
                
                **LoRA STYLE (technical details):**
                """
                ${state.loraPrompt || 'Not specified.'}
                """

                **TECHNICAL REQUESTS:**
                - **Structural Adherence (0=Creative, 10=Strict):** ${state.sharpnessAdherence}
                
                **NEGATIVE PROMPTS:** Do not change the materials of the main building. No watermarks, text, signatures. Avoid blurry, out of focus, cgi, render, unreal engine, fake results.
            `;
            generationPromises.push(generateImageFromImageAndText(fullPrompt, sourceImageInfo.base64, sourceImageInfo.mimeType));
        }

        const responses = await Promise.all(generationPromises);
        
        const generationState = { ...state, mainImageFile: null, mainImageUrl: state.mainImageUrl, processedImageUrl: state.processedImageUrl, refImageFile: null, refImageUrl: null };

        const newResults = responses
            .map((res): ImageResultType | null => {
                const b64 = getBase64FromResponse(res);
                if (!b64) return null;
                return { 
                  id: nanoid(), 
                  base64: b64, 
                  mimeType: 'image/jpeg',
                  generationInfo: {
                    originTab: Tab.RenderAI,
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
      setIsAnalyzing(false);
    }
  };
  
  const handleLoadStyleFileClick = () => {
    if (!isActivated) {
      openActivationModal();
    } else {
      styleFileInputRef.current?.click();
    }
  };

  const handleStyleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const json = JSON.parse(content);
                // Check for new .lora format first, then fall back to old .json format
                if (json.stylePrompt && typeof json.stylePrompt === 'string') {
                    setState({ ...state, loraPrompt: json.stylePrompt });
                    setError(null);
                } else if (json.trainedStylePrompt && typeof json.trainedStylePrompt === 'string') {
                    setState({ ...state, loraPrompt: json.trainedStylePrompt });
                    setError(null);
                } else {
                     // Fallback for this tab's specific auto-analysis format which might be a full JSON object
                    setState({ ...state, loraPrompt: JSON.stringify(json, null, 2) });
                    setError(null);
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

  const canGenerate = !isGenerating && !isAnalyzing && !!state.mainImageFile && (state.aspectRatio === 'aspect.original' || !!state.adaptationMode);

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
      {/* Left Panel: Controls */}
      <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t(Tab.RenderAI)}</h2>
          <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 items-start">
            <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.upload.title')}</h3>
                <FileUpload id={`main-upload-render`} onFileChange={handleFileChange} previewUrl={state.mainImageUrl} onClear={() => handleFileChange(null)} containerClassName="h-40" />
            </div>
             <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.upload.ref.title')}</h3>
                <FileUpload id={`ref-upload-render`} onFileChange={handleRefImageChange} previewUrl={state.refImageUrl} onClear={() => setState({...state, refImageFile: null, refImageUrl: null})} containerClassName="h-40" />
            </div>
        </div>
        
        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.prompt.title')}</h3>
            <textarea
                value={state.prompt}
                onChange={(e) => setState({ ...state, prompt: e.target.value })}
                placeholder={t('render.prompt.placeholder')}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-24 resize-none"
                disabled={state.useRandomPrompts}
            />
            <label className="flex items-center space-x-2 cursor-pointer mt-2">
                <input
                    type="checkbox"
                    checked={state.useRandomPrompts}
                    onChange={(e) => setState({...state, useRandomPrompts: e.target.checked})}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Use Random Prompts from Bank</span>
            </label>
        </div>
        
        {language === 'vi' && <PromptBank 
            activeCategory={state.promptBankCategory}
            setActiveCategory={(cat) => setState({...state, promptBankCategory: cat})}
            onSelect={(p) => setState({ ...state, prompt: p })} 
        />}

         <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.lora.title')}</h3>
            <textarea
                value={state.loraPrompt}
                onChange={(e) => setState({ ...state, loraPrompt: e.target.value })}
                placeholder={t('render.lora.placeholder')}
                className="w-full bg-white dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-md p-2 h-24 resize-none font-mono text-xs"
            />
            <div className="flex items-center gap-2 pt-2">
                <input type="file" accept=".json,.lora" ref={styleFileInputRef} onChange={handleStyleFileChange} className="hidden" />
                <button 
                  onClick={handleLoadStyleFileClick} 
                  title={!isActivated ? t('tooltip.requiresActivation') : t('training.button.loadStyleFile')}
                  className={`w-full text-sm bg-gray-300/80 dark:bg-gray-700/80 text-gray-800 dark:text-white font-medium py-2 px-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 ${!isActivated ? 'opacity-50 cursor-pointer' : ''}`}
                >
                    <FolderOpenIcon className="w-4 h-4" />
                    <span>{t('training.button.loadStyleFile')}</span>
                     {!isActivated && <LockClosedIcon className="w-3.5 h-3.5 ml-1" />}
                </button>
                 {state.loraPrompt && (
                    <button onClick={() => setState({...state, loraPrompt: ''})} className="p-2 bg-red-500/20 text-red-500 rounded-md hover:bg-red-500/40">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            {state.loraPrompt && <p className="text-xs text-green-600 dark:text-green-400 px-1 pt-1">{t('render.lora.loaded')}</p>}
        </div>

        <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('enhance.creativeOptions.title')}</h3>
          
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={state.useLineArt}
                    onChange={(e) => setState({...state, useLineArt: e.target.checked})}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('render.options.useLineArt')}</span>
            </label>
            {state.useLineArt && state.mainImageFile && (
                 <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full text-xs bg-indigo-600/80 text-white font-bold py-1.5 px-3 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 flex items-center justify-center space-x-2"
                >
                    {isAnalyzing ? <LoadingSpinner className="w-4 h-4" /> : <WandIcon className="w-4 h-4" />}
                    <span>{isAnalyzing ? t('render.button.analyzing') : t('render.button.optimizePrompt')}</span>
                </button>
            )}
            {state.useLineArt && state.lineArtImage && (
                <div className="p-2 bg-gray-200 dark:bg-gray-900/50 rounded-md">
                    <p className="text-xs font-semibold text-center mb-1">{t('render.lineArtPreview')}</p>
                    <img src={state.lineArtImage} alt="Line art preview" className="w-full h-auto rounded"/>
                </div>
            )}
          </div>
          
          <Slider label={t('render.options.sharpnessAdherence')} min={0} max={10} step={1} value={state.sharpnessAdherence} onChange={(v) => setState({ ...state, sharpnessAdherence: v })} />
          <p className="text-xs text-gray-500 -mt-3 px-1">{t('render.options.sharpnessAdherence.hint')}</p>

          <SelectInput 
              label={t('render.options.aspectRatio')} 
              options={translatedAspectRatios} 
              value={t(state.aspectRatio)} 
              onChange={(val) => {
                  const key = ASPECT_RATIO_KEYS[translatedAspectRatios.indexOf(val)] || 'aspect.original';
                  const adaptationRequired = key !== 'aspect.original';
                  setState({ 
                      ...state, 
                      aspectRatio: key, 
                      adaptationMode: adaptationRequired ? 'crop' : null 
                  });
                  if (!adaptationRequired) setError(null);
              }} 
          />
          {state.aspectRatio !== 'aspect.original' && state.mainImageFile && (
              <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md -mt-3">
                  <p className="text-sm font-medium mb-2">{t('enhance.options.adaptationPrompt')}</p>
                  <div className="flex space-x-2">
                       <button onClick={() => setState({ ...state, adaptationMode: 'crop' })} className={`w-full py-2 rounded-md text-sm transition-colors ${state.adaptationMode === 'crop' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-300'}`}>{t('enhance.options.adaptationCrop')}</button>
                      <button onClick={() => setState({ ...state, adaptationMode: 'extend' })} className={`w-full py-2 rounded-md text-sm transition-colors ${state.adaptationMode === 'extend' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-300'}`}>{t('enhance.options.adaptationExtend')}</button>
                  </div>
              </div>
          )}
        
          <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />

        </div>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isGenerating || isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
          <span>{isGenerating || isAnalyzing ? t('render.button.generating') : t('render.button.generate')}</span>
        </button>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('comparison.result')}</h2>
        
        {isGenerating && (
          <div className="flex flex-col items-center justify-center h-full">
            <LoadingSpinner className="w-12 h-12 text-blue-500" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">{isAnalyzing ? t('training.status.analyzing') : t('render.status.generating')}</p>
          </div>
        )}
        {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>}
        
        {!isGenerating && state.results.length === 0 && !error && (
            !state.processedImageUrl ? (
                <EmptyStateGuide tabType={Tab.RenderAI} />
            ) : (
                <div className="flex flex-col items-center justify-center">
                    <p className="mb-2 font-semibold">{t('comparison.original')}</p>
                    <img src={state.processedImageUrl} alt="Preview" className="max-w-full max-h-[70vh] rounded-lg shadow-md" />
                 </div>
            )
        )}

        {state.results.length === 1 && (
            <div className="w-full max-w-3xl mx-auto flex items-center justify-center h-full">
                <SideBySideComparison 
                    key={state.results[0].id} 
                    originalImageSrc={state.processedImageUrl} 
                    generatedResult={state.results[0]} 
                    onEnhance={onEnhance} 
                    onFullscreen={() => onFullscreen(state.results, 0)} 
                />
            </div>
        )}
        {state.results.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.results.map((result: ImageResultType, index: number) => (
                    <SideBySideComparison 
                        key={result.id} 
                        originalImageSrc={state.processedImageUrl} 
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

export default RenderTab;