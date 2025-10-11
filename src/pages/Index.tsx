
import KanbanBoard from "@/components/KanbanBoard";
import { RealtimeStatusIndicator } from "@/components/RealtimeStatusIndicator";

const Index = () => {
  console.log('=== INDEX PAGE RENDERING ===');
  
  const handleFrameUrlChange = (url: string) => {
    console.log('Opening HubSpot URL in new tab:', url);
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-4 right-4 z-50">
        <RealtimeStatusIndicator />
      </div>
      <div className="w-full max-w-none">
        <KanbanBoard onFrameUrlChange={handleFrameUrlChange} />
      </div>
    </div>
  );
};

export default Index;
