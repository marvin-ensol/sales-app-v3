import { useState, useEffect, useMemo } from 'react';
import { Task } from '@/types/task';
import { HubSpotOwner } from '@/hooks/useUsers';
import { computeOwnerStats } from '@/lib/taskMetrics';

export interface TeamMemberStats {
  owner: HubSpotOwner;
  overdueCount: number;
  completedTodayCount: number;
}

interface UseTeamStatsProps {
  teamMembers: HubSpotOwner[];
  allTasks: Task[];
}

export const useTeamStats = ({ teamMembers, allTasks }: UseTeamStatsProps) => {
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);

  const calculateStats = useMemo(() => {
    if (!teamMembers.length || !allTasks.length) {
      return [];
    }

    const now = new Date();
    
    const stats = teamMembers.map((owner, index) => {
      // Use both ID and name for robust matching
      const { overdueCount, completedTodayCount } = computeOwnerStats(
        allTasks, 
        { id: owner.id, fullName: owner.fullName || '' }, 
        now
      );
      
      // Debug log for first 3 team members to validate counts
      if (index < 3) {
        console.log(`🔍 Team stats for ${owner.fullName} (ID: ${owner.id}):`, {
          overdueCount,
          completedTodayCount,
          totalTasksForOwner: allTasks.filter(t => 
            (t.hubspotOwnerId && owner.id && t.hubspotOwnerId === owner.id) || 
            t.owner === owner.fullName
          ).length
        });
      }

      return {
        owner,
        overdueCount,
        completedTodayCount,
      };
    });
    
    return stats;
  }, [teamMembers, allTasks]);

  useEffect(() => {
    setTeamStats(calculateStats);
  }, [calculateStats]);

  // Sort by completed today (descending), then by overdue (ascending)
  const sortedTeamStats = useMemo(() => {
    return [...teamStats].sort((a, b) => {
      if (b.completedTodayCount !== a.completedTodayCount) {
        return b.completedTodayCount - a.completedTodayCount;
      }
      return a.overdueCount - b.overdueCount;
    });
  }, [teamStats]);

  return sortedTeamStats;
};