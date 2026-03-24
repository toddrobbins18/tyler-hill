import { useEffect, useState } from 'react';

export const useCountAnimation = (end: number, duration: number = 500) => {
  const [count, setCount] = useState(end);

  useEffect(() => {
    let startTime: number | null = null;
    const startCount = count;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      const easeOutQuad = (t: number) => t * (2 - t);
      const currentCount = startCount + (end - startCount) * easeOutQuad(progress);
      
      setCount(currentCount);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    
    requestAnimationFrame(animate);
  }, [end, duration]);

  return count;
};
