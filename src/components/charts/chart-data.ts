import { softwareList } from '@/data/software-list';

export type ChartData = {
  date: string;
  updates: number;
};

export function generateChartData(): ChartData[] {
  const data: ChartData[] = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const updates = softwareList.filter(software => {
      if (!software.lastChecked) return false;
      const updateDate = new Date(software.lastChecked);
      return updateDate.toDateString() === date.toDateString();
    }).length;
    
    data.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      updates,
    });
  }
  
  return data;
}