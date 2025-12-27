
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
import { AlertCircle, Pencil, Trash2, RefreshCw, GripVertical } from "lucide-react";
import { CardWidget } from "./widgets/CardWidget";
import { TableWidget } from "./widgets/TableWidget";
import { ChartWidget } from "./widgets/ChartWidget";
import type { WidgetConfig } from "@/lib/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { Button } from "./ui/button";
import { toast } from "@/hooks/use-toast";
import { Input } from "./ui/input";
import { WidgetBuilderModal } from "./WidgetBuilderModal";
import { cn } from "@/lib/utils";
import { shouldCacheApi, getRateLimitConfig } from "@/config/apiRateLimits";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

type WidgetProps = {
  widget: WidgetConfig;
  dragHandleProps?: SyntheticListenerMap;
};

export function Widget({ widget, dragHandleProps }: WidgetProps) {
  const [data, setData] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(widget.title);
  const [showRefreshMessage, setShowRefreshMessage] = useState(false);
  const [hasAuthError, setHasAuthError] = useState(false); // Track auth errors to prevent retrying
  
  const { removeWidget, updateWidget } = useDashboardStore();

  const fetchData = useCallback(async (isManualRefresh = false) => {
    // Don't retry if we have an authentication error
    if (hasAuthError && !isManualRefresh) {
      console.log(`Skipping automatic retry for widget ${widget.id} due to auth error`);
      return;
    }

    if (isManualRefresh) {
      setIsRefreshing(true);
      setHasAuthError(false); // Reset auth error flag on manual refresh
    }
    setError(null);
    try {
      let proxyUrl = `/api/proxy?url=${encodeURIComponent(widget.apiUrl)}`;
      
      // Add API key if provided
      if (widget.apiKey) {
        proxyUrl += `&apiKey=${encodeURIComponent(widget.apiKey)}`;
      }
      
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

        // Handle authentication errors specifically for Indian API first
        if (widget.apiUrl.includes('indianapi.in') && 
            (response.status === 401 || response.status === 403 || 
             (response.status === 400 && errorMessage.toLowerCase().includes('api key')) ||
             (response.status === 429 && (errorMessage.toLowerCase().includes('unauthorized') || 
                                         errorMessage.toLowerCase().includes('invalid') || 
                                         errorMessage.toLowerCase().includes('api key'))))) {
          const authErrorMessage = "Invalid API key for Indian Stock Market API. Please check your API key and try again.";
          setHasAuthError(true); // Set flag to prevent retrying
          toast({
            title: "Authentication Error",
            description: "Invalid API key for Indian Stock Market API. Please edit this widget to update your API key.",
            variant: "destructive",
          });
          setError(authErrorMessage);
          return;
        }

        if (response.status === 429) {
          const rateLimitConfig = getRateLimitConfig(widget.apiUrl);
          let toastTitle = "API Rate Limit Reached";
          let toastDescription = "Rate limit exceeded. This widget will automatically retry when the rate limit resets.";
          
          if (rateLimitConfig) {
            toastTitle = `${rateLimitConfig.description.split(':')[0]} Rate Limit`;
            toastDescription = `${rateLimitConfig.description}. This widget will automatically retry when the rate limit resets.`;
          }
          
          const rateLimitMessage = `${errorMessage} The widget will automatically retry when the rate limit resets.`;
          
          toast({
            title: toastTitle,
            description: toastDescription,
            variant: "default",
          });
          setError(rateLimitMessage);
          setTimeout(() => {
            console.log(`Retrying rate-limited request for widget ${widget.id}`);
            fetchData(false);
          }, 65000);
          
          return; 
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
      setHasAuthError(false); // Reset auth error flag on successful fetch
    } catch (e: any) {
      console.error(`Failed to fetch data for widget ${widget.id}:`, e);
      setError(e.message || 'Unknown error occurred');
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [widget.apiUrl, widget.apiKey, widget.id, hasAuthError]);

  useEffect(() => {
    setHasAuthError(false); // Reset auth error when widget changes
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
          return <ChartWidget data={widgetData} config={widget} variant="area" />;
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
        return 'bg-gradient-to-br from-card to-card/95 border-2 hover:border-primary/30 transition-all duration-300 hover:bg-gradient-to-br hover:from-card/90 hover:to-card/80';
      case 'table':
        return 'bg-card border hover:border-primary/30 transition-all duration-300 hover:bg-card/95';
      case 'chart':
        return 'bg-card border hover:border-primary/30 transition-all duration-300 hover:bg-card/95';
      default:
        return 'bg-card border hover:border-primary/30 transition-all duration-300 hover:bg-card/95';
    }
  };

  return (
    <Card 
      className={cn("flex flex-col group relative", getWidgetHeightClass(), getCardStyling())}
      data-widget-type={widget.type}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 px-4 pt-4">
        <div className="flex items-start space-x-2 flex-1 mr-2">
          <div 
            {...(dragHandleProps || {})}
            className="flex items-center justify-center w-5 h-5 mt-1 opacity-40 group-hover:opacity-70 transition-opacity duration-200 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-1 select-text">
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
                <CardTitle className="text-base lg:text-lg font-semibold cursor-pointer leading-tight text-foreground select-text">
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
        </div>
        
        <div className="flex items-center space-x-1 relative z-10 widget-header-buttons">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 hover:bg-accent hover:text-accent-foreground" 
            onClick={handleRefreshClick} 
            disabled={isRefreshing}
            onMouseEnter={(e) => e.stopPropagation()}
          >
             <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <WidgetBuilderModal widgetToEdit={widget}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 hover:bg-accent hover:text-accent-foreground"
              onMouseEnter={(e) => e.stopPropagation()}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </WidgetBuilderModal>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-500 hover:bg-red-500/10"
            onClick={() => removeWidget(widget.id)}
            onMouseEnter={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

      </CardHeader>
      <CardContent className="flex-1 flex flex-col px-0 pb-4 select-text">
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
          <div className="select-text">
            {renderWidgetContent()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
