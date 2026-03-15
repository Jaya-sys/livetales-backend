import DrawingCanvas from '@/components/studio/DrawingCanvas';
import StorybookViewer from '@/components/studio/StorybookViewer';
import VoiceControlBar from '@/components/studio/VoiceControlBar';
import StoryCompleteModal from '@/components/studio/StoryCompleteModal';

const Studio = () => {
  return (
    <div className="min-h-screen pt-20 pb-24 px-4 bg-background">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Drawing Canvas - Left */}
        <div className="lg:w-[55%] w-full">
          <DrawingCanvas />
        </div>
        {/* Storybook Viewer - Right */}
        <div className="lg:w-[45%] w-full">
          <StorybookViewer />
        </div>
      </div>
      <VoiceControlBar />
      <StoryCompleteModal />
    </div>
  );
};

export default Studio;
