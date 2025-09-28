import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useUsers } from '@/hooks/useUsers';
import { useTeams } from '@/hooks/useTeams';
import { UserProfileModal } from './UserProfileModal';
import { groupOwnersByTeam } from '@/utils/ownerGrouping';

export const UsersTeamsSection = () => {
  const { owners, loading, refetch } = useUsers();
  const [isOpen, setIsOpen] = useState(false);
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
                <div>
                  <CardTitle>Utilisateurs & équipes</CardTitle>
                  <CardDescription>
                    Vérifier la composition des équipes et modifier les photos de profil
                  </CardDescription>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-6">
                {groupedOwners.map((group) => (
                  <div key={group.teamName} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm text-muted-foreground">
                        {group.teamName}
                      </h4>
                      <div className="h-px bg-border flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {group.owners.length} utilisateur{group.owners.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {group.owners.map((owner) => (
                        <div 
                          key={owner.id} 
                          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={() => openProfileModal(
                              owner.id, 
                              owner.fullName,
                              owner.profilePictureUrl
                            )}
                          >
                            <Avatar className="w-8 h-8">
                              {owner.profilePictureUrl ? (
                                <AvatarImage 
                                  src={owner.profilePictureUrl} 
                                  alt={owner.fullName} 
                                />
                              ) : (
                                <AvatarFallback className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                  <Plus className="w-4 h-4" />
                                </AvatarFallback>
                              )}
                            </Avatar>
                          </Button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {owner.fullName}
                            </div>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            {owner.email}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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