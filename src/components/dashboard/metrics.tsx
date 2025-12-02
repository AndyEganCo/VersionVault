import { MetricCard } from "./metric-card";
import { useAuth } from "@/contexts/auth-context";

interface MetricsProps {
  trackedCount: number;
  thisWeeksUpdates: number;
}

export function Metrics({ trackedCount, thisWeeksUpdates }: MetricsProps) {
  const { user } = useAuth();

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 w-full">
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
    </div>
  );
}