import { Clock, Check, Trophy, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTeamStats, TeamMemberStats } from "@/hooks/useTeamStats";
import { HubSpotOwner } from "@/hooks/useUsers";
import { Task } from "@/types/task";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamLeaderboardProps {
  teamMembers: HubSpotOwner[];
  allTasks: Task[];
  onMemberClick?: (ownerId: string) => void;
  selectedOwnerId?: string;
}

const TeamMemberCard = ({ 
  stats, 
  rank, 
  isSelected, 
  onClick 
}: { 
  stats: TeamMemberStats; 
  rank: number; 
  isSelected: boolean;
  onClick: () => void;
}) => {
  const isTopPerformer = rank === 1 && stats.completedTodayCount > 0;
  const initials = `${stats.owner.firstName.charAt(0)}${stats.owner.lastName.charAt(0)}`.toUpperCase();

  return (
    <div 
      className={`relative flex flex-col items-center p-3 rounded-lg transition-all duration-300 cursor-pointer group hover:shadow-lg ${
        isSelected 
          ? 'bg-primary/10 border-2 border-primary shadow-md' 
          : 'bg-card border border-border hover:bg-accent/50'
      } ${isTopPerformer ? 'animate-pulse-slow' : ''}`}
      onClick={onClick}
    >
      {/* Trophy for top performer */}
      {isTopPerformer && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="bg-yellow-400 text-yellow-900 rounded-full p-1 shadow-lg">
            <Trophy className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Rank indicator */}
      <div className={`absolute -top-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        rank === 1 ? 'bg-yellow-400 text-yellow-900' :
        rank === 2 ? 'bg-gray-300 text-gray-700' :
        rank === 3 ? 'bg-orange-300 text-orange-800' :
        'bg-muted text-muted-foreground'
      }`}>
        {rank}
      </div>

      {/* Avatar */}
      <div className="relative mb-2">
        <Avatar className={`w-12 h-12 border-2 transition-all duration-300 ${
          isSelected ? 'border-primary' : 'border-border group-hover:border-accent-foreground'
        } ${isTopPerformer ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`}>
          <AvatarImage 
            src={stats.owner.profilePictureUrl} 
            alt={stats.owner.fullName}
            className="object-cover"
          />
          <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {/* Overdue badge (top right) */}
        <div className="absolute -top-1 -right-1">
          <Badge 
            variant="secondary" 
            className={`flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium min-w-0 ${
              stats.overdueCount > 0 
                ? 'bg-red-100 text-red-800 hover:bg-red-200 animate-pulse' 
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            <span>{stats.overdueCount}</span>
          </Badge>
        </div>

        {/* Completed today badge (bottom right) */}
        <div className="absolute -bottom-1 -right-1">
          <Badge 
            variant="secondary" 
            className={`flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium min-w-0 ${
              stats.completedTodayCount > 0 
                ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <Check className="w-2.5 h-2.5 flex-shrink-0" />
            <span>{stats.completedTodayCount}</span>
          </Badge>
        </div>
      </div>

      {/* Name */}
      <div className="text-center">
        <p className={`text-xs font-medium truncate max-w-20 ${
          isSelected ? 'text-primary' : 'text-foreground'
        }`}>
          {stats.owner.firstName}
        </p>
        <p className={`text-xs truncate max-w-20 ${
          isSelected ? 'text-primary/70' : 'text-muted-foreground'
        }`}>
          {stats.owner.lastName}
        </p>
      </div>

      {/* Performance indicator */}
      {stats.completedTodayCount > 3 && (
        <div className="absolute top-1 left-1">
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
        </div>
      )}
    </div>
  );
};

export const TeamLeaderboard = ({ 
  teamMembers, 
  allTasks, 
  onMemberClick,
  selectedOwnerId 
}: TeamLeaderboardProps) => {
  const teamStats = useTeamStats({ teamMembers, allTasks });

  if (!teamMembers.length) {
    return null;
  }

  if (!teamStats.length) {
    return (
      <div className="border-t border-border bg-card">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-foreground">Team Performance</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: Math.min(teamMembers.length, 6) }).map((_, i) => (
              <div key={i} className="flex flex-col items-center min-w-0">
                <Skeleton className="w-12 h-12 rounded-full mb-2" />
                <Skeleton className="w-16 h-3 mb-1" />
                <Skeleton className="w-12 h-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const topPerformers = teamStats.slice(0, Math.min(teamStats.length, 8));

  return (
    <div className="border-t border-border bg-gradient-to-r from-card to-accent/20 shadow-lg">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-foreground">Team Performance</h3>
          <Badge variant="outline" className="text-xs">
            {teamStats.reduce((sum, stat) => sum + stat.completedTodayCount, 0)} completed today
          </Badge>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {topPerformers.map((stats, index) => (
            <div key={stats.owner.id} className="min-w-0 flex-shrink-0">
              <TeamMemberCard
                stats={stats}
                rank={index + 1}
                isSelected={selectedOwnerId === stats.owner.id}
                onClick={() => onMemberClick?.(stats.owner.id)}
              />
            </div>
          ))}
        </div>
        
        {teamStats.length > 8 && (
          <div className="text-center mt-2">
            <Badge variant="secondary" className="text-xs">
              +{teamStats.length - 8} more team members
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};