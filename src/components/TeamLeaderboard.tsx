import { Clock, Check, Trophy, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTeamSummary, OwnerSummary } from "@/hooks/useTeamSummary";
import { HubSpotOwner } from "@/hooks/useUsers";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";

interface TeamLeaderboardProps {
  teamMembers: HubSpotOwner[];
  teamId?: string;
  onMemberClick?: (ownerId: string) => void;
  selectedOwnerId?: string;
}

interface TeamMemberStats {
  owner: HubSpotOwner;
  completedTodayCount: number;
  overdueCount: number;
}

const TeamMemberCard = ({ 
  stats, 
  rank, 
  isSelected, 
  onClick,
  showCompletedBadge,
  onBadgeClick
}: { 
  stats: TeamMemberStats; 
  rank: number; 
  isSelected: boolean;
  onClick: () => void;
  showCompletedBadge: boolean;
  onBadgeClick: (e: React.MouseEvent) => void;
}) => {
  const isTopPerformer = rank === 1 && stats.completedTodayCount > 0;
  const initials = `${stats.owner.firstName.charAt(0)}${stats.owner.lastName.charAt(0)}`.toUpperCase();

  return (
    <div 
      className={`relative flex flex-col items-center p-2 rounded-lg transition-all duration-300 cursor-pointer group hover:shadow-lg w-20 ${
        isSelected 
          ? 'bg-primary/10 border-2 border-primary shadow-md' 
          : 'bg-card border border-border hover:bg-accent/50'
      } ${isTopPerformer ? 'animate-pulse-slow' : ''}`}
      onClick={onClick}
    >
      {/* Trophy for top performer */}
      {isTopPerformer && (
        <div className="absolute -top-1 -right-1 z-10">
          <div className="bg-yellow-400 text-yellow-900 rounded-full p-0.5 shadow-lg">
            <Trophy className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Rank indicator */}
      <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
        rank === 1 ? 'bg-yellow-400 text-yellow-900' :
        rank === 2 ? 'bg-gray-300 text-gray-700' :
        rank === 3 ? 'bg-orange-300 text-orange-800' :
        'bg-muted text-muted-foreground'
      }`}>
        {rank}
      </div>

      {/* Avatar */}
      <div className="relative mb-1">
        <Avatar className={`w-7 h-7 border-2 transition-all duration-300 ${
          isSelected ? 'border-primary' : 'border-border group-hover:border-accent-foreground'
        } ${isTopPerformer ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}>
          <AvatarImage 
            src={stats.owner.profilePictureUrl} 
            alt={stats.owner.fullName}
            className="object-cover"
          />
          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Name */}
      <div className="text-center mb-1">
        <p className={`text-xs font-medium truncate w-full ${
          isSelected ? 'text-primary' : 'text-foreground'
        }`}>
          {stats.owner.firstName}
        </p>
      </div>

      {/* Single rotating badge */}
      <div className="flex justify-center" onClick={onBadgeClick}>
        {showCompletedBadge ? (
          <Badge 
            variant="secondary" 
            className={`flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium min-w-0 transition-opacity duration-300 cursor-pointer ${
              stats.completedTodayCount > 0 
                ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <Check className="w-2.5 h-2.5 flex-shrink-0" />
            <span>{stats.completedTodayCount}</span>
          </Badge>
        ) : (
          <Badge 
            variant="secondary" 
            className={`flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium min-w-0 transition-opacity duration-300 cursor-pointer ${
              stats.overdueCount > 0 
                ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            <span>{stats.overdueCount}</span>
          </Badge>
        )}
      </div>

      {/* Performance indicator */}
      {stats.completedTodayCount > 3 && (
        <div className="absolute top-0.5 left-0.5">
          <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
        </div>
      )}
    </div>
  );
};

export const TeamLeaderboard = ({ 
  teamMembers, 
  teamId, 
  onMemberClick,
  selectedOwnerId 
}: TeamLeaderboardProps) => {
  const [showCompletedBadge, setShowCompletedBadge] = useState(true);
  
  const { data: summaryData, loading } = useTeamSummary({ 
    teamId: teamId || '',
    ownerId: selectedOwnerId 
  });

  const handleBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCompletedBadge(prev => !prev);
  }, []);

  if (!teamMembers.length || !teamId) {
    return null;
  }

  if (loading || !summaryData) {
    return (
      <div className="border-t border-border bg-card">
        <div className="p-2">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {Array.from({ length: Math.min(teamMembers.length, 6) }).map((_, i) => (
              <div key={i} className="flex flex-col items-center min-w-0">
                <Skeleton className="w-8 h-8 rounded-full mb-1" />
                <Skeleton className="w-16 h-3 mb-1" />
                <Skeleton className="w-12 h-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Convert summary data to team stats format
  const teamStats: TeamMemberStats[] = summaryData.task_summary.owners.map(ownerSummary => {
    const owner = teamMembers.find(m => m.id === ownerSummary.owner_id);
    if (!owner) return null;

    return {
      owner,
      completedTodayCount: ownerSummary.completed_today_count,
      overdueCount: ownerSummary.overdue_count
    };
  }).filter(Boolean) as TeamMemberStats[];

  // Sort by completed today (descending), then by overdue (ascending)
  const sortedTeamStats = teamStats.sort((a, b) => {
    if (b.completedTodayCount !== a.completedTodayCount) {
      return b.completedTodayCount - a.completedTodayCount;
    }
    return a.overdueCount - b.overdueCount;
  });

  // Calculate proper ranks with ties
  const topPerformers = sortedTeamStats.slice(0, Math.min(sortedTeamStats.length, 8));
  
  // Implement proper ranking algorithm that handles ties correctly
  // Rank based ONLY on completedTodayCount (overdueCount is just for visual sorting)
  const rankedPerformers = [];
  let currentRank = 1;
  let lastCompletedCount = topPerformers[0]?.completedTodayCount ?? 0;
  
  for (let i = 0; i < topPerformers.length; i++) {
    const currentStats = topPerformers[i];
    
    // If this performer has fewer completed tasks than the last rank group
    if (i > 0 && currentStats.completedTodayCount !== lastCompletedCount) {
      // Move to next available rank (skipping ranks for ties)
      currentRank = i + 1;
      lastCompletedCount = currentStats.completedTodayCount;
    }
    
    rankedPerformers.push({ ...currentStats, rank: currentRank });
  }

  return (
    <div className="border-t border-border bg-gradient-to-r from-card to-accent/20 shadow-lg">
      <div className="p-2">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {rankedPerformers.map((stats) => (
            <div key={stats.owner.id} className="min-w-0 flex-shrink-0">
              <TeamMemberCard
                stats={stats}
                rank={stats.rank}
                isSelected={selectedOwnerId === stats.owner.id}
                onClick={() => onMemberClick?.(stats.owner.id)}
                showCompletedBadge={showCompletedBadge}
                onBadgeClick={handleBadgeClick}
              />
            </div>
          ))}
        </div>
        
        {sortedTeamStats.length > 8 && (
          <div className="text-center mt-1">
            <Badge variant="secondary" className="text-xs">
              +{sortedTeamStats.length - 8} more team members
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};