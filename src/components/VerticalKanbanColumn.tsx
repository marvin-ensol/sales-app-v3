
import { ReactNode } from "react";
import { ChevronDown, ChevronRight, Lock, Clock, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { generateCategoryColors } from "@/lib/colorUtils";

interface VerticalKanbanColumnProps {
  title: string;
  color: string; // Now expects hex color
  count: number;
  completedCount: number;
  children: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  isLocked?: boolean;
  isLockedFromExpansion?: boolean; // New prop for expansion locking
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
  isLockedFromExpansion = false,
  hasContent = false
}: VerticalKanbanColumnProps) => {
  // Column can be expanded if it has content and is not locked from expansion
  const canExpand = hasContent && !isLockedFromExpansion;
  const colors = generateCategoryColors(color);
  
  const handleToggle = () => {
    console.log(`=== TOGGLE DEBUG FOR ${title} ===`);
    console.log(`canExpand: ${canExpand}`);
    console.log(`isLocked: ${isLocked}`);
    console.log(`isLockedFromExpansion: ${isLockedFromExpansion}`);
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
  console.log(`isExpanded: ${isExpanded}, hasContent: ${hasContent}, canExpand: ${canExpand}, isLockedFromExpansion: ${isLockedFromExpansion}`);
  
  return (
    <div className="border-b border-gray-200">
      <div 
        className={`p-3 transition-colors border-l-4 ${canExpand ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'} ${isExpanded && hasContent ? 'sticky top-0 z-20 border-b border-gray-200 bg-white' : ''} ${isLocked ? 'opacity-75' : ''}`}
        style={{
          borderLeftColor: colors.border,
          backgroundColor: isExpanded && hasContent ? 'white' : (isExpanded ? colors.expandedBg : 'white')
        }}
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
            {isLockedFromExpansion && hasContent && (
              <Lock className="h-4 w-4 text-gray-500" />
            )}
            {isLocked && hasContent && !isLockedFromExpansion && (
              <Lock className="h-4 w-4 text-gray-500" />
            )}
            {!canExpand && !isLocked && !isLockedFromExpansion && <div className="w-4 h-4" />}
            <h3 className={`font-semibold ${isLocked || isLockedFromExpansion ? 'text-gray-500' : 'text-gray-900'}`}>
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
        <div 
          className="pb-3"
          style={{ backgroundColor: colors.expandedBg }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default VerticalKanbanColumn;
