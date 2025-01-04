import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { softwareCategories } from '@/data/software-categories';

type SoftwareFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
};

export function SoftwareFilters({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: SoftwareFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search software..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10 bg-background"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          onClick={() => onCategoryChange(null)}
          className="h-9"
        >
          All
        </Button>
        {Object.entries(softwareCategories).map(([key, value]) => (
          <Button
            key={key}
            variant={selectedCategory === value ? "default" : "outline"}
            onClick={() => onCategoryChange(value)}
            className="h-9"
          >
            {value}
          </Button>
        ))}
      </div>
    </div>
  );
}