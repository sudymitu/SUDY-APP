import React, { useState, useMemo, useRef } from 'react';
import FileUpload from '../components/FileUpload';
import SelectInput from '../components/SelectInput';
import Slider from '../components/Slider';
import { SparklesIcon, LoadingSpinner, PaintBrushIcon, FolderOpenIcon, TrashIcon, WandIcon, LockClosedIcon } from '../components/icons/index';
import { ASPECT_RATIO_KEYS, RENDER_VIEW_KEYS } from '../constants';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import ImageResult from '../components/ImageResult';
import { getBase64FromResponse, generatePerspectiveFromFloorplan, analyzeSceneForFloorplanRender } from '../services/geminiService';
import { nanoid } from 'nanoid';
import MultiSelectCheckbox from '../components/MultiSelectCheckbox';
import InpaintingModal from '../components/InpaintingModal';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, fileToBase64, dataURLtoBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { useActivation } from '../contexts/ActivationContext';

interface FloorPlanRenderTabProps {
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
}

const FloorPlanRenderTab: React.FC<FloorPlanRenderTabProps> = ({ state, setState, onClear, onEnhance, onFullscreen }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();

  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.map(key => t(key)), [t]);
  const translatedRenderViews = useMemo(() => RENDER_VIEW_KEYS.map(key => t(key)), [t]);
  
  const handleFloorplanFileChange = async (file: File | null) => {
      if (file) {
          const dataUrl = await fileToDataURL(file);
          setState({...state, floorplanFile: file, floorplanSrcForModal: dataUrl, inpaintedPlanDataUrl: null, drawingDataUrl: null });
      } else {
          setState({...state, floorplanFile: null, floorplanSrcForModal: null, inpaintedPlanDataUrl: null, drawingDataUrl: null });
      }
  };

  const handleRefImageChange = async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        // Reset the generated prompt when a new image is uploaded
        setState({ ...state, refImageFile: file, refImageUrl: dataUrl, loraStylePrompt: '', prompt: '' });
    } else {
        setState({ ...state, refImageFile: null, refImageUrl: null });
    }
  };
  
  const handleAnalyzeStyle = async () => {
    if (!state.refImageFile || !state.inpaintedPlanDataUrl) {
      setError(t('training.error.noRefImages'));
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const refImage = await fileToBase64(state.refImageFile);
      const inpaintedPlan = dataURLtoBase64(state.inpaintedPlanDataUrl);

      const analysis = await analyzeSceneForFloorplanRender(inpaintedPlan, refImage, language);
      
      setState({ 
        ...state, 
        loraStylePrompt: JSON.stringify(analysis.loraStylePrompt, null, 2),
        prompt: analysis.description 
      });
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


  const handleGenerate = async () => {
    if (!state.inpaintedPlanDataUrl) {
      setError(t('floorplan.error.noInpaint'));
      return;
    }
     if (!state.loraStylePrompt) {
        setError(t('training.error.noPrompt'));
        return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: [] }));

    try {
        const inpaintedPlanData = dataURLtoBase64(state.inpaintedPlanDataUrl);
        
        const activeElements = state.showAdvancedElements ? state.elements.filter((el: any) => el.file && el.name.trim()) : [];
        const elementDatas = await Promise.all(
            activeElements.map(async (el: any) => {
                const { base64, mimeType } = await fileToBase64(el.file);
                return { base64, mimeType, name: el.name };
            })
        );
        
        const viewsToRender = state.renderViews.filter((v: string) => v !== RENDER_VIEW_KEYS[0]);
        if (viewsToRender.length === 0) {
            viewsToRender.push(RENDER_VIEW_KEYS[0]); // Use default if nothing specific is selected
        }
        
        const generationPromises = [];
        for (let i = 0; i < state.numResults; i++) {
            const currentView = viewsToRender[i % viewsToRender.length];
            generationPromises.push(generatePerspectiveFromFloorplan(
                inpaintedPlanData,
                state.loraStylePrompt,
                state.prompt,
                t(currentView),
                t(state.aspectRatio),
                elementDatas
            ));
        }

        const responses = await Promise.all(generationPromises);

        const generationState = { ...state, floorplanFile: null, refImageFile: null };

        const newResults = responses
            .map((res): ImageResultType | null => {
                const b64 = getBase64FromResponse(res);
                if (!b64) return null;
                return { 
                  id: nanoid(), 
                  base64: b64, 
                  mimeType: 'image/jpeg',
                  generationInfo: {
                    originTab: Tab.FloorPlanRender,
                    state: generationState
                  }
                };
            })
            .filter((r): r is ImageResultType => r !== null);
        
        if (newResults.length > 0) {
            setState((prevState: any) => ({ ...prevState, results: newResults }));
            newResults.forEach(addMedia);
            decrementQuota(10 * newResults.length);
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
                let promptToSet = '';
                
                // Check for new .lora format first
                if (json.stylePrompt && typeof json.stylePrompt === 'string') {
                    promptToSet = json.stylePrompt;
                } 
                // Fallback to old .json format for this tab
                else if (json.trainedStylePrompt && typeof json.trainedStylePrompt === 'string') {
                    promptToSet = json.trainedStylePrompt;
                }
                // Fallback for this tab's specific auto-analysis format
                else if (json.style_mood) {
                     promptToSet = JSON.stringify(json, null, 2);
                }
                else {
                    setError(t('render.error.invalidJson'));
                    return;
                }

                setState({ ...state, loraStylePrompt: promptToSet });
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

  const handleInpaintClick = () => {
    if (!isActivated) {
      openActivationModal();
    } else {
      setIsModalOpen(true);
    }
  };
  
  const handleElementFileChange = (index: number) => async (file: File | null) => {
    const dataUrl = file ? await fileToDataURL(file) : null;
    setState((prevState: any) => {
      const newElements = [...prevState.elements];
      newElements[index] = { ...newElements[index], file, dataUrl };
      return { ...prevState, elements: newElements };
    });
  };

  const handleElementNameChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
     setState((prevState: any) => {
      const newElements = [...prevState.elements];
      newElements[index] = { ...newElements[index], name: e.target.value };
      return { ...prevState, elements: newElements };
    });
  };

  const handleClearElement = (index: number) => {
    setState((prevState: any) => {
        const newElements = [...prevState.elements];
        newElements[index] = { id: nanoid(), file: null, name: '', dataUrl: null };
        return { ...prevState, elements: newElements };
    });
  };

  const handleImageUpdateFromInpaint = (dataUrl: string) => {
      setState((prevState: any) => ({
          ...prevState,
          floorplanSrcForModal: dataUrl,
          inpaintedPlanDataUrl: null, // This is now invalid as the base has changed
          drawingDataUrl: null, // Clear the old drawing
      }));
  };

  const displayImageSrc = state.inpaintedPlanDataUrl || state.floorplanSrcForModal;
  const canGenerate = !isGenerating && !isAnalyzing && !!state.inpaintedPlanDataUrl && !!state.loraStylePrompt;

  return (
    <>
      <InpaintingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(dataUrl) => setState({...state, inpaintedPlanDataUrl: dataUrl, drawingDataUrl: null })}
        imageSrc={state.floorplanSrcForModal}
        drawingDataUrl={state.drawingDataUrl}
        onDrawingChange={(url) => setState({ ...state, drawingDataUrl: url })}
        onImageChange={handleImageUpdateFromInpaint}
      />
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
        {/* Left Panel: Controls */}
        <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('floorplan.title')}</h2>
            <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorplan.upload.title')}</h3>
              {!state.floorplanFile ? (
                <div className="w-full max-w-sm mx-auto lg:max-w-none lg:mx-0">
                  <FileUpload id="floorplan-upload" onFileChange={handleFloorplanFileChange} onClear={onClear} containerClassName="h-60 lg:aspect-square" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-2 flex items-center justify-center">
                    <img src={displayImageSrc!} alt="Floor plan preview" className="max-h-40 rounded-md object-contain" />
                  </div>
                  <button onClick={handleInpaintClick} className={`w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 flex items-center justify-center space-x-2 ${!isActivated ? 'opacity-70' : ''}`} title={!isActivated ? t('tooltip.requiresActivation') : t('floorplan.button.markPosition')}>
                    <PaintBrushIcon className="w-5 h-5" />
                    <span>{t('floorplan.button.markPosition')}</span>
                    {!isActivated && <LockClosedIcon className="w-3.5 h-3.5 ml-1" />}
                  </button>
                </div>
              )}
          </div>
          
          <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorplan.upload.ref.title')}</h3>
             <div className="flex flex-col gap-2">
                <FileUpload id={`ref-upload-floorplan`} onFileChange={handleRefImageChange} previewUrl={state.refImageUrl} onClear={() => handleRefImageChange(null)} />
                <button onClick={handleAnalyzeStyle} disabled={isAnalyzing || !state.refImageFile || !state.inpaintedPlanDataUrl} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors flex items-center justify-center space-x-2">
                    {isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : <WandIcon className="w-5 h-5" />}
                    <span>{isAnalyzing ? t('render.button.analyzing') : t('training.button.analyze')}</span>
                </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('training.analysisResult.title')}</h3>
            <textarea
                value={state.loraStylePrompt}
                onChange={(e) => setState({ ...state, loraStylePrompt: e.target.value })}
                placeholder={t('render.lora.placeholder')}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-64 resize-none font-mono text-xs"
            />
            <div className="flex items-center gap-2 pt-2">
                <input type="file" accept=".json,.lora" ref={styleFileInputRef} onChange={handleStyleFileChange} className="hidden" />
                <button onClick={handleLoadStyleFileClick} className={`w-full text-sm bg-gray-300/80 dark:bg-gray-700/80 text-gray-800 dark:text-white font-medium py-2 px-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 ${!isActivated ? 'opacity-50 cursor-pointer' : ''}`} title={!isActivated ? t('tooltip.requiresActivation') : t('training.button.loadStyleFile')}>
                    <FolderOpenIcon className="w-4 h-4" />
                    <span>{t('training.button.loadStyleFile')}</span>
                     {!isActivated && <LockClosedIcon className="w-3.5 h-3.5 ml-1" />}
                </button>
                {state.loraStylePrompt && (
                    <button onClick={() => setState({...state, loraStylePrompt: ''})} className="p-2 bg-red-500/20 text-red-500 rounded-md hover:bg-red-500/40">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            {state.loraStylePrompt && <p className="text-xs text-green-600 dark:text-green-400 px-1 pt-1">{t('render.lora.loaded')}</p>}
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorplan.prompt.title')}</h3>
            <textarea
                value={state.prompt}
                onChange={(e) => setState({ ...state, prompt: e.target.value })}
                placeholder={t('floorplan.prompt.placeholder')}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none"
            />
          </div>
          
          <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
            <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={state.showAdvancedElements}
                        onChange={(e) => setState({...state, showAdvancedElements: e.target.checked})}
                        className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('floorplan.advanced.toggle')}</span>
                </label>
            </div>

            {state.showAdvancedElements && (
                 <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('enhance.advanced.title')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {state.elements.map((element: any, index: number) => (
                            <div key={element.id} className="flex flex-col gap-2">
                                <FileUpload 
                                    id={`floorplan-element-upload-${index}`} 
                                    onFileChange={handleElementFileChange(index)} 
                                    previewUrl={element.dataUrl}
                                    onClear={() => handleClearElement(index)}
                                />
                                <input
                                    type="text"
                                    value={element.name}
                                    onChange={handleElementNameChange(index)}
                                    placeholder={t('enhance.advanced.elementNamePlaceholder')}
                                    className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-blue-100/30 dark:bg-blue-900/20 rounded-md border border-blue-300/50 dark:border-blue-700/40">
                      {t('enhance.advanced.hint')}
                    </p>
                </div>
            )}
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
                    const keys = selected.map(s => RENDER_VIEW_KEYS[translatedRenderViews.indexOf(s)]);
                    setState({ ...state, renderViews: keys });
                }} 
            />
          
            <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />
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
          {(isGenerating || isAnalyzing) && (
            <div className="flex flex-col items-center justify-center h-full">
              <LoadingSpinner className="w-12 h-12 text-blue-500" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">{isAnalyzing ? t('render.button.analyzing') : t('floorplan.status.generating')}</p>
            </div>
          )}
          {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>}
          
          {!isGenerating && state.results.length === 0 && !error && (
              <EmptyStateGuide tabType={Tab.FloorPlanRender} />
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {state.results.map((result: ImageResultType, index: number) => (
                  <ImageResult key={result.id} result={result} onEnhance={onEnhance} onFullscreen={() => onFullscreen(state.results, index)} />
              ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default FloorPlanRenderTab;