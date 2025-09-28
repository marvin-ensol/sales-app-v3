import { useState } from 'react';
import { ChevronDown, Users, RefreshCw } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUsers } from '@/hooks/useUsers';
import { UserProfileModal } from './UserProfileModal';
import { TeamCard } from './TeamCard';
import { groupOwnersByTeam } from '@/utils/ownerGrouping';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const UsersTeamsSection = () => {
  const { owners, loading, refetch } = useUsers();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
    imageUrl?: string;
  } | null>(null);

  const groupedOwners = groupOwnersByTeam(owners);

  const handleImageUpdated = (newImageUrl: string) => {
    refetch(); // Refresh the users list to show updated image
  };

  const openProfileModal = (userId: string, userName: string, imageUrl?: string) => {
    setSelectedUser({ id: userId, name: userName, imageUrl });
  };

  const handleRefreshUsersTeams = async () => {
    setIsRefreshing(true);
    
    try {
      const response = await supabase.functions.invoke('sync-hubspot-owners', {
        body: { manual_sync: true }
      });

      if (response.error) {
        throw new Error(`Function error: ${response.error.message}`);
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Unknown error occurred');
      }

      toast({
        title: "Synchronisation réussie",
        description: `${response.data.stats?.users_processed || 0} utilisateurs et ${response.data.stats?.teams_fetched || 0} équipes synchronisés`,
      });
      
      refetch(); // Refresh the local data
    } catch (error: any) {
      console.error('Users sync error:', error);
      toast({
        title: "Erreur de synchronisation",
        description: error.message || 'Une erreur inconnue s\'est produite',
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs & équipes</CardTitle>
          <CardDescription>
            Vérifier la composition des équipes et modifier les photos de profil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle>Utilisateurs & équipes</CardTitle>
                    <CardDescription>
                      Vérifier la composition des équipes et modifier les photos de profil
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-3">
                {groupedOwners.map((group) => (
                  <TeamCard
                    key={group.teamName}
                    teamName={group.teamName}
                    owners={group.owners}
                    onProfileClick={openProfileModal}
                  />
                ))}
              </div>
              
              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshUsersTeams}
                  disabled={isRefreshing}
                  className="text-muted-foreground hover:text-primary"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Actualisation en cours...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Actualiser les utilisateurs & équipes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {selectedUser && (
        <UserProfileModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          userId={selectedUser.id}
          userName={selectedUser.name}
          currentImageUrl={selectedUser.imageUrl}
          onImageUpdated={handleImageUpdated}
        />
      )}
    </>
  );
};