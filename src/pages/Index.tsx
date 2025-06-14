
import { useState } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import HubSpotFrame from "@/components/HubSpotFrame";

const Index = () => {
  const [frameUrl, setFrameUrl] = useState<string>("");

  const handleFrameUrlChange = (url: string) => {
    console.log('Index.tsx handleFrameUrlChange called with:', url);
    console.log('Current frameUrl before update:', frameUrl);
    setFrameUrl(url);
    console.log('setFrameUrl called with:', url);
    // Log after a short delay to see if state updated
    setTimeout(() => {
      console.log('frameUrl after setState (delayed check):', frameUrl);
    }, 100);
  };

  console.log('Index.tsx rendering, current frameUrl:', frameUrl);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left sidebar with tasks */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <KanbanBoard onFrameUrlChange={handleFrameUrlChange} />
      </div>
      
      {/* Right frame area */}
      <div className="flex-1">
        <HubSpotFrame currentUrl={frameUrl} />
      </div>
    </div>
  );
};

export default Index;
