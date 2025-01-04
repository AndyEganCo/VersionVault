import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityChart } from './activity-chart/activity-chart';
import { generateChartData } from '@/lib/chart';

export function UpdateActivity() {
  const data = generateChartData();
  
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