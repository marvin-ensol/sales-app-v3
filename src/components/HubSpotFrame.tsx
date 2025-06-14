
interface HubSpotFrameProps {
  currentUrl: string;
}

const HubSpotFrame = ({ currentUrl }: HubSpotFrameProps) => {
  console.log('HubSpotFrame current URL:', currentUrl);

  return (
    <div className="h-full bg-gray-50 flex items-center justify-center">
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
