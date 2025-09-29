
import { useState, useEffect } from 'react';

export const useOverdueCounter = (hsTimestamp: Date | null) => {
  const [counter, setCounter] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!hsTimestamp) {
      setCounter('');
      setIsOverdue(false);
      return;
    }

    const updateCounter = () => {
      try {
        const currentTime = new Date();
        const diff = currentTime.getTime() - hsTimestamp.getTime();
        
        if (diff > 0) {
          // Task is overdue
          setIsOverdue(true);
          
          const totalSeconds = Math.floor(diff / 1000);
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          
          // Format based on duration
          let counterText;
          if (days > 0) {
            // Over 24 hours: show days and hours only
            counterText = `+${days}d ${hours}h`;
          } else {
            // Under 24 hours: show hours, minutes, seconds
            counterText = `+${hours}h ${minutes}m ${seconds}s`;
          }
          
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
  }, [hsTimestamp]);

  return { counter, isOverdue };
};
