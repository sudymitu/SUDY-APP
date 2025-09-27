import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { PaintBrushIcon, EraserIcon, UndoIcon, RedoIcon, TrashIcon } from './icons';

interface DrawingCanvasProps {
  width: number;
  height: number;
}

export interface DrawingCanvasRef {
  getCanvasDataURL: () => string | null;
  clearCanvas: () => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({ width, height }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000'); // Default to black for sketching
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const getCtx = () => canvasRef.current?.getContext('2d');

  const saveHistory = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };
  
  const clearCanvas = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if(ctx && canvas) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveHistory();
    }
  };

  useImperativeHandle(ref, () => ({
    getCanvasDataURL: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      
      const ctx = getCtx();
      if(!ctx) return null;
      const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      // Check if it's not just the initial white background
      const isDirty = pixelBuffer.some(color => (color & 0xFFFFFF) !== 0xFFFFFF);
      if (!isDirty) return null;
      
      return canvas.toDataURL('image/png');
    },
    clearCanvas,
  }));

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const ctx = getCtx();
      if (ctx) ctx.putImageData(history[newIndex], 0, 0);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const ctx = getCtx();
      if (ctx) ctx.putImageData(history[newIndex], 0, 0);
    }
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = getCtx();
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    const ctx = getCtx();
    if (!ctx || !isDrawing) return;
    ctx.closePath();
    setIsDrawing(false);
    saveHistory();
  };
  
  // Initialize canvas
  useEffect(() => {
    clearCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);


  const toolButtonClass = (t: string) => `p-2 rounded-md ${tool === t ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'} transition-colors`;
  const historyButtonClass = (disabled: boolean) => `p-2 rounded-md ${disabled ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'} transition-colors`;

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="bg-white border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
         <button onClick={() => setTool('brush')} className={toolButtonClass('brush')} title="Brush"><PaintBrushIcon className="w-5 h-5"/></button>
         <button onClick={() => setTool('eraser')} className={toolButtonClass('eraser')} title="Eraser"><EraserIcon className="w-5 h-5"/></button>
         <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} className="w-8 h-8 p-1 bg-gray-200 dark:bg-gray-700 rounded-md cursor-pointer" disabled={tool === 'eraser'}/>
         <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
             <input type="range" min="1" max="50" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-24"/>
             <span>{brushSize}px</span>
         </div>
         <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
         <button onClick={undo} disabled={historyIndex <= 0} className={historyButtonClass(historyIndex <= 0)} title="Undo"><UndoIcon className="w-5 h-5"/></button>
         <button onClick={redo} disabled={historyIndex >= history.length - 1} className={historyButtonClass(historyIndex >= history.length - 1)} title="Redo"><RedoIcon className="w-5 h-5"/></button>
         <button onClick={clearCanvas} className="p-2 rounded-md bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/40" title="Clear Canvas"><TrashIcon className="w-5 h-5"/></button>
      </div>
    </div>
  );
});

export default DrawingCanvas;
