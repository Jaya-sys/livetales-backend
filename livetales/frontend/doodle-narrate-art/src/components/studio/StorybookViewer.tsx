import { ChevronLeft, ChevronRight, Play, Pause, Loader2 } from 'lucide-react';
import { useStoryStore } from '@/stores/storyStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';

const StorybookViewer = () => {
  const { currentPage, totalPages, storyPages, setCurrentPage, isGeneratingStory, generatingPage, storyVideoUrl, storyNarrationUrl, videoStatus, videoMessage } = useStoryStore();
  const page = storyPages[currentPage - 1];
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingNarration, setIsPlayingNarration] = useState(false);

  const toggleNarration = () => {
    if (!narrationRef.current) return;
    if (isPlayingNarration) {
      narrationRef.current.pause();
      setIsPlayingNarration(false);
    } else {
      narrationRef.current.play();
      setIsPlayingNarration(true);
    }
  };

  const isCurrentPageGenerating = isGeneratingStory && generatingPage === currentPage;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading font-bold flex items-center gap-2">Your Story</h2>
        <span className="text-sm text-muted-foreground font-medium">
          Page {currentPage} of {totalPages}
        </span>
      </div>

      {/* Page display */}
      <div className="flex-1 bg-card rounded-2xl shadow-card border border-border overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            {/* Illustration area */}
            <div className="aspect-video relative overflow-hidden bg-muted">
              {page?.videoUrl ? (
                <video src={page.videoUrl} className="w-full h-full object-cover" autoPlay loop muted />
              ) : page?.imageUrl ? (
                <img src={page.imageUrl} alt={`Story illustration page ${currentPage}`} className="w-full h-full object-cover" />
              ) : isCurrentPageGenerating ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-muted-foreground text-sm font-medium">Creating illustration...</p>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-muted-foreground text-sm font-medium">Your illustration will appear here...</p>
                </div>
              )}
            </div>

            {/* Story text */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              {isCurrentPageGenerating && !page?.text ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm italic">Writing your story...</span>
                </div>
              ) : (
                <p className="text-base leading-relaxed font-body">
                  {page?.text || (
                    <span className="text-muted-foreground italic">Click the Page button to create your story!</span>
                  )}
                </p>
              )}

              {/* Narration play button */}
              <div className="flex items-center justify-between mt-4">
                {page?.narrationUrl && (
                  <button
                    onClick={toggleNarration}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {isPlayingNarration ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isPlayingNarration ? 'Pause' : 'Listen'}
                  </button>
                )}
                <span className="text-xs text-muted-foreground self-end">{currentPage}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i + 1 === currentPage ? 'bg-primary'
                    : storyPages[i]?.text ? 'bg-primary/40'
                    : 'bg-border'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Video progress or story video player */}
      {videoStatus === 'started' || videoStatus === 'generating' ? (
        <div className="mt-4 flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
          <span className="text-sm text-muted-foreground">{videoMessage || 'Creating your story video...'}</span>
        </div>
      ) : storyVideoUrl ? (
        <div className="mt-4 rounded-xl overflow-hidden border border-border">
          <video src={storyVideoUrl} controls className="w-full" />
        </div>
      ) : null}

      {/* Hidden narration audio element */}
      {page?.narrationUrl && (
        <audio
          ref={narrationRef}
          src={page.narrationUrl}
          onEnded={() => setIsPlayingNarration(false)}
          className="hidden"
        />
      )}

      {/* Story narration audio player */}
      {storyNarrationUrl && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1">Full Story Narration</p>
          <audio src={storyNarrationUrl} controls className="w-full h-8" />
        </div>
      )}
    </div>
  );
};

export default StorybookViewer;
