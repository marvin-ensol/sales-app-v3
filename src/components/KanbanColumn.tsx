
import { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface KanbanColumnProps {
  title: string;
  color: string;
  count: number;
  children: ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const KanbanColumn = ({ 
  title, 
  color, 
  count, 
  children, 
  isCollapsed = false, 
  onToggleCollapse 
}: KanbanColumnProps) => {
  return (
    <div className={`flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-80'}`}>
      <div className={`rounded-lg border-2 ${color} min-h-[600px] h-full`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {isCollapsed ? (
              <div className="flex flex-col items-center">
                <h3 className="font-semibold text-gray-900 text-sm writing-mode-vertical-rl text-orientation-mixed transform rotate-180">
                  {title}
                </h3>
                <span className="bg-gray-100 text-gray-600 px-1 py-1 rounded-full text-xs font-medium mt-2">
                  {count}
                </span>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm font-medium">
                  {count}
                </span>
              </>
            )}
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="mt-2 w-full flex justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        <div 
          className="p-4 cursor-pointer" 
          onClick={!isCollapsed ? onToggleCollapse : undefined}
        >
          {!isCollapsed && children}
        </div>
      </div>

      <style jsx>{`
        .writing-mode-vertical-rl {
          writing-mode: vertical-rl;
        }
        .text-orientation-mixed {
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
};

export default KanbanColumn;
