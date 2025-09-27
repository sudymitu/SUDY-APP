import React, { useState, useRef } from 'react';
import { VideoResult } from '../types';
import { DownloadIcon, ExpandIcon, SpeakerWaveIcon, SpeakerXMarkIcon, TrashIcon, LoopIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface VideoResultProps {
    result: VideoResult;
    onDelete?: (e: React.MouseEvent) => void;
    onRegenerate?: (e: React.MouseEvent) => void;
    viewMode?: 'grid' | 'single';
}

const VideoResultComponent: React.FC<VideoResultProps> = ({ result, onDelete, onRegenerate, viewMode = 'grid' }) => {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(true);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = result.url;
        link.download = `video_result_${result.id}_sudyapp.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleToggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
        }
    };

    const handleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        videoRef.current?.requestFullscreen();
    };

    return (
        <div className={`group relative bg-black rounded-lg overflow-hidden border border-gray-700 ${viewMode === 'grid' ? 'aspect-video' : ''}`}>
            <video
                ref={videoRef}
                src={result.url}
                poster={`data:image/jpeg;base64,${result.posterBase64}`}
                className={`w-full object-contain ${viewMode === 'grid' ? 'h-full' : ''}`}
                autoPlay
                loop
                muted={isMuted}
                playsInline
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                    <button onClick={handleDownload} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.download')}>
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                    <button onClick={handleFullscreen} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.view')}>
                        <ExpandIcon className="w-5 h-5" />
                    </button>
                    <button onClick={handleToggleMute} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={isMuted ? "Unmute" : "Mute"}>
                        {isMuted ? <SpeakerXMarkIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                    </button>
                    {onRegenerate && (
                         <button onClick={onRegenerate} className="p-2 bg-green-700/80 rounded-full text-white hover:bg-green-600 transition-colors" title={t('imageLibrary.action.regenerate')}>
                            <LoopIcon className="w-5 h-5" />
                        </button>
                    )}
                    {onDelete && (
                         <button onClick={onDelete} className="p-2 bg-red-700/80 rounded-full text-white hover:bg-red-600 transition-colors" title={t('imageLibrary.action.delete')}>
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoResultComponent;