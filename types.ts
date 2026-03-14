export interface Bot {
  id: string;
  name: string;
  description: string;
  price: number;
  features?: string[];
  imageUrl?: string;
}

export interface License {
  id: string;
  userId: string;
  botId: string;
  botName: string;
  licenseKey: string;
  expiresAt: any; // Timestamp
  status: 'active' | 'expired';
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'customer';
}
