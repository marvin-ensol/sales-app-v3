
import KanbanBoard from "@/components/KanbanBoard";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-6 px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales App</h1>
        </div>
        <KanbanBoard />
      </div>
    </div>
  );
};

export default Index;
