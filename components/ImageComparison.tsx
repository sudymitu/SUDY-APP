

import React from 'react';
import { ImageResult as ImageResultType, EnhanceState } from '../types';
import ImageResult from './ImageResult';
import { useTranslation } from '../hooks/useTranslation';

interface ImageComparisonProps {
  originalImage: File | null;
  generatedResult: ImageResultType;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: () => void;
  resultTitle?: string;
}

const ImageComparison: React.FC<ImageComparisonProps> = ({ originalImage, generatedResult, onEnhance, onFullscreen, resultTitle }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h3 className="font-semibold mb-2 text-center text-gray-600 dark:text-gray-400">{t('comparison.original')}</h3>
        <div className="bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 aspect-square flex items-center justify-center">
            {originalImage ? (
                <img src={URL.createObjectURL(originalImage)} alt="Original" className="max-h-full max-w-full object-contain" />
            ) : (
                <p className="text-gray-500">{t('comparison.noOriginal')}</p>
            )}
        </div>
      </div>
       <div>
        <h3 className="font-semibold mb-2 text-center text-gray-600 dark:text-gray-400">{resultTitle || t('comparison.result')}</h3>
         <div className="aspect-square">
            <ImageResult result={generatedResult} onEnhance={onEnhance} onFullscreen={onFullscreen} />
         </div>
      </div>
    </div>
  );
};

export default ImageComparison;