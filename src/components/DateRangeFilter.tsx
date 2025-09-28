import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Calendar } from "lucide-react";

interface DateRangeFilterProps {
  lowerBound: string;
  upperBound: string;
  onLowerBoundChange: (value: string) => void;
  onUpperBoundChange: (value: string) => void;
  onClear: () => void;
}

const lowerBoundOptions = [
  { value: 'tout', label: 'Tout' },
  { value: 'debut_mois', label: 'Début du mois en cours' },
  { value: 'semaine_precedente', label: 'Semaine précédente' },
  { value: 'debut_semaine', label: 'Début de la semaine' },
  { value: 'aujourd_hui', label: "Aujourd'hui" },
];

const upperBoundOptions = [
  { value: 'aujourd_hui', label: "Aujourd'hui" },
  { value: 'fin_semaine', label: 'Fin de la semaine' },
  { value: 'semaine_prochaine', label: 'La semaine prochaine' },
  { value: 'fin_mois', label: 'Fin du mois en cours' },
  { value: 'tout', label: 'Tout' },
];

const DateRangeFilter = ({
  lowerBound,
  upperBound,
  onLowerBoundChange,
  onUpperBoundChange,
  onClear
}: DateRangeFilterProps) => {
  const isFilterActive = lowerBound !== 'tout' || upperBound !== 'tout';

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
      isFilterActive 
        ? 'bg-primary/5 border-primary/20' 
        : 'border-border'
    }`} style={{ backgroundColor: '#f3f3f3' }}>
      <Calendar className="h-4 w-4 text-muted-foreground" />
      
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>Échéance de</span>
        <Select value={lowerBound} onValueChange={onLowerBoundChange}>
          <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {lowerBoundOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <span>à</span>
        <Select value={upperBound} onValueChange={onUpperBoundChange}>
          <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {upperBoundOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isFilterActive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          title="Effacer le filtre de date"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

export default DateRangeFilter;