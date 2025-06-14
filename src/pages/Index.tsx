
import KanbanBoard from "@/components/KanbanBoard";
import HubSpotFrame from "@/components/HubSpotFrame";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left sidebar with tasks */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <KanbanBoard />
      </div>
      
      {/* Right frame area */}
      <div className="flex-1">
        <HubSpotFrame />
      </div>
    </div>
  );
};

export default Index;
