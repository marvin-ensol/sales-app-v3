
interface HubSpotFrameProps {
  currentUrl: string;
}

const HubSpotFrame = ({ currentUrl }: HubSpotFrameProps) => {
  console.log('HubSpotFrame rendering with currentUrl:', currentUrl);
  console.log('HubSpotFrame currentUrl type:', typeof currentUrl);
  console.log('HubSpotFrame currentUrl length:', currentUrl?.length);

  return (
    <div className="h-full bg-gray-50 flex items-center justify-center">
      {currentUrl ? (
        <div className="w-full h-full">
          <div className="p-2 bg-gray-100 text-sm text-gray-600">
            Loading: {currentUrl}
          </div>
          <iframe
            src={currentUrl}
            className="w-full h-full border-0"
            title="HubSpot"
            onLoad={() => console.log('Iframe loaded successfully')}
            onError={() => console.log('Iframe failed to load')}
          />
        </div>
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
