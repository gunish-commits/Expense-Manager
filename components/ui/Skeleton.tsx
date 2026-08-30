// components/ui/Skeleton.tsx
import React from 'react';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded ${className}`} />
  );
}

// Balance Card Skeleton
export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-3xl space-y-3">
      <Skeleton className="w-9 h-9 rounded-xl" />
      <Skeleton className="w-16 h-3 rounded" />
      <Skeleton className="w-24 h-5 rounded-md" />
    </div>
  );
}

// List Item Skeleton
export function SkeletonRow() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 p-4 rounded-3xl flex items-center justify-between">
      <div className="flex items-center gap-3 w-3/4">
        <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
        <div className="space-y-2 w-full">
          <Skeleton className="w-1/2 h-3.5 rounded" />
          <Skeleton className="w-1/3 h-2.5 rounded" />
        </div>
      </div>
      <Skeleton className="w-16 h-4 rounded-md" />
    </div>
  );
}

// Skeletons container
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

// Dashboard template skeleton
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div className="space-y-1.5 w-1/3">
          <Skeleton className="w-10 h-2.5 rounded" />
          <Skeleton className="w-28 h-5 rounded-md" />
        </div>
        <Skeleton className="w-24 h-8 rounded-xl" />
      </div>

      {/* Cards Row */}
      <div className="grid grid-cols-3 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Spend Analytics */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl space-y-4">
        <Skeleton className="w-36 h-4 rounded" />
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-32 h-32 rounded-full border-8 border-slate-200 dark:border-slate-800 animate-pulse flex items-center justify-center" />
          <div className="flex-1 space-y-2 w-full">
            <Skeleton className="w-full h-3 rounded" />
            <Skeleton className="w-5/6 h-3 rounded" />
            <Skeleton className="w-4/5 h-3 rounded" />
          </div>
        </div>
      </div>

      {/* Activities list */}
      <div className="space-y-3">
        <Skeleton className="w-28 h-4 rounded" />
        <SkeletonList count={3} />
      </div>
    </div>
  );
}
