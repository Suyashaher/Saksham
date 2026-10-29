export interface PublicNotice {
  id: string;
  title: string;
  date: string; // DD MMM YYYY format
  category: 'REGULATION' | 'PROCEDURE' | 'SECURITY' | 'COMPLIANCE';
  summary: string;
  isSample: true;
}

export const SAMPLE_NOTICES: PublicNotice[] = [
  {
    id: 'notice-2026-04',
    title: 'Advisory on Mandatory Joint FDR Submissions for AY 2026-27 Approval Process',
    date: '15 Oct 2026',
    category: 'REGULATION',
    summary:
      'All technical institutions applying for extension of approval must ensure Fixed Deposit Receipts are issued jointly with Member Secretary, AICTE.',
    isSample: true,
  },
  {
    id: 'notice-2026-03',
    title: 'Standard Operating Procedure for Tripartite Bank Confirmation Letters',
    date: '02 Oct 2026',
    category: 'PROCEDURE',
    summary:
      'Issuing bank branches must provide lien markings and unencumbered confirmation letters directly via verified institutional channels.',
    isSample: true,
  },
  {
    id: 'notice-2026-02',
    title: 'Automated 90-Day Advance Notification Schedule for Expiring Instruments',
    date: '20 Sep 2026',
    category: 'COMPLIANCE',
    summary:
      'Portal alerts for upcoming maturity will trigger at 90, 60, and 30-day intervals. Timely renewal submission is mandatory to prevent encashment proceedings.',
    isSample: true,
  },
  {
    id: 'notice-2026-01',
    title: 'Digital Verification Protocol for Safe Release and Return of Security Deposits',
    date: '05 Sep 2026',
    category: 'SECURITY',
    summary:
      'Conditional release workflows now require three-tier verification before digital discharge certificates are signed by the Approving Authority.',
    isSample: true,
  },
];
