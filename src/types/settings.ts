export interface OrganizationSettings {
  id: string;
  name: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  currency: string;
  // Banking & Payment coordinates
  bankName: string;
  ibanOrRib: string;
  mobileMoneyMerchant: string;
  paymentInstructions: string;
  autoVerifyThreshold: number;
  // Recovery rules
  gracePeriodDays: number;
  autoSuspendOnDispute: boolean;
  aiAssistanceEnabled: boolean;
}
