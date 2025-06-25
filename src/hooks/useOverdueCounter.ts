
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
        // Parse the task date (already in Paris time format)
        const taskDueDate = parseTaskDate(dueDate);
        const currentParisTime = getCurrentParisTime();
        
        console.log(`Task due: ${dueDate}`);
        console.log(`Parsed due date (Paris): ${taskDueDate.toLocaleString("fr-FR")}`);
        console.log(`Current time (Paris): ${currentParisTime.toLocaleString("fr-FR")}`);
        
        const diff = currentParisTime.getTime() - taskDueDate.getTime();
        console.log(`Diff (ms): ${diff}`);
        
        if (diff > 0) {
          // Task is overdue
          setIsOverdue(true);
          
          const totalSeconds = Math.floor(diff / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          
          const counterText = `+${hours}h ${minutes}m ${seconds}s`;
          console.log(`Counter: ${counterText}`);
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
