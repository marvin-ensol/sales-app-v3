import { useState, useRef, KeyboardEvent } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

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
    } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      // Remove last badge when backspace is pressed on empty input
      e.preventDefault();
      onValuesChange(values.slice(0, -1));
    }
  };

  const handleRemove = (valueToRemove: string | number) => {
    onValuesChange(values.filter(v => v !== valueToRemove));
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium whitespace-nowrap">{label}:</label>
      <div 
        className="flex flex-wrap items-center gap-1.5 min-h-10 w-[300px] rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((value) => (
          <Badge 
            key={value} 
            variant="secondary" 
            className="flex items-center gap-1 pr-1 shrink-0"
          >
            <span>{value}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(value);
              }}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
              aria-label={`Remove ${value}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type={type}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[60px] outline-none bg-transparent placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
