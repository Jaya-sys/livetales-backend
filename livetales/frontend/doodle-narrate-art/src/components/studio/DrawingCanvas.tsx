import { useRef, useEffect, useCallback, useState } from 'react';
import { useStoryStore } from '@/stores/storyStore';
import CanvasToolbar from './CanvasToolbar';

const DrawingCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const { canvasStrokes, selectedColor, brushSize, addStroke } = useStoryStore();
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    canvasStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [canvasStrokes]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const resize = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        const w = container.clientWidth;
        setCanvasSize({ w, h: Math.round(w * 0.625) });
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    currentPoints.current = [getPos(e)];
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const p = currentPoints.current[0];
      ctx.moveTo(p.x, p.y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    currentPoints.current.push(pos);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentPoints.current.length > 1) {
      addStroke({ points: [...currentPoints.current], color: selectedColor, size: brushSize });
    }
    currentPoints.current = [];
  };

  return (
    <div className="flex flex-col gap-3">
      <CanvasToolbar />
      <div className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-card">
        <canvas
          ref={canvasRef}
          data-canvas="drawing-canvas"
          width={canvasSize.w}
          height={canvasSize.h}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          aria-label="Drawing canvas"
        />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Draw anything and Tali will tell you a story about it! 🎨
      </p>
    </div>
  );
};

export default DrawingCanvas;
