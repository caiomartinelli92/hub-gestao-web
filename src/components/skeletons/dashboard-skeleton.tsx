import { Role } from '@/types';

function TopbarSkeleton() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex-1">
        <div className="h-6 bg-(--card) rounded w-48 mb-2 animate-pulse" />
        <div className="h-3 bg-(--card) rounded w-40 animate-pulse" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-32 bg-(--card) rounded-lg animate-pulse" />
        <div className="h-9 w-9 bg-(--card) rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

function StatsStripSkeleton() {
  return (
    <div className="flex gap-4 mb-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card rounded-xl p-3 border border-app flex items-center gap-3 animate-pulse">
          <div className="h-3 w-3 rounded-full bg-(--border)" />
          <div>
            <div className="h-5 bg-(--card) rounded w-8 mb-1" />
            <div className="h-3 bg-(--card) rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-3 items-center mb-4">
      <div className="h-9 bg-(--card) rounded w-64 animate-pulse" />
      <div className="h-9 bg-(--card) rounded w-40 animate-pulse" />
      <div className="h-9 bg-(--card) rounded w-40 animate-pulse" />
      <div className="h-9 bg-(--card) rounded w-28 ml-auto animate-pulse" />
    </div>
  );
}

function ListRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="card rounded-xl p-3 border border-app flex items-center gap-4 animate-pulse">
          <div className="w-1 bg-(--border) h-12 rounded" />
          <div className="flex-1">
            <div className="h-4 bg-(--card) rounded w-1/3 mb-2" />
            <div className="h-3 bg-(--card) rounded w-1/4" />
          </div>
          <div className="w-28">
            <div className="h-3 bg-(--card) rounded w-full mb-2" />
            <div className="h-3 bg-(--card) rounded w-2/3" />
          </div>
          <div className="w-20 h-3 bg-(--card) rounded" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardSkeleton({ role }: { role?: Role }) {
  return (
    <div>
      <TopbarSkeleton />
      <StatsStripSkeleton />
      <FiltersSkeleton />

      {/* Role specific main area */}
      {role === Role.CEO && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card rounded-xl p-6 border border-app animate-pulse">
                <div className="h-5 bg-(--card) rounded w-24 mb-3" />
                <div className="h-10 bg-(--card) rounded w-2/3" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card rounded-xl p-5 border border-app animate-pulse h-52" />
            <div className="card rounded-xl p-5 border border-app animate-pulse h-52" />
          </div>
        </div>
      )}

      {role === Role.PO && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card rounded-xl p-6 border border-app animate-pulse">
                <div className="h-5 bg-(--card) rounded w-20 mb-2" />
                <div className="h-8 bg-(--card) rounded w-1/2" />
              </div>
            ))}
          </div>

          <div className="card rounded-xl border border-app p-4">
            <ListRowsSkeleton count={5} />
          </div>
        </div>
      )}

      {role === Role.DEV && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card rounded-xl p-6 border border-app animate-pulse">
                <div className="h-5 bg-(--card) rounded w-20 mb-2" />
                <div className="h-6 bg-(--card) rounded w-1/3" />
              </div>
            ))}
          </div>

          <div className="card rounded-xl border border-app p-4">
            <ListRowsSkeleton count={6} />
          </div>
        </div>
      )}

      {role === Role.QA && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="card rounded-xl p-5 border border-app animate-pulse h-44" />
            ))}
          </div>
          <div className="card rounded-xl border border-app p-4">
            <ListRowsSkeleton count={5} />
          </div>
        </div>
      )}

      {!role && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-5 border border-app animate-pulse h-44" />
            <div className="card rounded-xl p-5 border border-app animate-pulse h-44" />
          </div>
        </div>
      )}
    </div>
  );
}
