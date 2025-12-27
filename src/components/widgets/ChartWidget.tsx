"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { Line } from "react-chartjs-2";
import get from "lodash/get";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TooltipItem,
  Chart,
} from "chart.js";
import type { ChartWidgetConfig, WidgetConfig } from "@/lib/types";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type ChartWidgetProps = {
  data: any[] | any;
  config: WidgetConfig & ChartWidgetConfig;
  variant?: "line" | "area";
  showPoints?: boolean;
  tension?: number;
  animate?: boolean;
};

type FormattedDataPoint = {
  category: string;
  value: number;
  timestamp?: number;
};

type ChartColors = {
  grid: string;
  ticks: string;
  tooltipBg: string;
  tooltipBorder: string;
  line: string;
  lineSecondary: string;
  fill: string;
  pointHover: string;
};

const CHART_COLORS = {
  light: {
    primary: "rgb(75, 192, 192)",
    secondary: "rgb(255, 99, 132)", 
    success: "rgb(54, 162, 235)",
    grid: "rgba(0, 0, 0, 0.1)",
    ticks: "hsl(221 39% 16%)",
    tooltipBg: "hsl(210 17% 100%)",
    tooltipBorder: "hsl(210 10% 85%)",
  },
  dark: {
    primary: "rgb(41, 187, 114)",
    secondary: "rgb(239, 68, 68)",
    success: "rgb(59, 130, 246)",
    grid: "rgba(255, 255, 255, 0.1)",
    ticks: "hsl(210 17% 95%)",
    tooltipBg: "hsl(221 28% 18%)",
    tooltipBorder: "hsl(221 20% 24%)",
  },
} as const;

const ANIMATION_CONFIG = {
  loading: {
    duration: 750,
    easing: "easeInOutQuart" as const,
  },
  update: {
    duration: 400,
    easing: "easeOutCubic" as const,
  },
  hover: {
    duration: 200,
    easing: "easeOutQuad" as const,
  },
} as const;

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]) as T;
}

export function ChartWidget({ 
  data: rawData, 
  config, 
  variant = "line",
  showPoints,
  tension = 0.3,
  animate = true 
}: ChartWidgetProps) {
  const { theme, resolvedTheme } = useTheme();
  const chartRef = useRef<Chart<"line"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });

  const currentTheme = resolvedTheme || theme || 'light';

  const handleResize = useDebounce(() => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      setChartDimensions({ width: offsetWidth, height: offsetHeight });
      
      if (chartRef.current) {
        chartRef.current.resize();
      }
    }
  }, 150);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  const formattedData: FormattedDataPoint[] = useMemo(() => {
    if (!Array.isArray(rawData) && typeof rawData === 'object' && rawData !== null) {
 
      if ('Global Quote' in rawData) {
        const quote = rawData['Global Quote'];

        if (config.categoryKey && config.valueKey) {
          let categoryValue = get(rawData, config.categoryKey);
          let value = get(rawData, config.valueKey);
          
          if (categoryValue === undefined || value === undefined) {
            const extractLastKey = (path: string): string | null => {
              const matches = path.match(/\["([^"]+)"\]/g);
              if (matches && matches.length > 0) {
                const lastMatch = matches[matches.length - 1];
                return lastMatch.slice(2, -2); 
              }
              return null;
            };
            
            const catKey = extractLastKey(config.categoryKey);
            const valKey = extractLastKey(config.valueKey);
            
            if (catKey && quote[catKey] !== undefined) {
              categoryValue = quote[catKey];
            }
            if (valKey && quote[valKey] !== undefined) {
              value = quote[valKey];
            }
          }
          
          if (categoryValue !== undefined && value !== undefined) {
            return [{
              category: String(categoryValue),
              value: Number(String(value).replace(/[^0-9.-]/g, '')) || 0
            }];
          }
        }
        return [{
          category: quote['07. latest trading day'] || new Date().toLocaleDateString(),
          value: Number(quote['05. price']) || 0,
          timestamp: quote['07. latest trading day'] ? new Date(quote['07. latest trading day']).getTime() : undefined
        }];
      }
      
      if (config.categoryKey && config.valueKey) {
        const categoryValue = get(rawData, config.categoryKey);
        const value = get(rawData, config.valueKey);
        
        if (categoryValue !== undefined && value !== undefined) {
          return [{
            category: String(categoryValue),
            value: Number(String(value).replace(/[^0-9.-]/g, '')) || 0
          }];
        }
      }
      
      return [];
    }

    if (!Array.isArray(rawData)) return [];
    
    const processData = () => {
      if (rawData.length > 0 && Array.isArray(rawData[0])) {
        return rawData.map((item, index) => {
          if (Array.isArray(item) && item.length >= 2) {
            let category: string;
            let value: number;
            let timestamp: number | undefined;
            
            if (config.categoryKey && config.valueKey) {
              const categoryIndex = parseInt(config.categoryKey.replace(/[\[\]]/g, ''));
              const valueIndex = parseInt(config.valueKey.replace(/[\[\]]/g, ''));
              
              const categoryValue = item[categoryIndex];
              const valueValue = item[valueIndex];
              
              if (typeof categoryValue === 'number' && categoryValue > 1000000000) {
                timestamp = categoryValue;
                const date = new Date(categoryValue);
                category = date.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                });
              } else {
                category = String(categoryValue);
              }
              
              value = Number(valueValue) || 0;
            } else {
              const timestampValue = item[0];
              value = Number(item[1]) || 0;
              
              if (typeof timestampValue === 'number' && timestampValue > 1000000000) {
                timestamp = timestampValue;
                const date = new Date(timestampValue);
                category = date.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                });
              } else {
                category = String(timestampValue);
              }
            }
            
            return { category, value, timestamp };
          }
          return { category: `Point ${index + 1}`, value: 0 };
        });
      }
      
      return rawData.map((item) => ({
        category: item[config.categoryKey]?.toString() || "N/A",
        value: Number(item[config.valueKey]) || 0,
      })).slice(0, 50); 
    };

    const processed = processData();

    if (processed.length > 180) {
      const step = Math.ceil(processed.length / 120);
      return processed.filter((_, index) => index % step === 0);
    }
    
    return processed;
  }, [rawData, config.categoryKey, config.valueKey]);

  const chartColors: ChartColors = useMemo(() => {
    const colors = CHART_COLORS[currentTheme as keyof typeof CHART_COLORS] || CHART_COLORS.light;
    
    return {
      grid: colors.grid,
      ticks: colors.ticks,
      tooltipBg: colors.tooltipBg,
      tooltipBorder: colors.tooltipBorder,
      line: colors.primary,
      lineSecondary: colors.secondary,
      fill: colors.primary.replace('rgb(', 'rgba(').replace(')', ', 0.1)'),
      pointHover: colors.primary.replace('rgb(', 'rgba(').replace(')', ', 0.8)'),
    };
  }, [currentTheme]);

  const shouldShowPoints = useMemo(() => {
    if (showPoints !== undefined) return showPoints;
    return formattedData.length <= 180;
  }, [showPoints, formattedData.length]);

  const pointRadius = useMemo(() => {
    if (!shouldShowPoints) return 0;
    const baseRadius = chartDimensions.width < 768 ? 2 : 3;
    return Math.max(1, Math.min(4, baseRadius));
  }, [shouldShowPoints, chartDimensions.width]);

  const chartOptions = useMemo(() => {
    const isMobile = chartDimensions.width < 768;
    
    const options: any = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      animation: animate ? {
        duration: ANIMATION_CONFIG.loading.duration,
        easing: ANIMATION_CONFIG.loading.easing,
      } : false,
      transitions: {
        active: {
          animation: {
            duration: ANIMATION_CONFIG.hover.duration,
          }
        },
        resize: {
          animation: {
            duration: ANIMATION_CONFIG.update.duration,
          }
        }
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.ticks,
          bodyColor: chartColors.ticks,
          borderColor: chartColors.tooltipBorder,
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false,
          animation: {
            duration: ANIMATION_CONFIG.hover.duration,
          },
          callbacks: {
            title: (context: TooltipItem<'line'>[]) => {
              const dataIndex = context[0]?.dataIndex;
              const dataPoint = formattedData[dataIndex];
              
              if (dataPoint?.timestamp) {
                const date = new Date(dataPoint.timestamp);
                return date.toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                });
              }
              return context[0]?.label || '';
            },
            label: (context: TooltipItem<'line'>) => {
              const value = context.parsed.y;
              if (value === null || value === undefined) return 'No data';
              const formattedValue = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(value);
              return `${config.title || 'Value'}: ${formattedValue}`;
            }
          }
        },
      },
      scales: {
        x: {
          ticks: {
            color: chartColors.ticks,
            font: { 
              size: isMobile ? 9 : 11,
              family: 'Inter, sans-serif',
            },
            maxRotation: isMobile ? 45 : 30,
            maxTicksLimit: isMobile ? 6 : 12,
          },
          grid: {
            color: chartColors.grid,
            lineWidth: 0.5,
          },
          border: {
            display: false,
          },
        },
        y: {
          ticks: {
            color: chartColors.ticks,
            font: { 
              size: isMobile ? 9 : 11,
              family: 'Inter, sans-serif',
            },
            callback: function(value: any) {
              const num = Number(value);
              if (num >= 1000000000) {
                return (num / 1000000000).toFixed(1) + 'B';
              } else if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
              } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
              }
              return num.toLocaleString();
            }
          },
          grid: {
            color: chartColors.grid,
            lineWidth: 0.5,
          },
          border: {
            display: false,
          },
        },
      },
      elements: {
        line: {
          borderWidth: isMobile ? 1.5 : 2,
          tension: tension,
        },
        point: {
          radius: pointRadius,
          hoverRadius: pointRadius + 2,
          borderWidth: 1,
          hoverBorderWidth: 2,
        },
      },
    };

    return options;
  }, [
    chartColors, 
    formattedData, 
    config.title, 
    animate, 
    tension, 
    pointRadius, 
    chartDimensions.width
  ]);

  // Helper function to extract a friendly label from bracket notation paths
  const getFriendlyLabel = (path: string): string => {
    if (!path) return 'Value';
    
    // Extract the last key from bracket notation like ["Global Quote"]["02. open"]
    const matches = path.match(/\["([^"]+)"\]/g);
    if (matches && matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const key = lastMatch.slice(2, -2); // Remove [" and "]
      // Extract the label part after the number prefix (e.g., "02. open" -> "Open")
      const labelMatch = key.match(/^\d+\.\s*(.+)$/);
      if (labelMatch) {
        // Capitalize first letter
        const label = labelMatch[1];
        return label.charAt(0).toUpperCase() + label.slice(1);
      }
      return key;
    }
    
    // For dot notation, get the last part
    const parts = path.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  };

  // Chart data with gradient fills and animations
  const chartData = useMemo(() => {
    return {
      labels: formattedData.map((d) => d.category),
      datasets: [
        {
          label: config.title || getFriendlyLabel(config.valueKey),
          data: formattedData.map((d) => d.value),
          borderColor: chartColors.line,
          backgroundColor: variant === "area" ? chartColors.fill : 'transparent',
          fill: variant === "area",
          tension: tension,
          pointBackgroundColor: chartColors.line,
          pointBorderColor: chartColors.line,
          pointHoverBackgroundColor: chartColors.pointHover,
          pointHoverBorderColor: chartColors.line,
          borderCapStyle: 'round' as const,
          borderJoinStyle: 'round' as const,
        },
      ],
    };
  }, [formattedData, config.valueKey, config.title, chartColors, variant, tension]);

  if (!formattedData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 mx-auto rounded-full bg-muted animate-pulse" />
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col select-text">
      <div 
        ref={containerRef}
        className={cn(
          "w-full h-full relative transition-all duration-300 ease-out",
          "chart-container select-text"
        )}
        style={{
          '--chart-transition': '300ms',
        } as React.CSSProperties}
      >
        <Line 
          ref={chartRef}
          options={chartOptions} 
          data={chartData}
          aria-label={`${config.title || 'Financial'} chart showing ${formattedData.length} data points`}
          role="img"
        />
      </div>

      <div className="sr-only">
        Chart displaying {formattedData.length} data points. 
        Latest value: {formattedData[formattedData.length - 1]?.value.toLocaleString()}.
        Use arrow keys to navigate chart data when focused.
      </div>
    </div>
  );
}
