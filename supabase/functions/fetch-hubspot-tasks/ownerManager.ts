
import { HubSpotOwner } from './hubspotUtils.ts';
import { HubSpotApiClient } from './apiClient.ts';
import { HUBSPOT_ALLOWED_TEAMS, API_CONFIG } from './constants.ts';

export class OwnerManager {
  constructor(private apiClient: HubSpotApiClient) {}

  async fetchValidOwners(): Promise<{ validOwnerIds: Set<string>; ownersMap: any }> {
    console.log('Fetching filtered owners from HubSpot...');
    
    await this.apiClient.delay(API_CONFIG.FETCH_DELAY);
    
    const allOwners = await this.apiClient.fetchOwners();
    console.log('Owners fetched successfully:', allOwners.length);
    
    let validOwnerIds = new Set<string>();
    let ownersMap = {};
    
    const validOwners = allOwners.filter((owner: HubSpotOwner) => {
      const ownerTeams = owner.teams || [];
      const hasAllowedTeam = ownerTeams.some((team: any) => {
        const teamIdString = team.id?.toString();
        return HUBSPOT_ALLOWED_TEAMS.includes(teamIdString);
      });
      
      if (hasAllowedTeam) {
        validOwnerIds.add(owner.id.toString());
        console.log(`✔️ INCLUDED OWNER: ${owner.id} (${owner.firstName || ''} ${owner.lastName || ''})`);
      } else {
        console.log(`❌ EXCLUDED OWNER: ${owner.id} (${owner.firstName || ''} ${owner.lastName || ''})`);
      }
      
      return hasAllowedTeam;
    });

    console.log(`Valid owners (in allowed teams): ${validOwners.length}`);
    
    ownersMap = validOwners.reduce((acc: any, owner: HubSpotOwner) => {
      acc[owner.id] = owner;
      return acc;
    }, {});

    return { validOwnerIds, ownersMap };
  }
}
