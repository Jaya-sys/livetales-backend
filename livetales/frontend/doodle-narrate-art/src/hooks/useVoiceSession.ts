import { useRef, useCallback } from 'react';
import { useStoryStore } from '@/stores/storyStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://livetales-backend-659171680418.us-central1.run.app/ws/story';
const CANVAS_SNAPSHOT_INTERVAL = 5000;
const SEND_SAMPLE_RATE = 16000;
const RECEIVE_SAMPLE_RATE = 24000;

/**
 * Convert ArrayBuffer to base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}


export function useVoiceSession() {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<{ source: MediaStreamAudioSourceNode; processor: ScriptProcessorNode } | null>(null);
  const canvasIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio playback state
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const store = useStoryStore;

  /**
   * Play the next audio chunk from the queue (sequential AudioBuffer approach).
   * Matches SaschaHeyer client exactly.
   */
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;

    try {
      // Stop previous source if still active
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.onended = null;
          currentSourceRef.current.stop();
          currentSourceRef.current.disconnect();
        } catch {
          // Ignore errors if already stopped
        }
        currentSourceRef.current = null;
      }

      // Get next audio data from queue
      const audioData = audioQueueRef.current.shift()!;

      // Ensure playback context exists
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioContext({ sampleRate: RECEIVE_SAMPLE_RATE });
      }

      const ctx = playbackCtxRef.current;

      // Resume if suspended (autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Convert Int16 PCM to Float32 for AudioBuffer
      const int16Array = new Int16Array(audioData);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create AudioBuffer and play
      const audioBuffer = ctx.createBuffer(1, float32Array.length, RECEIVE_SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      currentSourceRef.current = source;
      source.connect(ctx.destination);

      // Chain playback: when this buffer ends, play the next
      source.onended = () => {
        currentSourceRef.current = null;
        playNextInQueue();
      };

      source.start(0);
    } catch (e) {
      console.error('[Player] Error during audio playback:', e);
      currentSourceRef.current = null;
      // Try next buffer on error
      setTimeout(() => playNextInQueue(), 100);
    }
  }, []);

  /**
   * Queue a base64-encoded audio chunk for playback.
   */
  const playAudio = useCallback((base64Audio: string) => {
    const audioData = base64ToArrayBuffer(base64Audio);
    store.getState().setTaliSpeaking(true);
    audioQueueRef.current.push(audioData);

    // If not currently playing, start playback
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  }, [playNextInQueue]);

  /**
   * Interrupt playback: stop current source and clear queue.
   */
  const interruptPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null;
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch {
        // Ignore
      }
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    store.getState().setTaliSpeaking(false);
  }, []);

  const startCanvasSnapshots = useCallback(() => {
    canvasIntervalRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const canvas = document.querySelector<HTMLCanvasElement>('[data-canvas="drawing-canvas"]');
      if (!canvas) return;

      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            ws.send(JSON.stringify({ type: 'canvas_frame', data: base64 }));
          };
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.4,
      );
    }, CANVAS_SNAPSHOT_INTERVAL);
  }, []);

  const stopCanvasSnapshots = useCallback(() => {
    if (canvasIntervalRef.current) {
      clearInterval(canvasIntervalRef.current);
      canvasIntervalRef.current = null;
    }
  }, []);

  /**
   * Handle incoming WebSocket messages (all JSON text frames).
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'ready') {
        console.log('[WS] Server ready');
        return;
      }

      if (msg.type === 'audio') {
        // Audio data as base64 — queue for playback
        playAudio(msg.data);
        return;
      }

      if (msg.type === 'text') {
        // Streaming text from Tali
        if (msg.data) {
          store.getState().setTaliText(msg.data);
        }
        return;
      }

      if (msg.type === 'turn_complete') {
        // Tali finished speaking
        store.getState().setTaliSpeaking(false);
        return;
      }

      if (msg.type === 'interrupted') {
        // User interrupted Tali — stop playback immediately
        console.log('[WS] Interruption detected, stopping playback');
        interruptPlayback();
        return;
      }

      if (msg.type === 'story_page') {
        console.log('[Story page]', msg.page_number, msg.narrative_text);
        if (msg.narrative_text) {
          store.getState().addStoryText(msg.page_number, msg.narrative_text);
          useStoryStore.setState({ currentPage: msg.page_number, isGeneratingStory: false, generatingPage: null });
        }
        return;
      }

      if (msg.type === 'illustration') {
        console.log('[Illustration] page', msg.page_number);
        const dataUrl = `data:${msg.mime_type};base64,${msg.image_base64}`;
        const pages = store.getState().storyPages.map((p) =>
          p.pageNumber === msg.page_number ? { ...p, imageUrl: dataUrl } : p
        );
        useStoryStore.setState({ storyPages: pages });
        return;
      }

      // Narration audio (TTS voice-over for a story page)
      if (msg.type === 'narration') {
        console.log('[Narration] page', msg.page_number);
        const audioDataUrl = `data:audio/wav;base64,${msg.audio_base64}`;
        const pages = store.getState().storyPages.map((p) =>
          p.pageNumber === msg.page_number ? { ...p, narrationUrl: audioDataUrl } : p
        );
        useStoryStore.setState({ storyPages: pages });
        return;
      }

      // Animated video clip (Veo) for a story page
      if (msg.type === 'page_video') {
        console.log('[Video] page', msg.page_number);
        const videoDataUrl = `data:${msg.mime_type};base64,${msg.video_base64}`;
        const pages = store.getState().storyPages.map((p) =>
          p.pageNumber === msg.page_number ? { ...p, videoUrl: videoDataUrl } : p
        );
        useStoryStore.setState({ storyPages: pages });
        return;
      }

      // Combined story narration (full TTS for entire story)
      if (msg.type === 'story_narration') {
        console.log('[Story narration] full story audio received');
        const audioDataUrl = `data:audio/wav;base64,${msg.audio_base64}`;
        useStoryStore.setState({ storyNarrationUrl: audioDataUrl });
        return;
      }

      // Combined story video (one Veo video for entire story)
      if (msg.type === 'story_video') {
        console.log('[Story video] full story video received');
        const videoDataUrl = `data:${msg.mime_type};base64,${msg.video_base64}`;
        useStoryStore.setState({ storyVideoUrl: videoDataUrl });
        return;
      }

      // Video generation progress
      if (msg.type === 'video_progress') {
        console.log('[Video progress]', msg.status, msg.message);
        useStoryStore.setState({ videoStatus: msg.status, videoMessage: msg.message || '' });
        return;
      }

      if (msg.type === 'error') {
        console.error('[WS] Server error:', msg.data);
        return;
      }
    } catch (e) {
      console.error('[WS] Message parse error:', e);
    }
  }, [playAudio, interruptPlayback]);

  const startSession = useCallback(async () => {
    const { setWsStatus, setRecording, setTaliSpeaking } = store.getState();

    setWsStatus('connecting');

    const sessionId = `session-${Date.now()}`;
    const ws = new WebSocket(`${WS_URL}/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setWsStatus('connected');
      setRecording(true);
      // Delay canvas snapshots so they don't compete with Tali's greeting
      setTimeout(() => startCanvasSnapshots(), 4000);
    };

    ws.onmessage = handleMessage;

    ws.onerror = (e) => {
      console.error('[WS] Error:', e);
      setWsStatus('disconnected');
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setWsStatus('disconnected');
      setRecording(false);
      setTaliSpeaking(false);
      stopCanvasSnapshots();
    };

    // Start microphone capture using ScriptProcessorNode (matches SaschaHeyer reference)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: SEND_SAMPLE_RATE },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: SEND_SAMPLE_RATE });
      recorderCtxRef.current = audioCtx;
      console.log(`[Mic] AudioContext sampleRate: ${audioCtx.sampleRate} (requested ${SEND_SAMPLE_RATE})`);

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // Get Float32 audio samples
        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)));
        }

        // Send as base64 JSON (matching SaschaHeyer pattern)
        const audioBuffer = new Uint8Array(int16Data.buffer);
        const base64Audio = arrayBufferToBase64(audioBuffer.buffer);

        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: base64Audio,
        }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      recorderRef.current = { source, processor };

      console.log('[Mic] ScriptProcessor recorder initialized (4096 buffer)');
    } catch (e) {
      console.error('[Mic] Failed to get microphone:', e);
    }
  }, [handleMessage, startCanvasSnapshots, stopCanvasSnapshots]);

  const stopSession = useCallback(() => {
    const { setRecording, setWsStatus, setTaliSpeaking, videoStatus } = store.getState();

    // Stop recording
    if (recorderRef.current) {
      recorderRef.current.source.disconnect();
      recorderRef.current.processor.disconnect();
      recorderRef.current = null;
    }
    recorderCtxRef.current?.close();
    recorderCtxRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    stopCanvasSnapshots();

    // If video is generating, keep WebSocket open until it completes
    const isVideoGenerating = videoStatus === 'started' || videoStatus === 'generating';
    if (isVideoGenerating && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[WS] Video still generating, keeping connection open...');
      setRecording(false);
      setTaliSpeaking(false);
      // Don't close WS yet — the onmessage handler will receive the video
      // Set up a watcher that closes WS once video arrives or after timeout
      const checkInterval = setInterval(() => {
        const currentStatus = store.getState().videoStatus;
        if (currentStatus === 'complete' || currentStatus === '' || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          clearInterval(checkInterval);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'end' }));
            wsRef.current.close();
          }
          wsRef.current = null;
          setWsStatus('disconnected');
        }
      }, 2000);
      // Safety timeout: close after 5 minutes max
      setTimeout(() => {
        clearInterval(checkInterval);
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
          setWsStatus('disconnected');
        }
      }, 300000);
      return;
    }

    // Send end signal and close WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
      wsRef.current.close();
    }
    wsRef.current = null;

    // Stop playback
    interruptPlayback();
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;

    setRecording(false);
    setTaliSpeaking(false);
    setWsStatus('disconnected');
  }, [stopCanvasSnapshots, interruptPlayback]);

  const toggleSession = useCallback(() => {
    const { isRecording } = store.getState();
    if (isRecording) {
      stopSession();
    } else {
      startSession();
    }
  }, [startSession, stopSession]);

  const requestStoryPage = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const { currentPage } = store.getState();
    useStoryStore.setState({ isGeneratingStory: true, generatingPage: currentPage });
    ws.send(JSON.stringify({ type: 'generate_story' }));
  }, []);

  const requestStoryVideo = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'generate_video' }));
  }, []);

  return { toggleSession, startSession, stopSession, requestStoryPage, requestStoryVideo };
}
