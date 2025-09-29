import { useState, useEffect, useRef } from 'react';

interface UseResponsiveCardDisplayProps {
  totalCards: number;
}

interface UseResponsiveCardDisplayReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  finalWidth: number;
  needsScrolling: boolean;
  actualVisibleCards: number;
  maxVisibleCards: number;
}

export const useResponsiveCardDisplay = ({ 
  totalCards 
}: UseResponsiveCardDisplayProps): UseResponsiveCardDisplayReturn => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const cardWidth = 80; // w-20 in Tailwind
  const cardGap = 12; // gap-3 in Tailwind  
  const containerPadding = 32; // p-4 on each side
  const arrowSpace = 80; // space for navigation arrows when needed

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate how many cards can fit
  const availableWidth = containerWidth - containerPadding;
  const maxVisibleCards = Math.max(1, Math.floor((availableWidth - arrowSpace) / (cardWidth + cardGap)));
  const actualVisibleCards = Math.min(totalCards, maxVisibleCards);
  const needsScrolling = totalCards > maxVisibleCards;

  // Calculate optimal width for the glass panel
  const calculatedWidth = (cardWidth + cardGap) * actualVisibleCards + containerPadding;
  const maxAllowedWidth = containerWidth * 0.9; // Keep 5% margins on each side
  const finalWidth = Math.min(calculatedWidth, maxAllowedWidth);

  return {
    containerRef,
    finalWidth,
    needsScrolling,
    actualVisibleCards,
    maxVisibleCards
  };
};