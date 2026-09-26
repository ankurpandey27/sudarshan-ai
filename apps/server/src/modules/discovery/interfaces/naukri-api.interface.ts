export interface NaukriSearchResponse {
  noOfJobs?: number;
  jobDetails?: NaukriJob[];
}

export interface NaukriJob {
  jobId?: string;
  title?: string;
  companyName?: string;
  jdURL?: string;
  jobDescription?: string;
  tagsAndSkills?: string;
  placeholders?: { type?: string; label?: string }[];
  createdDate?: number;
  applyRedirectUrl?: string;
  companyApplyUrl?: string;
}
