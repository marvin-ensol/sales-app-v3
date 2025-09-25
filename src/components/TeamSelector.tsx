import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useTeams, Team } from '@/hooks/useTeams';

interface TeamSelectorProps {
  selectedTeamIds: string[];
  onTeamsChange: (teamIds: string[]) => void;
}

export const TeamSelector: React.FC<TeamSelectorProps> = ({
  selectedTeamIds,
  onTeamsChange
}) => {
  const { teams, loading } = useTeams();
  const [open, setOpen] = React.useState(false);

  const selectedTeams = teams.filter(team => selectedTeamIds.includes(team.id));
  
  const handleTeamToggle = (teamId: string) => {
    const newSelectedIds = selectedTeamIds.includes(teamId)
      ? selectedTeamIds.filter(id => id !== teamId)
      : [...selectedTeamIds, teamId];
    onTeamsChange(newSelectedIds);
  };

  const handleSelectAll = () => {
    onTeamsChange(teams.map(team => team.id));
  };

  const handleDeselectAll = () => {
    onTeamsChange([]);
  };

  const getDisplayText = () => {
    if (selectedTeamIds.length === 0) {
      return "Toutes les équipes";
    }
    if (selectedTeamIds.length === teams.length) {
      return "Toutes les équipes";
    }
    if (selectedTeamIds.length === 1) {
      return selectedTeams[0]?.name || "1 équipe sélectionnée";
    }
    return `${selectedTeamIds.length} équipes sélectionnées`;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Équipes visibles</label>
        <div className="w-full h-9 rounded-md border bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Équipes visibles</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate">{getDisplayText()}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandList>
              <CommandGroup>
                <CommandItem onSelect={handleSelectAll}>
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedTeamIds.length === teams.length ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  Sélectionner tout
                </CommandItem>
                <CommandItem onSelect={handleDeselectAll}>
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedTeamIds.length === 0 ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  Désélectionner tout
                </CommandItem>
              </CommandGroup>
              <CommandGroup>
                {teams.map((team) => (
                  <CommandItem
                    key={team.id}
                    onSelect={() => handleTeamToggle(team.id)}
                  >
                    <Checkbox
                      checked={selectedTeamIds.includes(team.id)}
                      className="mr-2"
                    />
                    {team.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandEmpty>Aucune équipe trouvée.</CommandEmpty>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedTeams.length > 0 && selectedTeams.length < teams.length && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedTeams.map((team) => (
            <Badge key={team.id} variant="secondary" className="text-xs">
              {team.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};