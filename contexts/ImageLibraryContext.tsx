

import React, { createContext, useState, useContext, ReactNode } from 'react';
import { ImageResult, VideoResult } from '../types';

interface ImageLibraryContextType {
  images: ImageResult[];
  videos: VideoResult[];
  addMedia: (media: ImageResult | VideoResult) => void;
  deleteImage: (imageId: string) => void;
  deleteVideo: (videoId: string) => void;
}

const ImageLibraryContext = createContext<ImageLibraryContextType | undefined>(undefined);

export const ImageLibraryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);

  const addMedia = (media: ImageResult | VideoResult) => {
    if ('url' in media) {
        setVideos(prev => prev.some(v => v.id === media.id) ? prev : [media, ...prev]);
    } else {
        setImages(prev => prev.some(img => img.id === media.id) ? prev : [media, ...prev]);
    }
  };

  const deleteImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const deleteVideo = (videoId: string) => {
    setVideos(prev => prev.filter(v => v.id !== videoId));
  };
  
  return (
    <ImageLibraryContext.Provider value={{ images, videos, addMedia, deleteImage, deleteVideo }}>
      {children}
    </ImageLibraryContext.Provider>
  );
};

export const useImageLibrary = (): ImageLibraryContextType => {
  const context = useContext(ImageLibraryContext);
  if (!context) {
    throw new Error('useImageLibrary must be used within an ImageLibraryProvider');
  }
  return context;
};