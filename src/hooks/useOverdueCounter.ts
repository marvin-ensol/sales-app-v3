
import { useState, useEffect } from 'react';

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
      // Parse the due date (format: "13/06 à 15:00")
      const [datePart, timePart] = dueDate.split(' à ');
      if (!datePart || !timePart) {
        setCounter('');
        setIsOverdue(false);
        return;
      }

      const [day, month] = datePart.split('/');
      const [hours, minutes] = timePart.split(':');
      
      // Assume current year for simplicity
      const currentYear = new Date().getFullYear();
      const dueDateObj = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
      
      const now = new Date();
      const diff = now.getTime() - dueDateObj.getTime();
      
      if (diff > 0) {
        // Task is overdue
        setIsOverdue(true);
        
        const totalSeconds = Math.floor(diff / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        setCounter(`+${hours}h ${minutes}m ${seconds}s`);
      } else {
        setIsOverdue(false);
        setCounter('');
      }
    };

    updateCounter();
    const interval = setInterval(updateCounter, 1000);

    return () => clearInterval(interval);
  }, [dueDate]);

  return { counter, isOverdue };
};
