import { Button } from '@/components/ui/button';
import { softwareCategories } from '@/data/software-categories';
import { Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type RecentUpdatesHeaderProps = {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
};

export function RecentUpdatesHeader({ selectedCategory, onCategoryChange }: RecentUpdatesHeaderProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8 p-0"
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onCategoryChange(null)}>
          All Categories
        </DropdownMenuItem>
        {Object.values(softwareCategories).map((category) => (
          <DropdownMenuItem 
            key={category}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}