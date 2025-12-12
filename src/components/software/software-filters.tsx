import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import type { SortOption } from '@/types/software';
import { getCategories } from '@/lib/software/queries/queries';

interface SoftwareFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (value: string | null) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
}

// Use a special string for "All categories"
const ALL_CATEGORIES_VALUE = 'all-categories';

export function SoftwareFilters({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange
}: SoftwareFiltersProps) {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    }
    loadCategories();
  }, []);

  const handleCategoryChange = (value: string) => {
    // Convert the special value back to null
    if (value === ALL_CATEGORIES_VALUE) {
      onCategoryChange(null);
    } else {
      onCategoryChange(value);
    }
  };

  // If selectedCategory is null, we use the special string "all-categories"
  const categoryValue = selectedCategory ?? ALL_CATEGORIES_VALUE;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      <Input
        placeholder="Search software..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="md:w-[200px]"
      />
      <Select
        value={categoryValue}
        onValueChange={handleCategoryChange}
      >
        <SelectTrigger className="md:w-[200px]">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES_VALUE}>
            All categories
          </SelectItem>
          {categories.map((category) => (
            // Use the actual category name as value
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className="md:w-[200px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="category">Category</SelectItem>
          <SelectItem value="version">Version</SelectItem>
          <SelectItem value="releaseDate">Release Date</SelectItem>
          <SelectItem value="lastChecked">Last Checked</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}