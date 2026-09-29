import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

export interface WinnerNotificationParams {
  vendorEmail: string;
  vendorName: string;
  tenderTitle: string;
  amount: number | string;
  contractId: string;
}

export type EmailNotificationResult =
  | { status: 'sent' }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string };

/**
 * Sends a real email via EmailJS (client-side, no backend). Requires
 * VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and
 * VITE_EMAILJS_PUBLIC_KEY to be set (see .env.example). If unset, this
 * returns 'not_configured' rather than pretending to have sent anything.
 */
export async function sendWinnerNotificationEmail(
  params: WinnerNotificationParams
): Promise<EmailNotificationResult> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    return { status: 'not_configured' };
  }

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: params.vendorEmail,
        vendor_name: params.vendorName,
        tender_title: params.tenderTitle,
        amount: String(params.amount),
        contract_id: params.contractId,
      },
      { publicKey: PUBLIC_KEY }
    );
    return { status: 'sent' };
  } catch (err: any) {
    return { status: 'failed', error: err?.text || err?.message || 'Unknown error' };
  }
}
