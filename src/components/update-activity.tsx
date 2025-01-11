import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityChart } from './activity-chart/activity-chart';
import { generateChartData } from '@/lib/chart';
import type { Software } from '@/lib/software/types';

interface UpdateActivityProps {
  software: Software[];
}

export function UpdateActivity({ software }: UpdateActivityProps) {
  const data = generateChartData(software);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Update Activity</CardTitle>
        <CardDescription>
          Daily software update trends
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActivityChart data={data} />
      </CardContent>
    </Card>
  );
}