
import KanbanBoard from "@/components/KanbanBoard";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <KanbanBoard onFrameUrlChange={() => {}} />
      </div>
    </div>
  );
};

export default Index;
