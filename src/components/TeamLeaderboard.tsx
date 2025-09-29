import { Clock, Check, Trophy, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTeamSummary, OwnerSummary } from "@/hooks/useTeamSummary";
import { HubSpotOwner } from "@/hooks/useUsers";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { useResponsiveCardDisplay } from "@/hooks/useResponsiveCardDisplay";

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
  onBadgeClick,
  hideRankBadge
}: { 
  stats: TeamMemberStats; 
  rank: number; 
  isSelected: boolean;
  onClick: () => void;
  showCompletedBadge: boolean;
  onBadgeClick: (e: React.MouseEvent) => void;
  hideRankBadge?: boolean;
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
      {!hideRankBadge && (
        <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
          rank === 1 ? 'bg-yellow-400 text-yellow-900' :
          rank === 2 ? 'bg-gray-300 text-gray-700' :
          rank === 3 ? 'bg-orange-300 text-orange-800' :
          'bg-muted text-muted-foreground'
        }`}>
          {rank}
        </div>
      )}

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
    teamId: teamId || ''
    // Remove ownerId to prevent re-fetching when switching team members
  });

  // Auto-rotate badges every 7 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCompletedBadge(prev => !prev);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const handleBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCompletedBadge(prev => !prev);
  }, []);

  if (!teamMembers.length || !teamId) {
    return null;
  }

  // Convert summary data to team stats format first
  const teamStats: TeamMemberStats[] = summaryData?.task_summary?.owners?.map(ownerSummary => {
    const owner = teamMembers.find(m => m.id === ownerSummary.owner_id);
    if (!owner) return null;

    return {
      owner,
      completedTodayCount: ownerSummary.completed_today_count,
      overdueCount: ownerSummary.overdue_count
    };
  }).filter(Boolean) as TeamMemberStats[] || [];

  // Sort by completed today (descending), then by overdue (ascending)
  const sortedTeamStats = teamStats.sort((a, b) => {
    if (b.completedTodayCount !== a.completedTodayCount) {
      return b.completedTodayCount - a.completedTodayCount;
    }
    return a.overdueCount - b.overdueCount;
  });

  // Implement proper ranking algorithm that handles ties correctly
  const rankedPerformers = [];
  let currentRank = 1;
  let lastCompletedCount = sortedTeamStats[0]?.completedTodayCount ?? 0;
  
  for (let i = 0; i < sortedTeamStats.length; i++) {
    const currentStats = sortedTeamStats[i];
    
    // If this performer has fewer completed tasks than the last rank group
    if (i > 0 && currentStats.completedTodayCount !== lastCompletedCount) {
      // Move to next available rank (skipping ranks for ties)
      currentRank = i + 1;
      lastCompletedCount = currentStats.completedTodayCount;
    }
    
    rankedPerformers.push({ ...currentStats, rank: currentRank });
  }

  // Check if all team members have the same completedTodayCount
  const allSamePerformance = rankedPerformers.length > 1 && 
    rankedPerformers.every(p => p.completedTodayCount === rankedPerformers[0].completedTodayCount);

  const { containerRef, finalWidth, needsScrolling, actualVisibleCards } = useResponsiveCardDisplay({ 
    totalCards: rankedPerformers.length 
  });

  if (loading || !summaryData) {
    return (
      <div ref={containerRef} className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
        <div className="flex justify-center">
          <div className="rounded-t-xl border-t bg-white/30 dark:bg-gray-900/40 backdrop-blur-xl backdrop-saturate-150 backdrop-brightness-110 shadow-lg ring-1 ring-white/20 dark:ring-white/10 supports-[backdrop-filter]:bg-white/20 supports-[backdrop-filter]:dark:bg-gray-900/30 p-2 mx-4 pointer-events-auto">
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
      </div>
    );
  }

  const displayedStats = rankedPerformers.slice(0, actualVisibleCards);
  const remainingCount = Math.max(0, rankedPerformers.length - actualVisibleCards);

  return (
    <div ref={containerRef} className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="flex justify-center">
        <div 
          className="rounded-t-xl border-t bg-white/30 dark:bg-gray-900/40 backdrop-blur-xl backdrop-saturate-150 backdrop-brightness-110 shadow-lg ring-1 ring-white/20 dark:ring-white/10 supports-[backdrop-filter]:bg-white/20 supports-[backdrop-filter]:dark:bg-gray-900/30 p-2 mx-4 pointer-events-auto relative"
          style={{ width: `${finalWidth}px` }}
        >
          {needsScrolling ? (
            <Carousel className="w-full">
              <CarouselContent className="flex items-center gap-3">
                {rankedPerformers.map((stats) => (
                  <CarouselItem key={stats.owner.id} className="basis-auto">
                    <TeamMemberCard
                      stats={stats}
                      rank={stats.rank}
                      isSelected={selectedOwnerId === stats.owner.id}
                      onClick={() => onMemberClick?.(stats.owner.id)}
                      showCompletedBadge={showCompletedBadge}
                      onBadgeClick={handleBadgeClick}
                      hideRankBadge={allSamePerformance}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="absolute -left-8 top-1/2 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border border-border/50 hover:bg-white/80 dark:hover:bg-gray-900/80" />
              <CarouselNext className="absolute -right-8 top-1/2 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border border-border/50 hover:bg-white/80 dark:hover:bg-gray-900/80" />
            </Carousel>
          ) : (
            <div className={`flex gap-3 pb-1 ${rankedPerformers.length <= actualVisibleCards ? 'justify-center' : 'justify-start'}`}>
              {displayedStats.map((stats) => (
                <div key={stats.owner.id} className="min-w-0 flex-shrink-0">
                  <TeamMemberCard
                    stats={stats}
                    rank={stats.rank}
                    isSelected={selectedOwnerId === stats.owner.id}
                    onClick={() => onMemberClick?.(stats.owner.id)}
                    showCompletedBadge={showCompletedBadge}
                    onBadgeClick={handleBadgeClick}
                    hideRankBadge={allSamePerformance}
                  />
                </div>
              ))}
              
              {remainingCount > 0 && (
                <div className="flex flex-col items-center min-w-0 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-1">
                    <span className="text-xs font-medium text-muted-foreground">+{remainingCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">More</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};