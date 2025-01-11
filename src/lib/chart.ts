import type { Software } from './software/types';

export type ChartDataPoint = {
  date: string;
  updates: number;
};

export function generateChartData(softwareList: Software[]): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const updates = softwareList.filter((software) => {
      if (!software.last_checked) return false;
      const updateDate = new Date(software.last_checked);
      return updateDate.toDateString() === date.toDateString();
    }).length;
    
    data.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      updates,
    });
  }
  
  return data;
} 