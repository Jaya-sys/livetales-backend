import { useStoryStore } from '@/stores/storyStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

const confettiColors = ['#7C3AED', '#F97316', '#38BDF8', '#EAB308', '#22C55E', '#EF4444'];

const StoryCompleteModal = () => {
  const { showCompleteModal, setShowCompleteModal } = useStoryStore();
  const navigate = useNavigate();

  const confetti = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      color: confettiColors[i % confettiColors.length],
      left: Math.random() * 100,
      delay: Math.random() * 2,
      size: Math.random() * 8 + 4,
      duration: Math.random() * 2 + 3,
    })), []);

  return (
    <AnimatePresence>
      {showCompleteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
          onClick={() => setShowCompleteModal(false)}
        >
          {/* Confetti */}
          {confetti.map((c) => (
            <div
              key={c.id}
              className="absolute top-0 rounded-sm pointer-events-none"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.size,
                backgroundColor: c.color,
                animation: `confetti-fall ${c.duration}s ${c.delay}s linear infinite`,
              }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl shadow-card p-8 max-w-md w-full mx-4 text-center relative"
          >
            <button
              onClick={() => setShowCompleteModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-heading font-extrabold mb-2">Your Story is Complete!</h2>
            <p className="text-muted-foreground mb-6 font-heading font-semibold text-lg italic">
              "Whiskers and the Friendly Dragon"
            </p>

            <div className="flex flex-col gap-3">
              <Button className="w-full gradient-primary text-primary-foreground rounded-xl py-5 font-heading font-bold hover:scale-[1.02] active:scale-95 transition-transform">
                Watch it Come Alive 🎬
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl py-5 font-heading font-bold hover:scale-[1.02] active:scale-95 transition-transform"
                onClick={() => { setShowCompleteModal(false); navigate('/library'); }}
              >
                Save to Library 📚
              </Button>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-1">
                Share ↗
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StoryCompleteModal;
