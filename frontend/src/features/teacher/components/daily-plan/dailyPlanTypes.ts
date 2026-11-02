export interface DailyPlanItem {
  id: string;
  dayNumber: number;
  title: string;
  scheduledDate: string;
  estimatedMinutes: number;
  isUnlocked?: boolean;
  items: any[];
}

export interface GlobalResourceItem {
  id: string;
  name: string;
  resourceType: string;
  url?: string;
  fileSize?: string;
}

export interface StudentProgressStat {
  studentName: string;
  overallRate: number;
  days?: {
    rate: number;
    minutes: number;
  }[];
}
