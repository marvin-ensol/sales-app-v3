
import { useState, useEffect } from "react";

const HubSpotFrame = () => {
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    // Listen for frame URL changes from task cards
    const handleFrameUrlChange = (event: CustomEvent) => {
      setCurrentUrl(event.detail.url);
    };

    window.addEventListener('frameUrlChange', handleFrameUrlChange as EventListener);
    
    return () => {
      window.removeEventListener('frameUrlChange', handleFrameUrlChange as EventListener);
    };
  }, []);

  return (
    <div className="h-full bg-green-200 flex items-center justify-center">
      {currentUrl ? (
        <iframe
          src={currentUrl}
          className="w-full h-full border-0"
          title="HubSpot"
        />
      ) : (
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">HubSpot Frame</h2>
          <p className="text-gray-600">Click on a task card to view it in HubSpot</p>
        </div>
      )}
    </div>
  );
};

export default HubSpotFrame;
