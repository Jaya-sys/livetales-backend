import { Mic, MicOff, Volume2, VolumeX, BookOpen, Film } from 'lucide-react';
import { useStoryStore } from '@/stores/storyStore';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useVoiceSession } from '@/hooks/useVoiceSession';

const VoiceControlBar = () => {
  const { isRecording, isTaliSpeaking, wsStatus, taliText, setStoryComplete, currentPage, videoStatus, isGeneratingStory, storyPages } = useStoryStore();
  const { toggleSession, stopSession, requestStoryPage, requestStoryVideo } = useVoiceSession();
  const [isMuted, setIsMuted] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = wsStatus === 'connecting'
    ? ['Connecting to Tali...']
    : isTaliSpeaking
    ? [taliText || 'Tali is telling your story...']
    : isRecording
    ? ['Tali is listening...', 'Tali is watching you draw...']
    : ['Tap the microphone to start', 'Ready to listen...'];

  useEffect(() => {
    if (statuses.length <= 1) return;
    const interval = setInterval(() => setStatusIndex((i) => (i + 1) % statuses.length), 3000);
    return () => clearInterval(interval);
  }, [statuses.length]);

  // Reset status index when statuses change
  useEffect(() => {
    setStatusIndex(0);
  }, [wsStatus, isTaliSpeaking, isRecording]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-lg border-t border-border">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3 gap-4">
        {/* Left: Tali avatar + status */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full gradient-magic flex items-center justify-center text-lg flex-shrink-0">
            🧚
          </div>
          <motion.span
            key={statuses[statusIndex]}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground truncate"
          >
            {statuses[statusIndex]}
          </motion.span>
        </div>

        {/* Center: Waveform */}
        <div className="flex items-center gap-1 h-8" aria-label="Audio visualizer">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-colors ${
                isRecording || isTaliSpeaking ? 'bg-primary' : wsStatus === 'connecting' ? 'bg-yellow-400' : 'bg-border'
              }`}
              style={{
                animation: isRecording || isTaliSpeaking || wsStatus === 'connecting'
                  ? `pulse-bar 1.2s ease-in-out ${i * 0.15}s infinite`
                  : 'none',
                height: '100%',
                transformOrigin: 'center',
              }}
            />
          ))}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleSession}
            disabled={wsStatus === 'connecting'}
            className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 ${
              isRecording
                ? 'bg-primary text-primary-foreground shadow-glow'
                : wsStatus === 'connecting'
                ? 'bg-yellow-400 text-white'
                : 'bg-muted text-muted-foreground'
            }`}
            aria-label={isRecording ? 'Stop session' : 'Start session'}
          >
            {isRecording && (
              <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
            )}
            {isRecording ? <Mic className="w-5 h-5 relative z-10" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-full hover:bg-muted transition-colors active:scale-90"
            aria-label={isMuted ? 'Unmute Tali' : 'Mute Tali'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-muted-foreground" /> : <Volume2 className="w-5 h-5 text-muted-foreground" />}
          </button>
          <button
            onClick={requestStoryPage}
            disabled={!isRecording || currentPage > 6 || isGeneratingStory}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {isGeneratingStory ? 'Creating...' : currentPage > 6 ? 'Story Done' : `Page ${currentPage}`}
          </button>
          <button
            onClick={requestStoryVideo}
            disabled={!isRecording || !storyPages.some(p => p.text) || videoStatus === 'started' || videoStatus === 'generating'}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1.5 rounded-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Film className="w-3.5 h-3.5" />
            {videoStatus === 'started' || videoStatus === 'generating' ? 'Creating...' : 'Animate'}
          </button>
          <button
            onClick={() => { stopSession(); setStoryComplete(true); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            End Story
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceControlBar;
