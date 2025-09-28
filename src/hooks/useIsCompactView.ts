import { useState, useEffect, useRef } from 'react';

interface UseIsCompactViewReturn {
  isCompact: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function useIsCompactView(threshold = 750): UseIsCompactViewReturn {
  const [isCompact, setIsCompact] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        setIsCompact(width < threshold);
      }
    });

    observer.observe(container);

    // Initial check
    const width = container.getBoundingClientRect().width;
    setIsCompact(width < threshold);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return { isCompact, containerRef };
}