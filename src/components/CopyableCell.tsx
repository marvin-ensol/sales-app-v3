import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CopyableCellProps {
  value: string | number;
  children: React.ReactNode;
  className?: string;
}

export const CopyableCell = ({ value, children, className = "" }: CopyableCellProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(String(value));
      setIsCopied(true);
      toast({
        description: "Copied to clipboard",
      });
      
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className={`relative inline-flex items-center gap-2 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <button
        onClick={handleCopy}
        className={`flex-shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center hover:bg-muted rounded transition-opacity ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Copy to clipboard"
      >
        {isCopied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
};
