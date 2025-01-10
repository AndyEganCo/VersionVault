import type { Software } from '@/lib/software/types';

export type ChartData = {
  date: string;
  updates: number;
};

/**
 * Generates daily chart data for the past 7 days
 * by counting how many softwares have lastChecked on each day.
 * @param softwareList The array of softwares fetched from wherever you store them (e.g. Supabase).
 * @returns An array of ChartData objects for each day in the last 7 days.
 */
export function generateChartData(softwareList: Software[]): ChartData[] {
  const data: ChartData[] = [];
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