import React from 'react';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { useTranslation } from '../hooks/useTranslation';
import { ImageResult, EnhanceState, GenerationInfo, VideoResult } from '../types';
import { FolderOpenIcon, DownloadIcon, ExpandIcon, SparklesIcon, WandIcon, DocumentTextIcon, TrashIcon, LoopIcon, ArrowUpOnSquareIcon, VideoCameraIcon } from '../components/icons';
// FIX: Changed to a default import as there is a default export.
import VideoResultComponent from '../components/VideoResult';

interface ImageLibraryTabProps {
    onFullscreen: (images: ImageResult[], startIndex: number) => void;
    onSendToEnhance: (state: EnhanceState) => void;
    onSendToTraining: (state: EnhanceState) => void;
    onSendToTechDrawing: (state: EnhanceState) => void;
    onSendToUpscale: (state: EnhanceState) => void;
    onSendToVeo: (state: EnhanceState) => void;
    onRegenerate: (info: GenerationInfo) => void;
}

const ImageLibraryTab: React.FC<ImageLibraryTabProps> = ({ 
    onFullscreen, 
    onSendToEnhance, 
    onSendToTraining, 
    onSendToTechDrawing, 
    onSendToUpscale,
    onSendToVeo,
    onRegenerate 
}) => {
    const { images, videos, deleteImage, deleteVideo } = useImageLibrary();
    const { t } = useTranslation();

    const handleDownload = (media: ImageResult | VideoResult) => {
        const link = document.createElement('a');
        if ('url' in media) { // VideoResult
            link.href = media.url;
            link.download = `video_result_${media.id}_sudyapp.mp4`;
        } else { // ImageResult
            link.href = `data:${media.mimeType};base64,${media.base64}`;
            link.download = `result_${media.id}_sudyapp.jpg`;
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSend = (image: ImageResult, sender: (state: EnhanceState) => void) => {
        sender({ image: image.base64, mimeType: image.mimeType });
    }
    
    const handleDeleteImage = (e: React.MouseEvent, imageId: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this image?')) {
            deleteImage(imageId);
        }
    };

    const handleDeleteVideo = (e: React.MouseEvent, videoId: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this video?')) {
            deleteVideo(videoId);
        }
    };
    
    const handleRegen = (e: React.MouseEvent, info?: GenerationInfo) => {
        e.stopPropagation();
        if (info) {
            onRegenerate(info);
        }
    };

    if (images.length === 0 && videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 p-8 min-h-[calc(100vh-250px)]">
                <FolderOpenIcon className="w-24 h-24 mb-4 text-gray-300 dark:text-gray-600" />
                <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-400">{t('imageLibrary.empty.title')}</h2>
                <p className="mt-2 text-gray-500">{t('imageLibrary.empty.subtitle')}</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8">
            {videos.length > 0 && (
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('imageLibrary.videos.title')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {videos.map((video) => (
                             <VideoResultComponent
                                key={video.id}
                                result={video}
                                onRegenerate={video.generationInfo ? (e) => handleRegen(e, video.generationInfo) : undefined}
                                onDelete={(e) => handleDeleteVideo(e, video.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {images.length > 0 && (
                 <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('imageLibrary.images.title')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {images.map((image, index) => (
                            <div
                                key={image.id}
                                className="group relative bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 aspect-square"
                            >
                                <img
                                    src={`data:${image.mimeType};base64,${image.base64}`}
                                    alt="Library item"
                                    className="w-full h-full object-cover pointer-events-none"
                                />
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                   <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                                        <button onClick={() => handleDownload(image)} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.download')}>
                                            <DownloadIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => onFullscreen(images, index)} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.view')}>
                                            <ExpandIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={(e) => handleDeleteImage(e, image.id)} className="p-2 bg-red-700/80 rounded-full text-white hover:bg-red-600 transition-colors" title={t('imageLibrary.action.delete')}>
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                        {image.generationInfo && (
                                             <button onClick={(e) => handleRegen(e, image.generationInfo)} className="p-2 bg-green-700/80 rounded-full text-white hover:bg-green-600 transition-colors" title={t('imageLibrary.action.regenerate')}>
                                                <LoopIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        <button onClick={() => handleSend(image, onSendToEnhance)} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.enhance')}>
                                            <SparklesIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleSend(image, onSendToTraining)} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.train')}>
                                            <WandIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleSend(image, onSendToTechDrawing)} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.techDraw')}>
                                            <DocumentTextIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleSend(image, onSendToUpscale)} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.upscale')}>
                                            <ArrowUpOnSquareIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleSend(image, onSendToVeo)} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.veo')}>
                                            <VideoCameraIcon className="w-5 h-5" />
                                        </button>
                                   </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
            )}
        </div>
    );
};

export default ImageLibraryTab;