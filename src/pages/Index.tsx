
import KanbanBoard from "@/components/KanbanBoard";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales App</h1>
          <p className="text-gray-600">Manage your sales tasks and follow-ups</p>
        </div>
        <KanbanBoard />
      </div>
    </div>
  );
};

export default Index;
