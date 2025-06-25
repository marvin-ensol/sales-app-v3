
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
  hasContent?: boolean;
}

const VerticalKanbanColumn = ({ 
  title, 
  color, 
  count, 
  completedCount,
  children, 
  isExpanded,
  onToggle,
  isLocked = false,
  hasContent = false
}: VerticalKanbanColumnProps) => {
  // Column can be expanded if it has content (locked or not)
  const canExpand = hasContent;
  
  const handleToggle = () => {
    console.log(`=== TOGGLE DEBUG FOR ${title} ===`);
    console.log(`canExpand: ${canExpand}`);
    console.log(`isLocked: ${isLocked}`);
    console.log(`hasContent: ${hasContent}`);
    console.log(`count: ${count}`);
    console.log(`isExpanded before toggle: ${isExpanded}`);
    console.log(`Will call onToggle: ${canExpand}`);
    
    if (canExpand) {
      console.log(`Calling onToggle for ${title}`);
      onToggle();
    } else {
      console.log(`NOT calling onToggle for ${title} - canExpand is false`);
    }
  };
  
  console.log(`=== RENDER ${title} ===`);
  console.log(`isExpanded: ${isExpanded}, hasContent: ${hasContent}, canExpand: ${canExpand}`);
  
  return (
    <div className="border-b border-gray-200">
      <div 
        className={`p-3 transition-colors ${color} ${canExpand ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'} ${isExpanded && hasContent ? 'sticky top-0 bg-white z-20 border-b border-gray-200' : ''} ${isLocked ? 'opacity-75' : ''}`}
        onClick={handleToggle}
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
            <Badge 
              variant="secondary" 
              className={`flex items-center gap-1 px-2 py-1 ${
                count > 0 
                  ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span className="text-xs font-medium">{count}</span>
            </Badge>
            <Badge 
              variant="secondary" 
              className={`flex items-center gap-1 px-2 py-1 ${
                completedCount > 0 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              <Check className="w-3 h-3" />
              <span className="text-xs font-medium">{completedCount}</span>
            </Badge>
          </div>
        </div>
      </div>
      
      {isExpanded && hasContent && (
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
