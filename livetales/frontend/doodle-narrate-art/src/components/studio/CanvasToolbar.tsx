import { Trash2, Undo2, Eraser } from 'lucide-react';
import { useStoryStore } from '@/stores/storyStore';
import { useState } from 'react';

const COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#7C3AED', '#92400E', '#1E1B4B'];
const SIZES = [3, 6, 10];

const CanvasToolbar = () => {
  const { selectedColor, brushSize, setSelectedColor, setBrushSize, undoStroke, clearStrokes } = useStoryStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl px-4 py-3 shadow-soft border border-border">
      {/* Colors */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Color picker">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedColor(c)}
            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${
              selectedColor === c ? 'border-foreground scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Select color ${c}`}
          />
        ))}
        <button
          onClick={() => setSelectedColor('#FFFFFF')}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
            selectedColor === '#FFFFFF' ? 'border-foreground scale-110' : 'border-border'
          } bg-card`}
          aria-label="Eraser"
        >
          <Eraser className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Brush sizes */}
      <div className="flex items-center gap-2" role="group" aria-label="Brush size">
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setBrushSize(s)}
            className={`rounded-full bg-foreground transition-transform hover:scale-110 active:scale-95 ${
              brushSize === s ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''
            }`}
            style={{ width: s + 8, height: s + 8 }}
            aria-label={`Brush size ${s}`}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Actions */}
      <button onClick={undoStroke} className="p-2 rounded-lg hover:bg-muted transition-colors active:scale-95" aria-label="Undo">
        <Undo2 className="w-4 h-4 text-muted-foreground" />
      </button>

      {showClearConfirm ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-destructive font-medium">Clear all?</span>
          <button onClick={() => { clearStrokes(); setShowClearConfirm(false); }} className="text-destructive font-bold hover:underline">Yes</button>
          <button onClick={() => setShowClearConfirm(false)} className="text-muted-foreground hover:underline">No</button>
        </div>
      ) : (
        <button onClick={() => setShowClearConfirm(true)} className="p-2 rounded-lg hover:bg-muted transition-colors active:scale-95" aria-label="Clear canvas">
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};

export default CanvasToolbar;
