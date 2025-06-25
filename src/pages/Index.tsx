
import { KanbanBoard } from "@/components/KanbanBoard";
import { InitialSyncTrigger } from "@/components/InitialSyncTrigger";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <div className="mb-4">
          <InitialSyncTrigger />
        </div>
        <KanbanBoard />
      </div>
    </div>
  );
};

export default Index;
