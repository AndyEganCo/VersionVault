import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VersionCheckStats as Stats } from '@/types/version-check';

type VersionCheckStatsProps = {
  stats: Stats;
};

export function VersionCheckStats({ stats }: VersionCheckStatsProps) {
  const successRate = stats.total > 0
    ? Math.round((stats.successful / stats.total) * 100)
    : 0;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
      <StatCard
        title="Total Checks"
        value={stats.total}
        description="All time"
      />
      <StatCard
        title="Success Rate"
        value={`${successRate}%`}
        description="Successful checks"
      />
      <StatCard
        title="Failed Checks"
        value={stats.failed}
        description="Last 24 hours"
      />
      <StatCard
        title="New Versions"
        value={stats.newVersions}
        description="Detected today"
      />
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: number | string;
  description: string;
};

function StatCard({ title, value, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}