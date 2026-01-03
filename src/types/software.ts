export type SortOption = 
  | 'name' 
  | 'category' 
  | 'lastChecked' 
  | 'version' 
  | 'releaseDate' 
  | 'lastChecked'; 

export interface SoftwareRequest {
  readonly id: string;
  readonly name: string;
  readonly website: string;
  readonly versionUrl: string;
  readonly description?: string;
  readonly userId: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly createdAt: string;
  readonly rejectionReason?: string;
  readonly approvedAt?: string;
  readonly rejectedAt?: string;
  readonly approvedBy?: string;
  readonly rejectedBy?: string;
  readonly softwareId?: string;
  // User info (for admin view)
  readonly userName?: string;
  readonly userEmail?: string;
}

export interface FeatureRequest {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly description: string;
  readonly category?: string;
  readonly status: 'pending' | 'approved' | 'rejected' | 'completed';
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly rejectionReason?: string;
  readonly approvedAt?: string;
  readonly rejectedAt?: string;
  readonly completedAt?: string;
  readonly approvedBy?: string;
  readonly rejectedBy?: string;
  readonly completedBy?: string;
  // User info (for admin view)
  readonly userName?: string;
  readonly userEmail?: string;
}

export interface UserRequestEmailPreferences {
  readonly userId: string;
  readonly receiveApprovalNotifications: boolean;
  readonly receiveRejectionNotifications: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SoftwareRequestFormData {
  readonly name: string;
  readonly website: string;
  readonly versionUrl: string;
  readonly description?: string;
} 