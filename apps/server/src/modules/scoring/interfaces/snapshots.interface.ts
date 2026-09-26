export interface ProfileSnapshot {
  currentRole?: string;
  yearsExperience: number;
  skills: string[];
  expectedSalary: number;
  salaryCurrency: string;
  location: string;
  remotePreferred: boolean;
  summary?: string;
}

export interface JobSnapshot {
  id?: number;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryRaw?: string;
  requiredSkills: string[];
  description: string;
}
