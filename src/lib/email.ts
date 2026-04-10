import toast from 'react-hot-toast';

// Always resolve the API base relative to where the React app is served from.
// In Vercel (PROD), it is empty string so it hits the serverless /api/ directory relatively.
// In local dev, it hits the Express server on port 3001.
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

/**
 * Sends a status update email to the citizen when admin changes report status.
 */
export const sendCitizenNotification = async (
  toEmail: string,
  reportDescription: string,
  newStatus: string,
  feedback: string,
  tokenId?: string
) => {
  try {
    const statusEmoji =
      newStatus.toLowerCase().includes('resolved') || newStatus.toLowerCase().includes('completed') ? '✅' :
      newStatus.toLowerCase().includes('approved') ? '✔️' :
      newStatus.toLowerCase().includes('denied') ? '❌' :
      newStatus.toLowerCase().includes('progress') ? '🔄' : '⏳';

    const response = await fetch(`${API_BASE}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail,
        subject: `${statusEmoji} Status Update on Your Civic Report – Snap City AI`,
        text: `Hello,\n\nYour civic complaint has been reviewed by the Snap City AI municipal portal.\n\n${tokenId ? `Token ID: ${tokenId}\n` : ''}Report: "${reportDescription}"\nNew Status: ${newStatus}\n\n${feedback ? `Department Response:\n${feedback}` : 'No additional feedback at this time.'}\n\nYou can log in to track further updates.\n\nRegards,\nSnap City AI Support`,
        fromName: 'Snap City AI'
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server responded ${response.status}: ${errText}`);
    }
    toast.success('Status update email sent to citizen ✉');
  } catch (error: any) {
    console.error('Failed to send citizen email:', error);
    toast.error(error.message || 'Failed to send status update email to citizen.');
  }
};

/**
 * Sends the formal complaint to the municipal zonal/district email
 * when admin marks a report as "Approved".
 */
export const sendMunicipalApprovalEmail = async (
  municipalEmail: string,
  citizenEmail: string,
  report: {
    tokenId?: string;
    description: string;
    location: string;
    department: string;
    severity: string;
    aiComplaint: string;
    assignedCity?: string;
    assignedZone?: string;
  }
) => {
  try {
    const routingLabel = report.assignedZone || report.assignedCity || 'the respective zone';
    const response = await fetch(`${API_BASE}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: municipalEmail,
        replyTo: citizenEmail,
        subject: `[Snap City AI – APPROVED] Civic Complaint for ${routingLabel}: ${report.department} Issue`,
        text: `This complaint has been reviewed and APPROVED for action by the Snap City AI Admin Portal.\n\n${report.tokenId ? `Token ID: ${report.tokenId}\n` : ''}Location: ${report.location}\nDepartment: ${report.department}\nSeverity: ${report.severity || 'Unknown'}\nReported By: ${citizenEmail}\n\n--- FORMAL COMPLAINT ---\n\n${report.aiComplaint}\n\n--- END OF COMPLAINT ---\n\nPlease take the necessary action at the earliest.\n\nRegards,\nSnap City AI Civic Platform`,
        fromName: 'Snap City AI Admin'
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server responded ${response.status}: ${errText}`);
    }
    toast.success(`Complaint forwarded to municipal office (${municipalEmail}) ✉`);
  } catch (error: any) {
    console.error('Failed to send municipal approval email:', error);
    toast.error(error.message || 'Failed to forward complaint to municipal office.');
  }
};

/**
 * Sends an alert email for general admin notifications.
 */
export const sendAdminAlert = async (
  toEmail: string,
  reportDescription: string,
  location: string,
  department: string,
  citizenEmail: string,
  complaintText: string
) => {
  try {
    const response = await fetch(`${API_BASE}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail,
        replyTo: citizenEmail,
        subject: `New Civic Complaint: ${department} issue at ${location}`,
        text: complaintText,
        fromName: 'Snap City AI System'
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server responded ${response.status}: ${errText}`);
    }
  } catch (error) {
    console.error('Failed to send admin alert:', error);
    // Silent fail — don't block the UI
  }
};
