
import { ReactNode } from "react";

interface KanbanColumnProps {
  title: string;
  color: string;
  count: number;
  children: ReactNode;
}

const KanbanColumn = ({ title, color, count, children }: KanbanColumnProps) => {
  return (
    <div className="flex-shrink-0 w-80">
      <div className={`rounded-lg border-2 ${color} min-h-[600px]`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm font-medium">
              {count}
            </span>
          </div>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default KanbanColumn;
