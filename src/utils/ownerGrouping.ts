import { HubSpotOwner } from "@/hooks/useUsers";

export interface GroupedOwners {
  teamName: string;
  owners: HubSpotOwner[];
}

export const groupOwnersByTeam = (owners: HubSpotOwner[]): GroupedOwners[] => {
  // Group owners by team
  const teamGroups = new Map<string, HubSpotOwner[]>();
  
  owners.forEach(owner => {
    const teamKey = owner.teamName || 'Sans équipe';
    if (!teamGroups.has(teamKey)) {
      teamGroups.set(teamKey, []);
    }
    teamGroups.get(teamKey)!.push(owner);
  });
  
  // Convert to array and sort teams alphabetically, but keep "Sans équipe" last
  const sortedTeams = Array.from(teamGroups.entries())
    .map(([teamName, teamOwners]) => ({
      teamName,
      owners: teamOwners.sort((a, b) => a.firstName.localeCompare(b.firstName))
    }))
    .sort((a, b) => {
      // Always put "Sans équipe" last
      if (a.teamName === 'Sans équipe') return 1;
      if (b.teamName === 'Sans équipe') return -1;
      // Sort other teams alphabetically
      return a.teamName.localeCompare(b.teamName);
    });
  
  return sortedTeams;
};
