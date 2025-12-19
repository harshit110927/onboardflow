export const WELCOME_EMAIL = (userName: string) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1>Welcome to the platform! 🚀</h1>
    <p>Hi ${userName},</p>
    <p>We are thrilled to have you onboard. We noticed you just signed up.</p>
    <p>Here are your next steps:</p>
    <ul>
      <li>Complete your profile</li>
      <li>Connect your first repository</li>
    </ul>
    <p>If you get stuck, just reply to this email!</p>
    <p>- The Team</p>
  </div>
`;