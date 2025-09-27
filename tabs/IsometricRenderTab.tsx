import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, TrashIcon, WandIcon } from '../components/icons/index';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import ImageResult from '../components/ImageResult';
import { generateImageFromImageAndText, getBase64FromResponse, analyzeImageForFloorPlanStyle } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, fileToBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import { MODERN_MINIMALIST_STYLE, JAPANESE_STYLE, NEOCLASSICAL_STYLE } from '../stylePresets';

type StylePreset = 'modern' | 'japanese' | 'neoclassical' | 'custom';

const PRESETS: Record<Exclude<StylePreset, 'custom'>, string> = {
  modern: MODERN_MINIMALIST_STYLE,
  japanese: JAPANESE_STYLE,
  neoclassical: NEOCLASSICAL_STYLE,
};

interface FloorPlanColoringTabProps {
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
}

const FloorPlanColoringTab: React.FC<FloorPlanColoringTabProps> = ({ state, setState, onClear, onEnhance, onFullscreen }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { t } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();

  const handleFileChange = async (file: File | null, type: 'floorplan' | 'ref') => {
    if (file) {
      const dataUrl = await fileToDataURL(file);
      if (type === 'floorplan') {
        setState({ ...state, floorplanFile: file, floorplanUrl: dataUrl });
      } else {
        setState({ ...state, refImageFile: file, refImageUrl: dataUrl, selectedStylePreset: 'custom', customStylePrompt: '' });
      }
    } else {
      if (type === 'floorplan') {
        setState({ ...state, floorplanFile: null, floorplanUrl: null });
      } else {
        setState({ ...state, refImageFile: null, refImageUrl: null, selectedStylePreset: 'modern' });
      }
    }
  };
  
  const handleAnalyzeStyle = async () => {
      if (!state.refImageFile) {
          setError(t('floorPlanColoring.error.noRefImage'));
          return;
      }
      setIsAnalyzing(true);
      setError(null);
      try {
          const { base64, mimeType } = await fileToBase64(state.refImageFile);
          const stylePrompt = await analyzeImageForFloorPlanStyle(base64, mimeType);
          setState({ ...state, customStylePrompt: stylePrompt });
      } catch(e) {
          console.error(e);
          setError(t('training.error.analyzeFailed'));
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleGenerate = async () => {
    if (!state.floorplanFile) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    
    const stylePrompt = state.selectedStylePreset === 'custom' ? state.customStylePrompt : PRESETS[state.selectedStylePreset];

    if (!stylePrompt) {
        setError(t('floorPlanColoring.error.noStyle'));
        return;
    }

    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, result: null }));

    try {
      const { base64, mimeType } = await fileToBase64(state.floorplanFile);
      
      const perspectiveInstruction = state.renderTopViewOnly
            ? "The output MUST be a strictly 2D, top-down, orthographic plan view. Do not add any perspective or 3D effects."
            : "The output should be a top-down view with very subtle depth, like soft ambient occlusion shadows, to make it feel like a professional presentation plan, but it should NOT be an isometric or 3D perspective view.";

      const fullPrompt = `
        **Instruction:** Take the provided black and white architectural floor plan and render a fully colored, textured, and furnished 2D presentation plan.
        **Core Task:** Your main job is to apply color, texture, and furniture symbols according to the style guide.
        **CRITICAL: Interpretation Rules:**
        1.  **Follow Structure:** Adhere strictly to the wall, door, and window layout in the source image.
        2.  **IGNORE Technical Details:** You MUST ignore and exclude all technical annotations from the source image. This includes dimension lines, numbers, grid axes (A, B, 1, 2), room labels, and any other technical text or symbols. The final output must be a clean visual plan, not a technical document.
        **Perspective:** ${perspectiveInstruction}
        **Style Guidance (CRITICAL):** Apply the following detailed style:
        """
        ${stylePrompt}
        """
        **Additional User Notes:** ${state.prompt || 'None'}
        **Negative Prompts:** Do not include any text, watermarks, dimensions, or annotations from the original drawing in the final image.
      `;
      
      const response = await generateImageFromImageAndText(fullPrompt, base64, mimeType);
      
      const resultB64 = getBase64FromResponse(response);
      
      if (resultB64) {
        const generationState = { ...state, floorplanFile: null, refImageFile: null, result: null };
        const newResult: ImageResultType = {
          id: nanoid(),
          base64: resultB64,
          mimeType: 'image/jpeg',
          generationInfo: {
            originTab: Tab.FloorPlanColoring,
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
        setError(t('render.error.generateFailed'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const styleButtonClass = (preset: StylePreset) => {
    const base = 'w-full text-sm font-semibold py-2 px-3 rounded-md transition-colors';
    return state.selectedStylePreset === preset
      ? `${base} bg-blue-600 text-white shadow-md`
      : `${base} bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600`;
  };

  const canGenerate = !isGenerating && !isAnalyzing && !!state.floorplanFile;

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 p-4 md:p-8">
      <div className="lg:w-1/3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('floorPlanColoring.title')}</h2>
            <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('floorPlanColoring.description')}</p>
        
        <div className="text-xs text-center text-yellow-800 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-md border border-yellow-300 dark:border-yellow-600/50">
           {t('floorPlanColoring.warning')}
        </div>

        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorPlanColoring.upload.floorplan')}</h3>
            <FileUpload id="isometric-upload" onFileChange={(file) => handleFileChange(file, 'floorplan')} previewUrl={state.floorplanUrl} onClear={() => handleFileChange(null, 'floorplan')} containerClassName="h-48" />
        </div>

        <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorPlanColoring.prompt.title')}</h3>
            <textarea value={state.prompt} onChange={e => setState({ ...state, prompt: e.target.value })} placeholder={t('floorPlanColoring.prompt.placeholder')} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none" />
        </div>

        <div className="space-y-4">
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">{t('floorPlanColoring.style.title')}</h3>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setState({...state, selectedStylePreset: 'modern'})} className={styleButtonClass('modern')}>{t('style.modern')}</button>
            <button onClick={() => setState({...state, selectedStylePreset: 'japanese'})} className={styleButtonClass('japanese')}>{t('style.japanese')}</button>
            <button onClick={() => setState({...state, selectedStylePreset: 'neoclassical'})} className={styleButtonClass('neoclassical')}>{t('style.neoclassical')}</button>
          </div>
          <div className="text-center text-xs text-gray-500 dark:text-gray-400">{t('floorPlanColoring.style.or')}</div>
          <div>
            <FileUpload id="isometric-ref-upload" onFileChange={(file) => handleFileChange(file, 'ref')} previewUrl={state.refImageUrl} onClear={() => handleFileChange(null, 'ref')} containerClassName="h-32" />
            {state.refImageFile && (
                <button onClick={handleAnalyzeStyle} disabled={isAnalyzing} className="w-full mt-2 bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors flex items-center justify-center space-x-2">
                    {isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : <WandIcon className="w-5 h-5" />}
                    <span>{isAnalyzing ? t('render.button.analyzing') : t('floorPlanColoring.style.analyze')}</span>
                </button>
            )}
            {state.customStylePrompt && <p className="text-xs text-green-600 dark:text-green-400 mt-2">{t('floorPlanColoring.style.analyzed')}</p>}
          </div>
        </div>

        <div>
            <label className="flex items-center space-x-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={state.renderTopViewOnly}
                    onChange={(e) => setState({...state, renderTopViewOnly: e.target.checked})}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('floorPlanColoring.options.renderTopViewOnly.label')}</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 px-1">{t('floorPlanColoring.options.renderTopViewOnly.hint')}</p>
        </div>

        <button onClick={handleGenerate} disabled={!canGenerate} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
            {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
            <span>{t('render.button.generate')}</span>
        </button>
      </div>

      <div className="flex-1 bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] flex items-center justify-center">
        {isGenerating || isAnalyzing ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <LoadingSpinner className="w-12 h-12 text-blue-500" />
            <p className="mt-4 text-gray-600 dark:text-gray-400 font-semibold">
                {isAnalyzing ? t('training.status.analyzing') : t('render.status.generating')}
            </p>
          </div>
        ) : error ? (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md text-center">{error}</div>
        ) : state.result ? (
             <ImageResult result={state.result} onEnhance={onEnhance} onFullscreen={() => onFullscreen([state.result], 0)} />
        ) : (
            <div className="text-center text-gray-500">
                <p>{t('render.status.placeholder')}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default FloorPlanColoringTab;