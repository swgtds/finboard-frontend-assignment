"use client";

import { useState, useMemo } from "react";
import get from "lodash/get";
import type { TableWidgetConfig, WidgetConfig } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { Search } from "lucide-react";

type TableWidgetProps = {
  data: any[];
  config: WidgetConfig & TableWidgetConfig;
};

const ROWS_PER_PAGE = 5;

export function TableWidget({ data, config }: TableWidgetProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!searchTerm) return data;

    return data.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredData, currentPage]);


  if (!Array.isArray(data)) {
    return <div className="text-sm text-muted-foreground">Data is not an array.</div>;
  }
  
  return (
    <div className="flex flex-col h-full select-text">
      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 sm:h-10 text-sm bg-muted/50 border-muted-foreground/20 focus:border-primary/50 focus:bg-background transition-colors"
          />
        </div>
      </div>
      <div className="flex-grow relative">
        <ScrollArea className="absolute inset-0">
          <div className="px-3 sm:px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  {config.columns.map((col, index) => (
                    <TableHead key={index} className="font-semibold text-foreground select-text text-xs sm:text-sm whitespace-nowrap">{col.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/50 transition-colors">
                    {config.columns.map((col, colIndex) => (
                      <TableCell key={colIndex} className="text-xs sm:text-sm select-text py-2 sm:py-3">{get(row, col.dataPath)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 px-3 sm:px-4 py-2 sm:py-3 border-t border-muted-foreground/10">
        <span className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
          {filteredData.length === 0 
            ? "No results" 
            : `${Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredData.length)}-${Math.min(currentPage * ROWS_PER_PAGE, filteredData.length)} of ${filteredData.length}`
          }
        </span>
        <div className="flex items-center space-x-1 sm:space-x-2 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="h-8 px-2 sm:px-3 text-xs sm:text-sm touch-manipulation"
          >
            Prev
          </Button>
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {currentPage}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="h-8 px-2 sm:px-3 text-xs sm:text-sm touch-manipulation"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
