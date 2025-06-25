
import { useState, useEffect } from 'react';
import { parseTaskDate, getCurrentParisTime } from '@/lib/dateUtils';

export const useOverdueCounter = (dueDate: string) => {
  const [counter, setCounter] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!dueDate) {
      setCounter('');
      setIsOverdue(false);
      return;
    }

    const updateCounter = () => {
      try {
        // Parse the due date using our fixed parseTaskDate function
        const taskDate = parseTaskDate(dueDate);
        const currentParisTime = getCurrentParisTime();
        
        const diff = currentParisTime.getTime() - taskDate.getTime();
        
        if (diff > 0) {
          // Task is overdue
          setIsOverdue(true);
          
          const totalSeconds = Math.floor(diff / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          
          const counterText = `+${hours}h ${minutes}m ${seconds}s`;
          setCounter(counterText);
        } else {
          setIsOverdue(false);
          setCounter('');
        }
      } catch (error) {
        console.error('Error in overdue counter:', error);
        setCounter('');
        setIsOverdue(false);
      }
    };

    updateCounter();
    const interval = setInterval(updateCounter, 1000);

    return () => clearInterval(interval);
  }, [dueDate]);

  return { counter, isOverdue };
};
