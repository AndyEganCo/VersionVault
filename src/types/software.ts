export type SortOption = 
  | 'name' 
  | 'category' 
  | 'lastChecked' 
  | 'version' 
  | 'releaseDate' 
  | 'lastChecked'; 

export interface SoftwareRequest {
  readonly name: string;
  readonly website: string;
  readonly versionUrl: string;
  readonly description?: string;
  readonly userId: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly createdAt: string;
}

export interface SoftwareRequestFormData {
  readonly name: string;
  readonly website: string;
  readonly versionUrl: string;
  readonly description?: string;
} 