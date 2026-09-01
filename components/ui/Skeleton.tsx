// components/ui/Skeleton.tsx
import React from 'react';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-border rounded ${className}`} />
  );
}

// Balance Card Skeleton
export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border p-4 rounded-xl shadow-subtle space-y-3">
      <Skeleton className="w-8 h-8 rounded-lg" />
      <Skeleton className="w-16 h-3 rounded" />
      <Skeleton className="w-24 h-5 rounded" />
    </div>
  );
}

// List Item Skeleton
export function SkeletonRow() {
  return (
    <div className="bg-surface border border-border p-4 rounded-xl shadow-subtle flex items-center justify-between">
      <div className="flex items-center gap-3 w-3/4">
        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
        <div className="space-y-2 w-full">
          <Skeleton className="w-1/2 h-3.5 rounded" />
          <Skeleton className="w-1/3 h-2.5 rounded" />
        </div>
      </div>
      <Skeleton className="w-16 h-4 rounded" />
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
          <Skeleton className="w-28 h-5 rounded" />
        </div>
        <Skeleton className="w-24 h-8 rounded-lg" />
      </div>

      {/* Cards Row */}
      <div className="grid grid-cols-3 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Spend Analytics */}
      <div className="bg-surface border border-border p-6 rounded-xl shadow-subtle space-y-4">
        <Skeleton className="w-36 h-4 rounded" />
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-32 h-32 rounded-full border-8 border-border animate-pulse flex items-center justify-center" />
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
