import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DelaySelectorProps {
  value: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  onChange: (value: { amount: number; unit: 'minutes' | 'hours' | 'days' }) => void;
}

export const DelaySelector = ({ value, onChange }: DelaySelectorProps) => {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseInt(e.target.value) || 0;
    onChange({ ...value, amount });
  };

  const handleUnitChange = (unit: 'minutes' | 'hours' | 'days') => {
    onChange({ ...value, unit });
  };

  return (
    <div className="flex gap-2">
      <Input
        type="number"
        min="1"
        value={value.amount}
        onChange={handleAmountChange}
        className="w-20"
        placeholder="1"
      />
      <Select value={value.unit} onValueChange={handleUnitChange}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="minutes">Minutes</SelectItem>
          <SelectItem value="hours">Heures</SelectItem>
          <SelectItem value="days">Jours</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};