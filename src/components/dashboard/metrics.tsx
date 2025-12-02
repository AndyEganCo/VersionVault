import { MetricCard } from "./metric-card";
import { useAuth } from "@/contexts/auth-context";

interface MetricsProps {
  trackedCount: number;
  thisWeeksUpdates: number;
  majorUpdates: number;
}

export function Metrics({ trackedCount, thisWeeksUpdates, majorUpdates }: MetricsProps) {
  const { user } = useAuth();

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3 w-full">
      <MetricCard
        title="Tracked Software"
        value={trackedCount}
        description={user ? "+2 from last month" : "Total available"}
      />
      <MetricCard
        title="This Week's Updates"
        value={thisWeeksUpdates}
        description="Software updates this week"
      />
      <MetricCard
        title="Major Updates"
        value={majorUpdates}
        description="Version jumps (e.g. 8.x → 9.x)"
      />
    </div>
  );
}