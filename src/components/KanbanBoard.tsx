
import { useState } from "react";
import { Plus, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskStatus } from "@/types/task";

const initialTasks: Task[] = [
  {
    id: "1",
    title: "Passez au solaire avec Ensol !",
    contact: "Annick Texier",
    status: "a-faire",
    dueDate: "13/06 à 15:00",
    priority: "high",
    owner: "Gauthier Bonder"
  },
  {
    id: "2",
    title: "Rappel Prise 1",
    contact: "Mokhtar Zine El Kalm",
    status: "a-faire",
    dueDate: "13/06 à 15:30",
    priority: "medium",
    owner: "Gauthier Bonder"
  },
  {
    id: "3",
    title: "Rappel Finir",
    contact: "Gerard Chabot",
    status: "a-faire",
    dueDate: "13/06 à 15:30",
    priority: "medium",
    owner: "Gauthier Bonder"
  },
  {
    id: "4",
    title: "Passez au solaire avec Ensol !",
    contact: "Alexandre Luminet",
    status: "a-faire",
    dueDate: "13/06 à 16:45",
    priority: "high",
    owner: "Gauthier Bonder"
  },
  {
    id: "5",
    title: "Appel manqué",
    contact: "Luc MIKAILOFF",
    status: "communications",
    dueDate: "",
    priority: "medium",
    owner: "Gauthier Bonder"
  },
  {
    id: "6",
    title: "Tentative 2",
    contact: "Eric Jakova-Merturi",
    status: "attempted",
    dueDate: "",
    priority: "low",
    owner: "Gauthier Bonder"
  },
  {
    id: "7",
    title: "Tentative 2",
    contact: "Catherine Solanas",
    status: "attempted",
    dueDate: "",
    priority: "low",
    owner: "Gauthier Bonder"
  },
  {
    id: "8",
    title: "Tentative 2",
    contact: "Gabriel Tuli",
    status: "attempted",
    dueDate: "",
    priority: "low",
    owner: "Gauthier Bonder"
  },
  {
    id: "9",
    title: "Tentative 2",
    contact: "Rio Daus",
    status: "attempted",
    dueDate: "",
    priority: "low",
    owner: "Gauthier Bonder"
  },
  {
    id: "10",
    title: "Qualified sans tâche future",
    contact: "Robert Picon",
    status: "custom",
    dueDate: "12/06 | P?",
    priority: "high",
    owner: "Gauthier Bonder"
  }
];

const columns = [
  { id: "a-faire", title: "À faire", color: "border-green-400 bg-green-50", count: 4 },
  { id: "communications", title: "Communications", color: "border-blue-400 bg-blue-50", count: 1 },
  { id: "attempted", title: "Attempted", color: "border-orange-400 bg-orange-50", count: 29 },
  { id: "custom", title: "Custom", color: "border-purple-400 bg-purple-50", count: 1 }
];

const KanbanBoard = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter(task => task.status === status);
  };

  const handleTaskMove = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search tasks or contacts..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-6">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            title={column.title}
            color={column.color}
            count={getTasksByStatus(column.id as TaskStatus).length}
          >
            <div className="space-y-3">
              {getTasksByStatus(column.id as TaskStatus).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onMove={handleTaskMove}
                />
              ))}
            </div>
          </KanbanColumn>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
