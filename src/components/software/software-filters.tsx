import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { softwareCategories } from '@/data/software-categories';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type SoftwareFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
};

type SortOption = 'name' | 'category' | 'release_date' | 'last_checked';

export function SoftwareFilters({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange
}: SoftwareFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
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
      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="category">Category</SelectItem>
          <SelectItem value="release_date">Release Date</SelectItem>
          <SelectItem value="last_checked">Last Checked</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}