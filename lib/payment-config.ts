export const paymentConfig = {
  currency: 'USD',
  timeoutMs: 5000,
  retries: 3,
  
  // 🚨 RISK 1: Hardcoded API Key (HILDA will flag this)
  stripeKey: "sk_live_51MzL9J2X8k4NqT5v_DO_NOT_SHARE", 

  // 🚨 RISK 2: Debug mode enabled in what looks like prod code
  enableDebugLogs: true, 
};

export function processPayment(amount: number) {
  // 🚨 RISK 3: Logging sensitive data
  if (paymentConfig.enableDebugLogs) {
    console.log(`Processing payment of ${amount} using key: ${paymentConfig.stripeKey}`);
  }
  
  return { success: true, id: "txn_12345" };
}
