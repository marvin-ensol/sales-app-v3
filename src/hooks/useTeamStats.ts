import { useState, useEffect, useMemo } from 'react';
import { Task } from '@/types/task';
import { HubSpotOwner } from '@/hooks/useUsers';
import { getCurrentParisTime } from '@/lib/dateUtils';

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

    const currentTime = getCurrentParisTime();
    const todayStart = new Date(currentTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(currentTime);
    todayEnd.setHours(23, 59, 59, 999);

    return teamMembers.map(owner => {
      // Filter tasks for this owner
      const ownerTasks = allTasks.filter(task => task.owner === owner.fullName);

      // Calculate overdue tasks (not completed and past due date)
      const overdueCount = ownerTasks.filter(task => {
        if (task.status === 'completed') return false;
        if (!task.hsTimestamp) return false;
        return task.hsTimestamp < currentTime;
      }).length;

      // Calculate tasks completed today
      const completedTodayCount = ownerTasks.filter(task => {
        if (task.status !== 'completed' || !task.completionDate) return false;
        const completionTime = new Date(task.completionDate);
        return completionTime >= todayStart && completionTime <= todayEnd;
      }).length;

      return {
        owner,
        overdueCount,
        completedTodayCount,
      };
    });
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