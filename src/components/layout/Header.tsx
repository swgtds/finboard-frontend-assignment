"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { WidgetBuilderModal } from "../WidgetBuilderModal";
import { TemplatesSidebar } from "../TemplatesSidebar";
import { Logo } from "../icons";
import { PlusCircle, Sparkles, BarChart3 } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex items-center">
          <Logo className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            FinBoard
          </h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <TemplatesSidebar>
            <Button variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              Templates
            </Button>
          </TemplatesSidebar>
          <WidgetBuilderModal>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Custom Widget
            </Button>
          </WidgetBuilderModal>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
