import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Filters = {
  status: 'all' | 'success' | 'error';
  timeRange: '24h' | '7d' | '30d' | 'all';
};

type VersionCheckFiltersProps = {
  filters: Filters;
  onChange: (filters: Filters) => void;
};

export function VersionCheckFilters({ filters, onChange }: VersionCheckFiltersProps) {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Status</div>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={filters.status === 'all'}
                onClick={() => onChange({ ...filters, status: 'all' })}
              >
                All
              </FilterButton>
              <FilterButton
                active={filters.status === 'success'}
                onClick={() => onChange({ ...filters, status: 'success' })}
              >
                Success
              </FilterButton>
              <FilterButton
                active={filters.status === 'error'}
                onClick={() => onChange({ ...filters, status: 'error' })}
              >
                Error
              </FilterButton>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm font-medium">Time Range</div>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={filters.timeRange === '24h'}
                onClick={() => onChange({ ...filters, timeRange: '24h' })}
              >
                24h
              </FilterButton>
              <FilterButton
                active={filters.timeRange === '7d'}
                onClick={() => onChange({ ...filters, timeRange: '7d' })}
              >
                7 days
              </FilterButton>
              <FilterButton
                active={filters.timeRange === '30d'}
                onClick={() => onChange({ ...filters, timeRange: '30d' })}
              >
                30 days
              </FilterButton>
              <FilterButton
                active={filters.timeRange === 'all'}
                onClick={() => onChange({ ...filters, timeRange: 'all' })}
              >
                All time
              </FilterButton>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterButton({ 
  active, 
  children, 
  onClick 
}: { 
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}