
import { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface VerticalKanbanColumnProps {
  title: string;
  color: string;
  count: number;
  children: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

const VerticalKanbanColumn = ({ 
  title, 
  color, 
  count, 
  children, 
  isExpanded,
  onToggle 
}: VerticalKanbanColumnProps) => {
  return (
    <div className="border-b border-gray-200">
      <div 
        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${color}`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            )}
            <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm font-medium">
            {count}
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerticalKanbanColumn;
