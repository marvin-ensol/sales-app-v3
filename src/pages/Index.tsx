
import KanbanBoard from "@/components/KanbanBoard";

const Index = () => {
  const handleFrameUrlChange = (url: string) => {
    console.log('Opening HubSpot URL in new tab:', url);
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none">
        <KanbanBoard onFrameUrlChange={handleFrameUrlChange} />
      </div>
    </div>
  );
};

export default Index;
