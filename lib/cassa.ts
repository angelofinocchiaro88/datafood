export interface CassaConfig {
  apiKey: string;
  accountId?: string;
}

export interface CassaAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface SoldProduct {
  idProduct: string;
  product: {
    description: string;
    price: number;
  };
  quantity: number;
  profit: number;
}

export interface SoldByProductReport {
  totalSold: number;
  totalQuantity: number;
  sold: SoldProduct[];
}

export interface SoldDepartment {
  idDepartment: string;
  department: { description: string };
  quantity: number;
  profit: number;
}

export interface SoldByDepartmentReport {
  totalSold: number;
  totalQuantity: number;
  sold: SoldDepartment[];
}

export interface Receipt {
  id: string;
  number: number;
  datetime: string;
  total: number;
  items: ReceiptItem[];
}

export interface ReceiptItem {
  idProduct: string;
  product: { description: string };
  quantity: number;
  price: number;
  profit: number;
}

const AUTH_URL = 'https://api.cassanova.com/apikey/token';
const BASE_URL = 'https://api.cassanova.com';

export class CassaInCloudClient {
  private config: CassaConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: CassaConfig) {
    this.config = config;
  }

  async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': '*',
      },
      body: JSON.stringify({ apiKey: this.config.apiKey }),
    });

    if (!response.ok) {
      throw new Error(`Auth failed: ${response.statusText}`);
    }

    const data: CassaAuthResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    return this.accessToken;
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const token = await this.authenticate();
    const url = new URL(`${BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Requested-With': '*',
        'X-Version': '1.0.0',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getSoldByProduct(params: {
    start?: number;
    limit?: number;
    idsSalesPoint?: number[];
    datetimeFrom: string;
    datetimeTo: string;
    idDepartments?: string[];
  }): Promise<SoldByProductReport> {
    const queryParams: Record<string, string> = {
      start: String(params.start ?? 0),
      limit: String(params.limit ?? 100),
      datetimeFrom: params.datetimeFrom,
      datetimeTo: params.datetimeTo,
    };

    if (params.idsSalesPoint?.length) {
      queryParams.idsSalesPoint = params.idsSalesPoint.join(',');
    }
    if (params.idDepartments?.length) {
      queryParams.idDepartments = params.idDepartments.join(',');
    }

    return this.request<SoldByProductReport>('/reports/sold/products', queryParams);
  }

  async getSoldByDepartment(params: {
    start?: number;
    limit?: number;
    idsSalesPoint?: number[];
    datetimeFrom: string;
    datetimeTo: string;
  }): Promise<SoldByDepartmentReport> {
    const queryParams: Record<string, string> = {
      start: String(params.start ?? 0),
      limit: String(params.limit ?? 100),
      datetimeFrom: params.datetimeFrom,
      datetimeTo: params.datetimeTo,
    };

    if (params.idsSalesPoint?.length) {
      queryParams.idsSalesPoint = params.idsSalesPoint.join(',');
    }

    return this.request<SoldByDepartmentReport>('/reports/sold/departments', queryParams);
  }

  async getReceipts(params: {
    start?: number;
    limit?: number;
    idsSalesPoint?: number[];
    datetimeFrom: string;
    datetimeTo: string;
  }): Promise<{ receipts: Receipt[] }> {
    const queryParams: Record<string, string> = {
      start: String(params.start ?? 0),
      limit: String(params.limit ?? 100),
      datetimeFrom: params.datetimeFrom,
      datetimeTo: params.datetimeTo,
    };

    if (params.idsSalesPoint?.length) {
      queryParams.idsSalesPoint = params.idsSalesPoint.join(',');
    }

    return this.request<{ receipts: Receipt[] }>('/documents/receipts', queryParams);
  }
}

export function parseDateParam(date: string | Date): string {
  if (date instanceof Date) {
    return `"${date.toISOString().split('T')[0]}"`;
  }
  return `"${date}"`;
}