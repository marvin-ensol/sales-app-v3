
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
      
      // Create due date in Paris timezone
      const currentYear = new Date().getFullYear();
      
      // First create the date in Paris timezone
      const parisDateString = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
      const dueDateParis = new Date(parisDateString);
      
      // Get current time in Paris timezone
      const nowUTC = new Date();
      const nowParisString = nowUTC.toLocaleString("en-CA", { timeZone: "Europe/Paris" });
      const nowParis = new Date(nowParisString);
      
      const diff = nowParis.getTime() - dueDateParis.getTime();
      
      // Debug logging
      console.log(`Task due: ${dueDate}`);
      console.log(`Parsed Paris date: ${dueDateParis.toISOString()}`);
      console.log(`Current Paris time: ${nowParis.toISOString()}`);
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
    };

    updateCounter();
    const interval = setInterval(updateCounter, 1000);

    return () => clearInterval(interval);
  }, [dueDate]);

  return { counter, isOverdue };
};
