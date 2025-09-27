import React from 'react';
import { ImageResult as ImageResultType, EnhanceState } from '../types';
import { DownloadIcon, SparklesIcon, ExpandIcon } from './icons/index';

interface ImageResultProps {
  result: ImageResultType;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: () => void;
}

const ImageResult: React.FC<ImageResultProps> = ({ result, onEnhance, onFullscreen }) => {
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:${result.mimeType};base64,${result.base64}`;
    link.download = `result_${result.id}_sudyapp.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEnhanceClick = () => {
    onEnhance({ image: result.base64, mimeType: result.mimeType });
  };

  return (
    <div className="group relative bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
      <img src={`data:${result.mimeType};base64,${result.base64}`} alt="Generated result" className="w-full h-full object-cover"/>
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 space-x-2">
        <button onClick={handleDownload} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title="Download">
          <DownloadIcon className="w-6 h-6" />
        </button>
        <button onClick={handleEnhanceClick} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title="Enhance">
          <SparklesIcon className="w-6 h-6" />
        </button>
         <button onClick={onFullscreen} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title="View Fullscreen">
          <ExpandIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default ImageResult;