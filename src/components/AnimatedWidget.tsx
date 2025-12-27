"use client";

import { useEffect, useState } from "react";

interface AnimatedWidgetProps {
  children: React.ReactNode;
  delay?: number;
}

export function AnimatedWidget({ children, delay = 0 }: AnimatedWidgetProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        isVisible
          ? "opacity-100 scale-100 translate-y-0"
          : "opacity-0 scale-95 translate-y-2"
      }`}
    >
      {children}
    </div>
  );
}