export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQS_DATA: FAQItem[] = [
  {
    id: 'faq-documents-required',
    question: 'What documents are required when submitting a security deposit or FDR?',
    answer:
      'Institutions must submit the original FDR or Bank Guarantee scan, a formal Bank Confirmation Slip or Lien Letter on branch letterhead signed by the branch manager, and any previous certificate if the submission is a renewal or replacement.',
  },
  {
    id: 'faq-mismatch-handling',
    question: 'What happens if the verifying officer finds a mismatch during scrutiny?',
    answer:
      'If declared data (such as amount, account number, or maturity date) diverges from the bank letter or OCR extraction, the officer flags a DISCREPANCY with specific remarks. The institution is immediately notified via alerts to provide clarification or upload corrected bank records.',
  },
  {
    id: 'faq-reminders-schedule',
    question: 'How do automated maturity reminders and escalation alerts operate?',
    answer:
      'Automated background jobs track maturity daily. Reminders are dispatched at 90 days, 60 days, and 30 days before maturity. If an instrument reaches MATURED status without renewal, it triggers statutory alerts for regulatory review.',
  },
  {
    id: 'faq-release-authorization',
    question: 'Who holds the statutory authority to approve the release or discharge of a deposit?',
    answer:
      'Release requests initiated by an institution are first scrutinized by a Verifying Officer against regulatory conditions (e.g., student batch completion, no pending dues). Only an designated Approving Authority (e.g., Member Secretary / Regional Officer) can issue the final digital discharge sanction.',
  },
  {
    id: 'faq-self-declared-vs-bank-verified',
    question: 'What is the distinction between Self-Declared and Bank-Verified tags?',
    answer:
      'A Self-Declared tag indicates that the details were entered by the institution and await formal validation. A Bank-Verified tag indicates that the deposit details and encumbrance have been confirmed through official bank confirmation letter or API verification.',
  },
  {
    id: 'faq-data-protection',
    question: 'How are sensitive financial records and documents protected in the portal?',
    answer:
      'All uploaded files and sensitive fields are encrypted at rest using 256-bit AES encryption. Access is strictly controlled via Role-Based Access Control (RBAC), multi-factor OTP authentication is required for logins, and every action is logged into an immutable audit trail.',
  },
  {
    id: 'faq-prototype-scope',
    question: 'What aspects of this portal are demonstrated in the hackathon prototype?',
    answer:
      'This prototype (developed for Smart India Hackathon PS 26265) implements the full end-to-end frontend and backend architecture, including OCR parsing, trust scoring, maturity countdowns, and approval workflows. Direct bank API calls and SMS gateways are mocked using realistic local simulated providers.',
  },
];
