import { useState } from 'react';
import { ChevronDown, Users, Camera } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { HubSpotOwner } from '@/hooks/useUsers';

interface TeamCardProps {
  teamName: string;
  owners: HubSpotOwner[];
  onProfileClick: (userId: string, userName: string, imageUrl?: string) => void;
}

export const TeamCard = ({ teamName, owners, onProfileClick }: TeamCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{teamName}</CardTitle>
                  <CardDescription>
                    {owners.length} utilisateur{owners.length > 1 ? 's' : ''}
                  </CardDescription>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {owners.map((owner) => (
                <div 
                  key={owner.id} 
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto"
                    onClick={() => onProfileClick(
                      owner.id, 
                      owner.fullName,
                      owner.profilePictureUrl || undefined
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
                          <Camera className="w-4 h-4" />
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
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};