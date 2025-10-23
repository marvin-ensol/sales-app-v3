import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface IdFilterInputProps {
  label: string;
  placeholder: string;
  values: (string | number)[];
  onValuesChange: (values: (string | number)[]) => void;
  type?: 'number' | 'text';
}

export const IdFilterInput = ({ 
  label, 
  placeholder, 
  values, 
  onValuesChange,
  type = 'text'
}: IdFilterInputProps) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const newValue = type === 'number' ? parseInt(inputValue.trim()) : inputValue.trim();
      
      // Validate number type
      if (type === 'number' && isNaN(newValue as number)) {
        return;
      }
      
      // Avoid duplicates
      if (!values.includes(newValue)) {
        onValuesChange([...values, newValue]);
      }
      setInputValue('');
    }
  };

  const handleRemove = (valueToRemove: string | number) => {
    onValuesChange(values.filter(v => v !== valueToRemove));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium whitespace-nowrap">{label}:</label>
        <Input
          type={type}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-[200px]"
        />
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 ml-[100px]">
          {values.map((value) => (
            <Badge 
              key={value} 
              variant="secondary" 
              className="flex items-center gap-1 pr-1"
            >
              <span>{value}</span>
              <button
                onClick={() => handleRemove(value)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={`Remove ${value}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
