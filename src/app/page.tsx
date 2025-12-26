"use client";

import { Dashboard } from "@/components/Dashboard";
import { Header } from "@/components/layout/Header";
import { useHydration } from "@/hooks/use-hydration";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const isHydrated = useHydration();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {isHydrated ? <Dashboard /> : <DashboardSkeleton />}
      </main>
    </div>
  );
}

const DashboardSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {[...Array(4)].map((_, i) => (
      <Skeleton key={i} className="h-72 w-full rounded-xl" />
    ))}
  </div>
);
