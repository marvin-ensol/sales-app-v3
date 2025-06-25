
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
      try {
        // Parse the due date (format: "13/06 à 15:00")
        const [datePart, timePart] = dueDate.split(' à ');
        if (!datePart || !timePart) {
          console.log('Invalid date format:', dueDate);
          setCounter('');
          setIsOverdue(false);
          return;
        }

        const [day, month] = datePart.split('/');
        const [hours, minutes] = timePart.split(':');
        
        // Validate date components
        if (!day || !month || !hours || !minutes) {
          console.log('Missing date components:', { day, month, hours, minutes });
          setCounter('');
          setIsOverdue(false);
          return;
        }

        const currentYear = new Date().getFullYear();
        
        // Create due date in Paris timezone using the Intl API for proper timezone handling
        const dueDateParis = new Date();
        dueDateParis.setFullYear(currentYear, parseInt(month) - 1, parseInt(day));
        dueDateParis.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Check if the date is valid
        if (isNaN(dueDateParis.getTime())) {
          console.log('Invalid date created for:', dueDate);
          setCounter('');
          setIsOverdue(false);
          return;
        }
        
        // Get current time in Paris timezone using Intl API
        const nowUTC = new Date();
        const nowParis = new Date(nowUTC.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
        
        // Check if current time is valid
        if (isNaN(nowParis.getTime())) {
          console.log('Invalid current time created');
          setCounter('');
          setIsOverdue(false);
          return;
        }
        
        const diff = nowParis.getTime() - dueDateParis.getTime();
        
        // Debug logging
        console.log(`Task due: ${dueDate}`);
        console.log(`Parsed Paris date: ${dueDateParis.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`);
        console.log(`Current Paris time: ${nowParis.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`);
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
