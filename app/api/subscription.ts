import api from './api';

/**
 * Interface representing the subscription response from the API
 */
export interface SubscriptionResponse {
  /**
   * When the user's subscription ends
   * Null means no active subscription
   */
  subscription_end: string | null;
  
  /**
   * CSV export lock until date
   * Used for rate limiting certain features
   */
  csv_lock: string | null;
}

/**
 * Class providing methods to interact with subscription-related API endpoints
 */
export class SubscriptionApi {
  /**
   * Gets the current user's subscription status
   * Requires authentication (access token)
   * 
   * @returns The subscription information including expiration date
   */
  static async getSubscriptionStatus(): Promise<SubscriptionResponse> {
    return api.get<SubscriptionResponse>('/api/users/me/subscription/', true);
  }

  /**
   * Checks if the user has an active premium subscription based on subscription_end date
   * 
   * @param subscriptionData The subscription response from the API
   * @returns True if the user has an active subscription
   */
  static isSubscriptionActive(subscriptionData: SubscriptionResponse): boolean {
    if (!subscriptionData.subscription_end) {
      return false;
    }

    const subscriptionEndDate = new Date(subscriptionData.subscription_end);
    const currentDate = new Date();
    
    return subscriptionEndDate > currentDate;
  }
}

export default SubscriptionApi; 