export interface ContactConfig {
  helpdeskEmail: string;
  helplinePhone: string;
  supportHours: string;
  headquartersAddress: string;
  regulationBureauContact: string;
  emergencyEscalation: string;
  grievancePortalUrl: string;
}

export const CONTACT_CONFIG: ContactConfig = {
  helpdeskEmail: 'support-saksham@aicte-india.org', // Config placeholder
  helplinePhone: '011-29581000', // AICTE HQ General Helpline (Placeholder)
  supportHours: 'Monday – Friday, 09:30 AM to 05:30 PM IST (Excluding Gazetted Holidays)',
  headquartersAddress:
    'All India Council for Technical Education (AICTE), Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070',
  regulationBureauContact: 'Regulation Bureau, AICTE Headquarters, New Delhi',
  emergencyEscalation: 'grievance-fdr@aicte-india.org',
  grievancePortalUrl: 'https://www.aicte-india.org/feedback',
};
