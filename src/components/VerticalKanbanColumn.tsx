
import { ReactNode } from "react";
import { ChevronDown, ChevronRight, Lock, Clock, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VerticalKanbanColumnProps {
  title: string;
  color: string;
  count: number;
  completedCount: number;
  children: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  isLocked?: boolean;
}

const VerticalKanbanColumn = ({ 
  title, 
  color, 
  count, 
  completedCount,
  children, 
  isExpanded,
  onToggle,
  isLocked = false
}: VerticalKanbanColumnProps) => {
  const hasContent = count > 0;
  const canExpand = hasContent && !isLocked;
  
  return (
    <div className="border-b border-gray-200">
      <div 
        className={`p-3 transition-colors ${color} ${canExpand ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'} ${isExpanded && hasContent ? 'sticky top-0 bg-white z-20 border-b border-gray-200' : ''} ${isLocked ? 'opacity-75' : ''}`}
        onClick={canExpand ? onToggle : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canExpand && (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )
            )}
            {isLocked && hasContent && (
              <Lock className="h-4 w-4 text-gray-500" />
            )}
            {!canExpand && !isLocked && <div className="w-4 h-4" />}
            <h3 className={`font-semibold ${isLocked ? 'text-gray-500' : 'text-gray-900'}`}>
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
              <Clock className="w-3 h-3" />
              <span className="text-xs font-medium">{count}</span>
            </Badge>
            <Badge className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 hover:bg-green-200">
              <Check className="w-3 h-3" />
              <span className="text-xs font-medium">{completedCount}</span>
            </Badge>
          </div>
        </div>
      </div>
      
      {isExpanded && hasContent && !isLocked && (
        <div className="px-1 pb-3">
          <div className="space-y-2">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerticalKanbanColumn;
