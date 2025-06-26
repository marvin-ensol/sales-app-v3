
import KanbanBoard from "@/components/KanbanBoard";

const Index = () => {
  console.log('=== INDEX PAGE RENDERING ===');
  
  const handleFrameUrlChange = (url: string) => {
    console.log('Opening HubSpot URL in new tab:', url);
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="w-full max-w-none">
        <KanbanBoard onFrameUrlChange={handleFrameUrlChange} />
      </div>
    </div>
  );
};

export default Index;
