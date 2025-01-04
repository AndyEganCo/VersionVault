import { softwareList } from '@/data/software-list';

export type ChartData = {
  date: string;
  updates: number;
};

export function generateChartData(): ChartData[] {
  const data: ChartData[] = [];
  const today = new Date();
  
  // Initialize the last 7 days with 0 updates
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      updates: 0
    });
  }
  
  // Count updates for each date
  softwareList.forEach(software => {
    if (software.lastChecked) {
      const updateDate = new Date(software.lastChecked);
      const dateStr = updateDate.toLocaleDateString('en-US', { weekday: 'short' });
      const index = data.findIndex(d => d.date === dateStr);
      if (index !== -1) {
        data[index].updates++;
      }
    }
  });
  
  return data;
}