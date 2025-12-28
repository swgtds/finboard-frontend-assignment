"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { WidgetBuilderModal } from "../WidgetBuilderModal";
import { TemplatesSidebar } from "../TemplatesSidebar";
import { Logo } from "../icons";
import { PlusCircle, Sparkles, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

export function Header() {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 max-w-screen-2xl items-center px-4">
        <div className="mr-4 flex items-center">
          <Logo className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-primary" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            FinBoard
          </h1>
        </div>
        
        {/* Desktop */}
        <div className="hidden sm:flex flex-1 items-center justify-end space-x-2">
          <TemplatesSidebar>
            <Button variant="outline" size="sm" className="md:size-default">
              <Sparkles className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Templates</span>
            </Button>
          </TemplatesSidebar>
          <WidgetBuilderModal>
            <Button size="sm" className="md:size-default">
              <PlusCircle className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Create Widget</span>
            </Button>
          </WidgetBuilderModal>
          <ThemeToggle />
        </div>

        {/* Mobile */}
        <div className="flex sm:hidden flex-1 items-center justify-end space-x-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <TemplatesSidebar>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Browse Templates
                </DropdownMenuItem>
              </TemplatesSidebar>
              <WidgetBuilderModal>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Widget
                </DropdownMenuItem>
              </WidgetBuilderModal>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
