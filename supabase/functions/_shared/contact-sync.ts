export interface ContactSyncOptions {
  contactIds: string[];
  hubspotToken: string;
  supabase: any;
  forceRefresh?: boolean; // Always sync, even if exists
  maxAge?: number; // Refresh if older than X milliseconds
}

export interface ContactSyncResult {
  synced: number;
  failed: number;
  contactsWithOwners: number;
  contactsWithoutOwners: number;
}

/**
 * Unified contact sync utility
 * Handles batching, timestamp parsing, and upsert logic
 */
export async function syncContactsFromHubSpot(
  options: ContactSyncOptions
): Promise<ContactSyncResult> {
  const { contactIds, hubspotToken, supabase, forceRefresh = false, maxAge } = options;
  
  if (contactIds.length === 0) {
    return { synced: 0, failed: 0, contactsWithOwners: 0, contactsWithoutOwners: 0 };
  }

  // If not forcing refresh and maxAge specified, check which contacts need refresh
  let contactsToFetch = contactIds;
  
  if (!forceRefresh && maxAge) {
    const cutoffDate = new Date(Date.now() - maxAge).toISOString();
    
    const { data: existingContacts } = await supabase
      .from('hs_contacts')
      .select('hs_object_id, hubspot_owner_id, updated_at')
      .in('hs_object_id', contactIds);
    
    const existingMap = new Map(
      existingContacts?.map(c => [c.hs_object_id, c]) || []
    );
    
    contactsToFetch = contactIds.filter(id => {
      const existing = existingMap.get(id);
      if (!existing) return true; // Not found, needs fetch
      if (!existing.hubspot_owner_id) return true; // Missing owner, needs fetch
      if (new Date(existing.updated_at) < new Date(cutoffDate)) return true; // Too old, needs fetch
      return false; // Fresh enough, skip
    });
    
    console.log(`📊 ${contactsToFetch.length}/${contactIds.length} contacts need refresh`);
  }
  
  if (contactsToFetch.length === 0) {
    return { synced: 0, failed: 0, contactsWithOwners: 0, contactsWithoutOwners: 0 };
  }

  // Fetch from HubSpot (batches of 100)
  const batchSize = 100;
  let syncedCount = 0;
  let failedCount = 0;
  let withOwners = 0;
  let withoutOwners = 0;

  for (let i = 0; i < contactsToFetch.length; i += batchSize) {
    const batch = contactsToFetch.slice(i, i + batchSize);
    
    try {
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: batch.map(id => ({ id })),
          properties: [
            'firstname',
            'lastname',
            'mobilephone',
            'ensol_source_group',
            'hs_lead_status',
            'lifecyclestage',
            'createdate',
            'lastmodifieddate',
            'hubspot_owner_id'
          ]
        }),
      });

      if (!response.ok) {
        console.error(`❌ Batch fetch failed: ${response.status}`);
        failedCount += batch.length;
        continue;
      }

      const data = await response.json();
      const contacts = data.results || [];
      
      const contactsToUpsert = contacts.map(contact => {
        const hasOwner = !!contact.properties?.hubspot_owner_id;
        if (hasOwner) withOwners++;
        else withoutOwners++;
        
        return {
          hs_object_id: contact.id,
          firstname: contact.properties?.firstname || null,
          lastname: contact.properties?.lastname || null,
          mobilephone: contact.properties?.mobilephone || null,
          ensol_source_group: contact.properties?.ensol_source_group || null,
          hs_lead_status: contact.properties?.hs_lead_status || null,
          lifecyclestage: contact.properties?.lifecyclestage || null,
          createdate: parseContactTimestamp(contact.properties?.createdate),
          lastmodifieddate: parseContactTimestamp(contact.properties?.lastmodifieddate),
          hubspot_owner_id: contact.properties?.hubspot_owner_id || null,
          updated_at: new Date().toISOString()
        };
      });
      
      const { error: upsertError } = await supabase
        .from('hs_contacts')
        .upsert(contactsToUpsert, { 
          onConflict: 'hs_object_id',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        console.error(`❌ Upsert failed:`, upsertError);
        failedCount += contacts.length;
      } else {
        syncedCount += contacts.length;
      }
      
      // Rate limit: 100ms between batches
      if (i + batchSize < contactsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ Error in batch sync:`, error);
      failedCount += batch.length;
    }
  }

  return {
    synced: syncedCount,
    failed: failedCount,
    contactsWithOwners: withOwners,
    contactsWithoutOwners: withoutOwners
  };
}

/**
 * Helper to parse HubSpot contact timestamps
 */
function parseContactTimestamp(value: any): string | null {
  if (!value || value === '' || value === 'null' || value === '0') return null;
  
  if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.getFullYear() > 1970 ? date.toISOString() : null;
  }
  
  const timestamp = parseInt(String(value));
  if (isNaN(timestamp) || timestamp === 0) return null;
  const date = new Date(timestamp);
  return date.getFullYear() > 1970 ? date.toISOString() : null;
}
