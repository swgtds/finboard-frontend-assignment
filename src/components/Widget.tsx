
"use client";

import { useEffect, useState, useCallback } from "react";
import get from "lodash/get";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Pencil, Trash2, RefreshCw, AreaChart, TrendingUp } from "lucide-react";
import { CardWidget } from "./widgets/CardWidget";
import { TableWidget } from "./widgets/TableWidget";
import { ChartWidget } from "./widgets/ChartWidget";
import type { WidgetConfig } from "@/lib/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { WidgetBuilderModal } from "./WidgetBuilderModal";
import { cn } from "@/lib/utils";
import { shouldCacheApi } from "@/config/apiRateLimits";

type WidgetProps = {
  widget: WidgetConfig;
};

export function Widget({ widget }: WidgetProps) {
  const [data, setData] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(widget.title);
  const [showRefreshMessage, setShowRefreshMessage] = useState(false);
  const [isAreaChart, setIsAreaChart] = useState(false);
  
  const { removeWidget, updateWidget } = useDashboardStore();

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      let proxyUrl = `/api/proxy?url=${encodeURIComponent(widget.apiUrl)}`;
      
      if (isManualRefresh && !shouldCacheApi(widget.apiUrl)) {
        proxyUrl += '&skipCache=true';
      }
      
      console.log('Fetching from proxy:', proxyUrl);
      const response = await fetch(proxyUrl);
      
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage;
        try {
          const responseText = await response.text();
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
          } catch (jsonParseError) {
            console.error('Response was not JSON:', responseText.substring(0, 200));
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        } catch (textError) {
          console.error('Failed to read response text:', textError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        // Special handling for rate limit errors
        if (response.status === 429) {
          errorMessage = errorMessage + ' The widget will automatically retry when the rate limit resets.';
        }

        throw new Error(errorMessage);
      }
      
      let jsonData;
      try {
        const responseText = await response.text();
        console.log('Response text received for widget:', widget.id, responseText.substring(0, 100));
        jsonData = JSON.parse(responseText);
        console.log('Successfully parsed JSON data for widget:', widget.id);
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        throw new Error('Invalid JSON response from API');
      }
      
      setData(jsonData);
    } catch (e: any) {
      console.error(`Failed to fetch data for widget ${widget.id}:`, e);
      
      // Handle rate limiting with automatic retry
      if (e.message && e.message.includes('3 requests per minute')) {
        setError(`${e.message} Widget will retry automatically.`);
        
        // Retry after 65 seconds (slightly longer than the rate limit window)
        setTimeout(() => {
          if (!isManualRefresh) {
            console.log(`Retrying rate-limited request for widget ${widget.id}`);
            fetchData(false);
          }
        }, 65000);
      } else {
        setError(e.message || 'Unknown error occurred');
      }
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [widget.apiUrl, widget.id]);

  useEffect(() => {
    fetchData();
    if (widget.refreshInterval > 0) {
      const interval = setInterval(() => fetchData(false), widget.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, widget.refreshInterval]);

  const handleRefreshClick = () => {
    fetchData(true);
    if (widget.refreshInterval > 0) {
      setShowRefreshMessage(true);
      setTimeout(() => setShowRefreshMessage(false), 3000);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleTitleSave = () => {
    updateWidget(widget.id, { title });
    setIsEditingTitle(false);
  };

  const renderWidgetContent = () => {
    if (!data) return null;

    try {
      let widgetData;
      
      if (widget.dataPath?.startsWith('__wrap_')) {
        if (widget.dataPath === '__wrap_object__') {
          widgetData = Array.isArray(data) ? data : [data];
        } else {
          const pathToWrap = widget.dataPath.replace('__wrap_', '');
          const objectToWrap = get(data, pathToWrap, null);
          widgetData = objectToWrap ? (Array.isArray(objectToWrap) ? objectToWrap : [objectToWrap]) : [];
        }
      } else {
        widgetData = widget.dataPath ? get(data, widget.dataPath, data) : data;
      }

      console.log('Rendering widget type:', widget.type, 'with data:', widgetData);

      switch (widget.type) {
        case "card":
          return <CardWidget data={data} config={widget} />;
        case "table":
          return <TableWidget data={widgetData} config={widget} />;
        case "chart":
          return <ChartWidget data={widgetData} config={widget} variant={isAreaChart ? "area" : "line"} />;
        default:
          console.warn('Unknown widget type:', (widget as any).type);
          return <div className="text-muted-foreground">Unknown widget type: {(widget as any).type}</div>;
      }
    } catch (renderError: any) {
      console.error('Error rendering widget content:', renderError);
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-destructive">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p className="font-semibold">Rendering Error</p>
          <p className="text-xs">{renderError.message || 'Failed to render widget'}</p>
        </div>
      );
    }
  };

  const getWidgetHeightClass = () => {
    switch (widget.type) {
      case 'card':
        return 'h-auto min-h-[140px] sm:min-h-[160px] lg:min-h-[180px] max-h-fit';
      case 'table':
        return 'h-auto min-h-[400px]';
      case 'chart':
        return 'h-auto min-h-[300px]';
      default:
        return 'h-auto min-h-[200px]';
    }
  };

  const getCardStyling = () => {
    switch (widget.type) {
      case 'card':
        return 'bg-gradient-to-br from-card to-card/95 border-2 hover:border-primary/20 transition-all duration-300 hover:shadow-lg';
      case 'table':
        return 'bg-card border hover:border-primary/20 transition-all duration-300';
      case 'chart':
        return 'bg-card border hover:border-primary/20 transition-all duration-300';
      default:
        return 'bg-card border hover:border-primary/20 transition-all duration-300';
    }
  };

  return (
    <Card className={cn("flex flex-col group", getWidgetHeightClass(), getCardStyling())}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 px-4 pt-4">
        <div className="flex-1 mr-2 space-y-1">
          <div onDoubleClick={() => setIsEditingTitle(true)}>
            {isEditingTitle ? (
              <Input
                value={title}
                onChange={handleTitleChange}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                autoFocus
                className="h-8"
              />
            ) : (
              <CardTitle className="text-base lg:text-lg font-semibold cursor-pointer leading-tight text-foreground">
                {widget.title}
              </CardTitle>
            )}
          </div>
          {widget.refreshInterval > 0 && (
            <CardDescription className={cn("text-xs transition-opacity duration-300", showRefreshMessage ? 'opacity-100' : 'opacity-0')}>
              Auto-refreshes every {widget.refreshInterval} seconds
            </CardDescription>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {widget.type === 'chart' && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={() => setIsAreaChart(!isAreaChart)}
              title={isAreaChart ? 'Switch to Line Chart' : 'Switch to Area Chart'}
            >
              {isAreaChart ? <TrendingUp className="h-4 w-4" /> : <AreaChart className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefreshClick} disabled={isRefreshing}>
             <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <WidgetBuilderModal widgetToEdit={widget}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Pencil className="h-4 w-4" />
            </Button>
          </WidgetBuilderModal>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-500 hover:bg-red-500/10"
            onClick={() => removeWidget(widget.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

      </CardHeader>
      <CardContent className="flex-1 flex flex-col px-0 pb-4">
        {isInitialLoading ? (
          <div className="flex-1 p-3 lg:p-4">
            <Skeleton className="w-full h-full min-h-[100px]" />
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center text-destructive px-4">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="font-semibold">Error loading data</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : (
          renderWidgetContent()
        )}
      </CardContent>
    </Card>
  );
}
