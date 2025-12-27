"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IndianApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApiKeySubmit: (apiKey: string) => void;
  templateName: string;
}

export function IndianApiKeyDialog({ 
  open, 
  onOpenChange, 
  onApiKeySubmit, 
  templateName 
}: IndianApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Indian Stock Market API key to continue.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate the API key 
    try {
      const testUrl = "https://stock.indianapi.in/fetch_52_week_high_low_data";
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(testUrl)}&apiKey=${encodeURIComponent(apiKey.trim())}`;
      
      toast({
        title: "Validating API Key",
        description: "Please wait while we validate your API key...",
      });
      
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        let errorMessage = "Invalid API key. Please check your API key and try again.";
        
        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}));
          const responseError = errorData.error || "";
          
          // Check if 429 is actually an auth error disguised as rate limit
          if (responseError.toLowerCase().includes('unauthorized') || 
              responseError.toLowerCase().includes('invalid') || 
              responseError.toLowerCase().includes('api key')) {
            errorMessage = "Invalid API key. Please check your API key and try again.";
          } else {
            errorMessage = "Indian API rate limit exceeded. Please try again later.";
          }
        }
        
        toast({
          title: "API Key Validation Failed",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }
      
      // If we get here, the API key is valid
      toast({
        title: "API Key Valid",
        description: "API key validated successfully. Creating widget...",
      });
      
      onApiKeySubmit(apiKey.trim());
      setApiKey("");
      onOpenChange(false);
      
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Failed to validate API key. Please check your internet connection and try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setApiKey("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            API Key Required
          </DialogTitle>
          <DialogDescription>
            The <span className="font-semibold">{templateName}</span> widget requires an API key 
            from the Indian Stock Market API service.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
            <ExternalLink className="w-3 h-3" />
            <a 
              href="https://indianapi.in/indian-stock-market" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Get your API key from indianapi.in
            </a>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="apiKey">Indian Stock Market API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Your API key will be securely stored with this widget and used only 
            for fetching data from the Indian Stock Market API.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Add Widget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}