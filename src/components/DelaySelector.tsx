import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DelaySelectorProps {
  value: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  onChange: (value: { amount: number; unit: 'minutes' | 'hours' | 'days' }) => void;
  error?: string;
  onValidate?: (amount: number, unit: string) => void;
}

export const DelaySelector = ({ value, onChange, error, onValidate }: DelaySelectorProps) => {
  // Helper function to round to nearest quarter for hours/days
  const roundToNearestQuarter = (num: number): number => {
    return Math.round(num * 4) / 4;
  };

  // Helper function to check if decimal is valid quarter
  const isValidQuarter = (num: number): boolean => {
    const decimal = num % 1;
    return decimal === 0 || decimal === 0.25 || decimal === 0.5 || decimal === 0.75;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const amount = value.unit === 'minutes' ? parseInt(inputValue) || 0 : parseFloat(inputValue) || 0;
    onChange({ ...value, amount });
  };

  const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let amount = value.unit === 'minutes' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0;
    
    // Auto-correct decimal values for hours and days to nearest quarter
    if ((value.unit === 'hours' || value.unit === 'days') && !isValidQuarter(amount)) {
      amount = roundToNearestQuarter(amount);
      onChange({ ...value, amount });
    }
    
    onValidate?.(amount, value.unit);
  };

  const handleUnitChange = (unit: 'minutes' | 'hours' | 'days') => {
    // When switching units, adjust the amount if needed
    let newAmount = value.amount;
    
    if (unit === 'minutes' && (newAmount % 1 !== 0)) {
      // Convert to integer for minutes
      newAmount = Math.round(newAmount);
    } else if ((unit === 'hours' || unit === 'days') && !isValidQuarter(newAmount)) {
      // Round to nearest quarter for hours/days
      newAmount = roundToNearestQuarter(newAmount);
    }
    
    onChange({ ...value, unit, amount: newAmount });
  };

  // Determine input attributes based on unit
  const getInputAttributes = () => {
    if (value.unit === 'minutes') {
      return { min: "5", max: "90", step: "1" };
    } else if (value.unit === 'hours') {
      return { min: "1", max: "72", step: "0.25" };
    } else { // days
      return { min: "1", step: "0.25" };
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          type="number"
          {...getInputAttributes()}
          value={value.amount}
          onChange={handleAmountChange}
          onBlur={handleAmountBlur}
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
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};