import axios, { AxiosInstance } from 'axios';
import type {
  JsonBody,
  CustomerResponse,
  CustomerUpsertRequest,
  CustomerProfileResponse,
  AddressResponse,
  AddressCreateRequest,
  AddressUpdateRequest,
  OrderResponse,
  OrderCreateRequest,
  OrderDeliveryStartRequest,
  PaymentResponse,
  PaymentCreateRequest,
  PaymentMarkPaidRequest,
  BankdaTxResponse,
  BankdaTxQuery,
  MatchResult,
  NotificationLogResponse,
  NotificationTemplateCode,
  NotificationStatus,
  ProductCreateRequest,
  AdminProductStockRow,
  StockUpdateRequest,
  ProductReorderRequest,
  ShippingPolicy,
  ShippingPolicyCreateRequest,
  ShippingPolicyResponse,
  ShippingRuleCreateRequest,
  ShippingRuleResponse,
  DiscountPolicy,
  DiscountPolicyCreateRequest,
  DiscountPolicyResponse,
  DiscountRuleCreateRequest,
  DiscountRuleResponse,
  DiscountRuleUpdateRequest,
  PricingRequest,
  OrderPricingResponse,
  ReviewMatchListResponse,
  ReviewConfirmRequest,
  ReviewConfirmResponse,
  AdminStockAdjustRequest,
  PageStockHistory,
  FeatureFlagResponse,
  FeatureKey,
  CashReceiptNoUpdateRequest,
  PageOrderResponse,
  PageCustomerListResponse,
  OrderCancelRequest,
  CustomerBlockUpdateRequest,
  SalesStatRow,
} from '@/types/api';

// 개발 환경에서는 프록시를 사용하므로 빈 문자열, 프로덕션에서는 실제 URL 사용
const API_BASE_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_BASE_URL || 'https://찰떡상회.com')
  : '';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to log requests
    this.client.interceptors.request.use(
      (config) => {
        // 고객 프로필 조회와 상품 단건 조회는 404가 정상 종료 조건이므로 요청 로그도 조용히 처리
        const isCustomerProfileRequest = config.url?.includes('/customers/') && 
                                        config.url?.includes('/profile');
        const isProductGetRequest = config.method === 'GET' && 
                                    config.url?.includes('/products/') && 
                                    config.url?.match(/\/products\/\d+$/); // /products/{id} 형식만
        
        if (!isCustomerProfileRequest && !isProductGetRequest) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data);
        }
        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => {
        // 404는 특정 API에서 정상 종료 조건이므로 조용히 처리
        const isCustomerProfile404 = response.config?.url?.includes('/customers/') && 
                                     response.config?.url?.includes('/profile') && 
                                     response.status === 404;
        const isPaymentByOrder404 = response.config?.url?.includes('/payments/by-order') && 
                                     response.status === 404;
        const isProduct404 = response.config?.url?.includes('/products/') && 
                             response.status === 404;
        const isProduct500 = response.config?.url?.includes('/products/') && 
                             response.status === 500;
        
        if (!isCustomerProfile404 && !isPaymentByOrder404 && !isProduct404 && !isProduct500) {
          console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.status, response.data);
        }
        return response;
      },
      (error) => {
        // 404는 특정 API에서 정상 종료 조건이므로 조용히 처리
        const isCustomerProfile404 = error.config?.url?.includes('/customers/') && 
                                     error.config?.url?.includes('/profile') && 
                                     error.response?.status === 404;
        const isPaymentByOrder404 = error.config?.url?.includes('/payments/by-order') && 
                                     error.response?.status === 404;
        const isProduct404 = error.config?.url?.includes('/products/') && 
                             error.response?.status === 404;
        const isProduct500 = error.config?.url?.includes('/products/') && 
                             error.response?.status === 500;
        
        // 500 에러는 상세 정보를 포함하여 로깅
        if (error.response?.status === 500) {
          console.error('[API Error] 500 Internal Server Error', {
            method: error.config?.method?.toUpperCase(),
            url: error.config?.url,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.response?.data?.message || error.message,
          });
        } else if (!isCustomerProfile404 && !isPaymentByOrder404 && !isProduct404 && !isProduct500) {
          console.error('[API Error]', error.config?.method?.toUpperCase(), error.config?.url, error.response?.status, error.response?.data || error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  // Customer APIs
  async identifyCustomer(data: CustomerUpsertRequest): Promise<JsonBody<CustomerResponse>> {
    const response = await this.client.post('/api/v1/customers/identify', data);
    return response.data;
  }

  async getAllCustomers(startId: number = 1, limit: number = 10): Promise<JsonBody<CustomerResponse[]>> {
    // 고객 ID를 startId부터 순차적으로 조회하여 리스트 생성 (limit개)
    const customers: CustomerResponse[] = [];
    let customerId = startId;
    let hasMore = true;
    const endId = startId + limit - 1; // 시작 ID부터 limit개까지

    console.log(`[getAllCustomers] 고객 리스트 순차 조회 시작 (ID ${startId}부터 ${limit}개)`);

    while (hasMore && customerId <= endId) {
      try {
        // 404 에러를 조용히 처리하기 위해 validateStatus를 사용
        const response = await this.client.get(`/api/v1/customers/${customerId}/profile`, {
          validateStatus: (status) => status === 200 || status === 404, // 200과 404만 성공으로 처리
        });
        
        if (response.status === 404) {
          // 404면 더 이상 고객이 없음
          hasMore = false;
          console.log(`[getAllCustomers] 고객 ID ${customerId}에서 조회 종료 (총 ${customers.length}명)`);
        } else if (response.data?.data?.customer) {
          customers.push(response.data.data.customer);
          customerId++;
        } else {
          hasMore = false;
        }
      } catch (error: any) {
        // 예상치 못한 에러만 처리
        console.warn(`[getAllCustomers] 고객 ID ${customerId} 조회 실패:`, error.response?.status || error.message);
        customerId++;
        // 연속된 에러가 많으면 중단
        if (customerId > customers.length + 10) {
          console.warn('[getAllCustomers] 연속된 에러로 인해 조회 중단');
          hasMore = false;
        }
      }
    }

    console.log(`[getAllCustomers] 총 ${customers.length}명의 고객 조회 완료`);
    return { status: 200, message: 'OK', data: customers };
  }

  async getAllCustomersAdmin(params?: { page?: number; size?: number }): Promise<JsonBody<PageCustomerListResponse>> {
    const response = await this.client.get('/api/v1/admin/customers', { params });
    return response.data;
  }

  async getCustomerProfile(customerId: number): Promise<JsonBody<CustomerProfileResponse>> {
    const response = await this.client.get(`/api/v1/customers/${customerId}/profile`);
    return response.data;
  }

  async updateCustomerBlocked(customerId: number, data: CustomerBlockUpdateRequest): Promise<JsonBody<void>> {
    const url = `/api/v1/admin/customers/${customerId}/blocked`;
    console.log('[updateCustomerBlocked] ========== 요청 시작 ==========');
    console.log('[updateCustomerBlocked] 요청 URL:', url);
    console.log('[updateCustomerBlocked] 고객 ID:', customerId);
    console.log('[updateCustomerBlocked] 요청 데이터:', JSON.stringify(data, null, 2));
    try {
      const response = await this.client.patch(url, data);
      console.log('[updateCustomerBlocked] 응답 성공:', JSON.stringify(response.data, null, 2));
      console.log('[updateCustomerBlocked] ========== 요청 완료 ==========');
      return response.data;
    } catch (error: any) {
      console.error('[updateCustomerBlocked] ========== 에러 발생 ==========');
      console.error('[updateCustomerBlocked] 요청 URL:', url);
      console.error('[updateCustomerBlocked] 고객 ID:', customerId);
      console.error('[updateCustomerBlocked] 요청 데이터:', JSON.stringify(data, null, 2));
      console.error('[updateCustomerBlocked] HTTP 상태:', error.response?.status, error.response?.statusText);
      
      if (error.response) {
        console.error('[updateCustomerBlocked] 서버 응답 헤더:', error.response.headers);
        console.error('[updateCustomerBlocked] 서버 응답 본문 (전체):', JSON.stringify(error.response.data, null, 2));
        
        const responseData = error.response.data;
        if (responseData) {
          console.error('[updateCustomerBlocked] 응답 데이터 타입:', typeof responseData);
          console.error('[updateCustomerBlocked] 응답 데이터 키:', Object.keys(responseData || {}));
          
          if (responseData.message) {
            console.error('[updateCustomerBlocked] 서버 메시지:', responseData.message);
          }
          if (responseData.error) {
            console.error('[updateCustomerBlocked] 서버 에러:', responseData.error);
          }
        }
      } else {
        console.error('[updateCustomerBlocked] 네트워크 에러 또는 응답 없음');
        console.error('[updateCustomerBlocked] 에러 메시지:', error.message);
      }
      
      console.error('[updateCustomerBlocked] 전체 에러 객체:', error);
      console.error('[updateCustomerBlocked] ===============================');
      throw error;
    }
  }

  async addAddress(customerId: number, data: AddressCreateRequest): Promise<JsonBody<AddressResponse>> {
    console.log('[addAddress] 요청 데이터:', JSON.stringify(data, null, 2));
    const response = await this.client.post(`/api/v1/customers/${customerId}/addresses`, data);
    return response.data;
  }

  async updateAddress(
    customerId: number,
    addressId: number,
    data: AddressUpdateRequest
  ): Promise<JsonBody<AddressResponse>> {
    const response = await this.client.put(`/api/v1/customers/${customerId}/addresses/${addressId}`, data);
    return response.data;
  }

  async deleteAddress(customerId: number, addressId: number): Promise<JsonBody<void>> {
    const response = await this.client.delete(`/api/v1/customers/${customerId}/addresses/${addressId}`);
    return response.data;
  }

  // Order APIs
  async getOrdersByCustomer(customerId: number): Promise<JsonBody<OrderResponse[]>> {
    const response = await this.client.get('/api/v1/orders', { params: { customerId } });
    return response.data;
  }

  async getAllOrdersAdmin(params?: { page?: number; size?: number }): Promise<JsonBody<PageOrderResponse>> {
    const response = await this.client.get('/api/v1/admin/orders', { params });
    return response.data;
  }

  async issueCashReceipt(orderId: number, data: CashReceiptNoUpdateRequest): Promise<JsonBody<void>> {
    const response = await this.client.post(`/api/v1/admin/orders/${orderId}/cash-receipt`, data);
    return response.data;
  }

  async updateCashReceipt(orderId: number, data: CashReceiptNoUpdateRequest): Promise<JsonBody<void>> {
    const response = await this.client.put(`/api/v1/admin/orders/${orderId}/cash-receipt`, data);
    return response.data;
  }

  async getOrder(orderId: number): Promise<JsonBody<OrderResponse>> {
    const response = await this.client.get(`/api/v1/orders/${orderId}`);
    return response.data;
  }

  async confirmOrder(orderId: number): Promise<JsonBody<void>> {
    console.log('[confirmOrder] ========== 요청 시작 ==========');
    console.log('[confirmOrder] 주문 ID:', orderId);
    try {
      // POST 요청이지만 body가 없어야 함 (ID만 path parameter로 전달)
      const response = await this.client.post(`/api/v1/orders/${orderId}/confirm`);
      console.log('[confirmOrder] 응답 성공:', response.data);
      console.log('[confirmOrder] ========== 요청 완료 ==========');
      return response.data;
    } catch (error: any) {
      console.error('[confirmOrder] ========== 에러 발생 ==========');
      console.error('[confirmOrder] 요청 URL:', `/api/v1/orders/${orderId}/confirm`);
      console.error('[confirmOrder] 주문 ID:', orderId);
      console.error('[confirmOrder] 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
      });
      console.error('[confirmOrder] 전체 에러 객체:', error);
      if (error.response?.data) {
        console.error('[confirmOrder] 서버 응답 상세:', {
          status: error.response.status,
          data: error.response.data,
          message: error.response.data.message,
          error: error.response.data.error,
        });
      }
      console.error('[confirmOrder] ===============================');
      throw error;
    }
  }

  async completeOrder(orderId: number): Promise<JsonBody<void>> {
    console.log('[completeOrder] ========== 요청 시작 ==========');
    console.log('[completeOrder] 주문 ID:', orderId);
    try {
      // POST 요청이지만 body가 없어야 함 (ID만 path parameter로 전달)
      const response = await this.client.post(`/api/v1/orders/${orderId}/complete`);
      console.log('[completeOrder] 응답 성공:', response.data);
      console.log('[completeOrder] ========== 요청 완료 ==========');
      return response.data;
    } catch (error: any) {
      console.error('[completeOrder] ========== 에러 발생 ==========');
      console.error('[completeOrder] 요청 URL:', `/api/v1/orders/${orderId}/complete`);
      console.error('[completeOrder] 주문 ID:', orderId);
      console.error('[completeOrder] 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
      });
      console.error('[completeOrder] 전체 에러 객체:', error);
      if (error.response?.data) {
        console.error('[completeOrder] 서버 응답 상세:', {
          status: error.response.status,
          data: error.response.data,
          message: error.response.data.message,
          error: error.response.data.error,
        });
      }
      console.error('[completeOrder] ===============================');
      throw error;
    }
  }

  async cancelOrder(orderId: number, data: OrderCancelRequest): Promise<JsonBody<void>> {
    // 주문 ID로 직접 매칭하는 엔드포인트
    const url = `/api/v1/admin/orders/${orderId}/cancel`;
    console.log('[cancelOrder] ========== 요청 시작 ==========');
    console.log('[cancelOrder] 요청 URL:', url);
    console.log('[cancelOrder] 주문 ID:', orderId);
    console.log('[cancelOrder] 취소 사유:', JSON.stringify(data, null, 2));
    try {
      const response = await this.client.post(url, data);
      console.log('[cancelOrder] 응답 성공:', JSON.stringify(response.data, null, 2));
      console.log('[cancelOrder] ========== 요청 완료 ==========');
      return response.data;
    } catch (error: any) {
      console.error('[cancelOrder] ========== 에러 발생 ==========');
      console.error('[cancelOrder] 요청 URL:', url);
      console.error('[cancelOrder] 주문 ID:', orderId);
      console.error('[cancelOrder] 요청 데이터:', JSON.stringify(data, null, 2));
      console.error('[cancelOrder] HTTP 상태:', error.response?.status, error.response?.statusText);
      
      // 서버 응답 본문 전체 출력
      if (error.response) {
        console.error('[cancelOrder] 서버 응답 헤더:', error.response.headers);
        console.error('[cancelOrder] 서버 응답 본문 (전체):', JSON.stringify(error.response.data, null, 2));
        
        // 다양한 형태의 에러 메시지 추출 시도
        const responseData = error.response.data;
        if (responseData) {
          console.error('[cancelOrder] 응답 데이터 타입:', typeof responseData);
          console.error('[cancelOrder] 응답 데이터 키:', Object.keys(responseData || {}));
          
          if (responseData.message) {
            console.error('[cancelOrder] 서버 메시지:', responseData.message);
          }
          if (responseData.error) {
            console.error('[cancelOrder] 서버 에러:', responseData.error);
          }
          if (responseData.timestamp) {
            console.error('[cancelOrder] 에러 타임스탬프:', responseData.timestamp);
          }
          if (responseData.path) {
            console.error('[cancelOrder] 에러 경로:', responseData.path);
          }
          if (responseData.status) {
            console.error('[cancelOrder] 응답 상태:', responseData.status);
          }
          // Spring Boot 에러 형식 확인
          if (responseData.exception) {
            console.error('[cancelOrder] 예외 타입:', responseData.exception);
          }
          if (responseData.trace) {
            console.error('[cancelOrder] 스택 트레이스 (일부):', responseData.trace?.substring(0, 500));
          }
        }
      } else {
        console.error('[cancelOrder] 네트워크 에러 또는 응답 없음');
        console.error('[cancelOrder] 에러 메시지:', error.message);
      }
      
      console.error('[cancelOrder] 전체 에러 객체:', error);
      console.error('[cancelOrder] ===============================');
      throw error;
    }
  }

  async createOrder(
    customerId: number,
    addressId: number,
    data: OrderCreateRequest
  ): Promise<JsonBody<OrderResponse>> {
    const response = await this.client.post('/api/v1/orders', data, {
      params: { customerId, addressId },
    });
    return response.data;
  }

  async createPickupOrder(
    customerId: number,
    data: OrderCreateRequest
  ): Promise<JsonBody<OrderResponse>> {
    const response = await this.client.post('/api/v1/orders/pickup', data, {
      params: { customerId },
    });
    return response.data;
  }

  async startDelivery(
    orderId: number,
    data: OrderDeliveryStartRequest
  ): Promise<JsonBody<void>> {
    const response = await this.client.post(`/api/v1/orders/${orderId}/delivery/start`, data);
    return response.data;
  }

  async markDelivered(orderId: number): Promise<JsonBody<void>> {
    const response = await this.client.post(`/api/v1/orders/${orderId}/delivery/delivered`);
    return response.data;
  }

  async getOrderPricing(data: PricingRequest): Promise<JsonBody<OrderPricingResponse>> {
    const response = await this.client.post('/api/v1/orders/pricing', data);
    return response.data;
  }

  // Payment APIs
  async createPayment(orderId: number, data: PaymentCreateRequest): Promise<JsonBody<PaymentResponse>> {
    const response = await this.client.post('/api/v1/payments', data, { params: { orderId } });
    return response.data;
  }

  async getPayment(paymentId: number): Promise<JsonBody<PaymentResponse>> {
    const response = await this.client.get(`/api/v1/payments/${paymentId}`);
    return response.data;
  }

  async getPaymentByOrder(orderId: number): Promise<JsonBody<PaymentResponse> | null> {
    try {
      const response = await this.client.get('/api/v1/payments/by-order', { 
        params: { orderId },
        validateStatus: (status) => status === 200 || status === 404, // 404도 정상 처리
      });
      
      if (response.status === 404) {
        // 결제 정보가 없으면 null 반환
        return null;
      }
      
      return response.data;
    } catch (error: any) {
      // 404는 정상적인 경우 (결제 정보가 아직 생성되지 않음)
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async markPaymentPaid(paymentId: number, data: PaymentMarkPaidRequest): Promise<JsonBody<PaymentResponse>> {
    const response = await this.client.post(`/api/v1/payments/${paymentId}/paid`, data);
    return response.data;
  }

  // Admin - Bankda APIs
  async fetchAndSaveTransactions(data: BankdaTxQuery): Promise<JsonBody<BankdaTxResponse>> {
    const response = await this.client.post('/api/v1/admin/bankda/transactions', data);
    return response.data;
  }

  async fetchAndSaveThenMatch(data: BankdaTxQuery): Promise<JsonBody<any>> {
    const response = await this.client.post('/api/v1/admin/bankda/transactions-and-match', data);
    return response.data;
  }

  async matchTransactions(): Promise<JsonBody<MatchResult>> {
    const response = await this.client.post('/api/v1/admin/bankda/match');
    return response.data;
  }

  // Admin - Notification APIs
  async getNotifications(params?: { page?: number; size?: number }): Promise<JsonBody<NotificationLogResponse[]>> {
    const response = await this.client.get('/api/v1/admin/notifications', { params });
    return response.data;
  }

  async getNotificationsByTemplate(
    templateCode: NotificationTemplateCode,
    params?: { page?: number; size?: number }
  ): Promise<JsonBody<NotificationLogResponse[]>> {
    const response = await this.client.get('/api/v1/admin/notifications/by-template', {
      params: { templateCode, ...params },
    });
    return response.data;
  }

  async getNotificationsByStatus(
    status: NotificationStatus,
    params?: { page?: number; size?: number }
  ): Promise<JsonBody<NotificationLogResponse[]>> {
    const response = await this.client.get('/api/v1/admin/notifications/by-status', {
      params: { status, ...params },
    });
    return response.data;
  }

  // Product APIs
  async getProducts(): Promise<JsonBody<AdminProductStockRow[]>> {
    const response = await this.client.get('/api/v1/admin/products');
    return response.data;
  }

  async createProduct(data: ProductCreateRequest): Promise<JsonBody<AdminProductStockRow>> {
    const response = await this.client.post('/api/v1/admin/products', data);
    return response.data;
  }

  async updateProductStock(
    productId: number,
    data: StockUpdateRequest
  ): Promise<JsonBody<void>> {
    const response = await this.client.put(`/api/v1/admin/products/${productId}/stock`, data);
    return response.data;
  }

  async deleteProduct(productId: number): Promise<JsonBody<void>> {
    const response = await this.client.delete(`/api/v1/admin/products/${productId}`);
    return response.data;
  }

  async updateProduct(
    productId: number,
    data: { name?: string; price?: number; category?: string; taxType?: string; active?: boolean; purchasePrice?: number }
  ): Promise<JsonBody<void>> {
    console.log('[API] ========== updateProduct 시작 ==========');
    console.log('[API] productId:', productId);
    console.log('[API] 요청 데이터:', JSON.stringify(data, null, 2));
    console.log('[API] 요청 URL:', `/api/v1/admin/products/${productId}`);
    console.log('[API] 요청 메서드: PATCH');
    
    try {
      const response = await this.client.patch(`/api/v1/admin/products/${productId}`, data);
      console.log('[API] ========== updateProduct 성공 ==========');
      console.log('[API] 응답 상태:', response.status);
      console.log('[API] 응답 데이터:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.error('[API] ========== updateProduct 실패 ==========');
      console.error('[API] 에러 상태:', error.response?.status);
      console.error('[API] 에러 상태 텍스트:', error.response?.statusText);
      console.error('[API] 에러 응답 데이터:', JSON.stringify(error.response?.data, null, 2));
      console.error('[API] 에러 메시지:', error.message);
      throw error;
    }
  }

  async reorderProducts(data: ProductReorderRequest): Promise<JsonBody<void>> {
    console.log('[API] reorderProducts 요청:', JSON.stringify(data, null, 2));
    const response = await this.client.put('/api/v1/admin/products/reorder', data);
    console.log('[API] reorderProducts 응답:', response.data);
    return response.data;
  }

  // Policy APIs - Shipping
  async getShippingPolicies(): Promise<JsonBody<ShippingPolicyResponse[]>> {
    const response = await this.client.get('/api/v1/admin/policies/shipping');
    console.log('[DEBUG API] getShippingPolicies 원본 응답:', JSON.stringify(response.data, null, 2));
    if (response.data?.data) {
      response.data.data.forEach((policy: any, pIdx: number) => {
        console.log(`[DEBUG API] 정책[${pIdx}] ${policy.name}:`, policy);
        if (policy.rules) {
          policy.rules.forEach((rule: any, rIdx: number) => {
            console.log(`[DEBUG API]   룰[${rIdx}]:`, {
              id: rule.id,
              type: rule.type,
              label: rule.label,
              zipPrefix: rule.zipPrefix,
              zipPrefixType: typeof rule.zipPrefix,
              zipPrefixLength: rule.zipPrefix?.length,
              fee: rule.fee,
              freeOverAmount: rule.freeOverAmount,
            });
          });
        }
      });
    }
    return response.data;
  }

  async getShippingPolicy(policyId: number): Promise<JsonBody<ShippingPolicyResponse>> {
    const response = await this.client.get(`/api/v1/admin/policies/shipping/${policyId}`);
    return response.data;
  }

  async getActiveShippingPolicies(): Promise<JsonBody<ShippingPolicyResponse[]>> {
    const response = await this.client.get('/api/v1/admin/policies/shipping/active');
    return response.data;
  }

  async createShippingPolicy(
    data: ShippingPolicyCreateRequest
  ): Promise<JsonBody<ShippingPolicy>> {
    console.log('[createShippingPolicy] 요청 데이터:', JSON.stringify(data, null, 2));
    const response = await this.client.post('/api/v1/admin/policies/shipping', data);
    return response.data;
  }

  async deleteShippingPolicy(policyId: number): Promise<JsonBody<void>> {
    const response = await this.client.delete(`/api/v1/admin/policies/shipping/${policyId}`);
    return response.data;
  }

  async deleteShippingRule(ruleId: number): Promise<JsonBody<void>> {
    const response = await this.client.delete(`/api/v1/admin/policies/shipping/rules/${ruleId}`);
    return response.data;
  }

  async createShippingRule(
    data: ShippingRuleCreateRequest
  ): Promise<JsonBody<ShippingRuleResponse>> {
    console.log('[createShippingRule] ========== 요청 시작 ==========');
    console.log('[createShippingRule] 요청 데이터 (JSON):', JSON.stringify(data, null, 2));
    console.log('[createShippingRule] 요청 데이터 (객체):', data);
    console.log('[createShippingRule] 데이터 타입 확인:', {
      policyId: { value: data.policyId, type: typeof data.policyId, isNumber: typeof data.policyId === 'number' },
      type: { value: data.type, type: typeof data.type },
      label: { value: data.label, type: typeof data.label },
      zipPrefix: { value: data.zipPrefix, type: typeof data.zipPrefix },
      fee: { value: data.fee, type: typeof data.fee },
      freeOverAmount: { value: data.freeOverAmount, type: typeof data.freeOverAmount },
      active: { value: data.active, type: typeof data.active },
    });
    
    // 데이터 검증
    if (!data.policyId || typeof data.policyId !== 'number') {
      console.error('[createShippingRule] policyId 검증 실패:', data.policyId);
    }
    if (!data.type) {
      console.error('[createShippingRule] type 검증 실패:', data.type);
    }
    if (!data.label || data.label.trim() === '') {
      console.error('[createShippingRule] label 검증 실패:', data.label);
    }
    
    try {
      const response = await this.client.post('/api/v1/admin/policies/shipping/rules', data);
      console.log('[createShippingRule] 응답 성공:', response.data);
      console.log('[createShippingRule] ========== 요청 완료 ==========');
      return response.data;
    } catch (error: any) {
      console.error('[createShippingRule] ========== 에러 발생 ==========');
      console.error('[createShippingRule] 요청 URL:', '/api/v1/admin/policies/shipping/rules');
      console.error('[createShippingRule] 요청 데이터 (JSON):', JSON.stringify(data, null, 2));
      console.error('[createShippingRule] 요청 데이터 (객체):', data);
      console.error('[createShippingRule] 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
      });
      console.error('[createShippingRule] 전체 에러 객체:', error);
      console.error('[createShippingRule] 에러 스택:', error.stack);
      
      // 서버 응답이 있는 경우 상세 정보 출력
      if (error.response?.data) {
        console.error('[createShippingRule] 서버 응답 상세:', {
          status: error.response.status,
          data: error.response.data,
          message: error.response.data.message,
          error: error.response.data.error,
        });
      }
      
      console.error('[createShippingRule] ===============================');
      throw error;
    }
  }

  // Policy APIs - Discount
  async getDiscountPolicies(): Promise<JsonBody<DiscountPolicyResponse[]>> {
    const response = await this.client.get('/api/v1/admin/policies/discount');
    return response.data;
  }

  async getDiscountPolicy(policyId: number): Promise<JsonBody<DiscountPolicyResponse>> {
    const response = await this.client.get(`/api/v1/admin/policies/discount/${policyId}`);
    return response.data;
  }

  async getActiveDiscountPolicies(): Promise<JsonBody<DiscountPolicyResponse[]>> {
    const response = await this.client.get('/api/v1/admin/policies/discount/active');
    return response.data;
  }

  async createDiscountPolicy(
    data: DiscountPolicyCreateRequest
  ): Promise<JsonBody<DiscountPolicy>> {
    const response = await this.client.post('/api/v1/admin/policies/discount', data);
    return response.data;
  }

  async deleteDiscountPolicy(policyId: number): Promise<JsonBody<void>> {
    const response = await this.client.delete(`/api/v1/admin/policies/discount/${policyId}`);
    return response.data;
  }

  async deleteDiscountRule(ruleId: number): Promise<JsonBody<void>> {
    const response = await this.client.delete(`/api/v1/admin/policies/discount/rules/${ruleId}`);
    return response.data;
  }

  async createDiscountRule(
    data: DiscountRuleCreateRequest
  ): Promise<JsonBody<DiscountRuleResponse>> {
    console.log('[createDiscountRule] ========== 요청 시작 ==========');
    console.log('[createDiscountRule] 요청 데이터 (JSON):', JSON.stringify(data, null, 2));
    console.log('[createDiscountRule] 요청 데이터 (객체):', data);
    console.log('[createDiscountRule] 데이터 타입 확인:', {
      policyId: { value: data.policyId, type: typeof data.policyId },
      type: { value: data.type, type: typeof data.type },
      targetProductId: { value: data.targetProductId, type: typeof data.targetProductId },
      label: { value: data.label, type: typeof data.label },
      discountRate: { value: data.discountRate, type: typeof data.discountRate },
      amountOff: { value: data.amountOff, type: typeof data.amountOff },
      active: { value: data.active, type: typeof data.active },
    });
    
    try {
      const response = await this.client.post('/api/v1/admin/policies/discount/rules', data);
      console.log('[createDiscountRule] 응답 성공:', response.data);
      console.log('[createDiscountRule] ========== 요청 완료 ==========');
      return response.data;
    } catch (error: any) {
      console.error('[createDiscountRule] ========== 에러 발생 ==========');
      console.error('[createDiscountRule] 요청 URL:', '/api/v1/admin/policies/discount/rules');
      console.error('[createDiscountRule] 요청 데이터 (JSON):', JSON.stringify(data, null, 2));
      console.error('[createDiscountRule] 요청 데이터 (객체):', data);
      console.error('[createDiscountRule] 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
      });
      
      // 서버 응답 상세 정보 출력
      if (error.response?.data) {
        const responseData = error.response.data;
        
        // 전체 응답 데이터를 JSON으로 출력
        console.error('[createDiscountRule] 서버 응답 전체 (JSON):', JSON.stringify(responseData, null, 2));
        console.error('[createDiscountRule] 서버 응답 상세:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: responseData,
          dataType: typeof responseData,
          dataKeys: responseData ? Object.keys(responseData) : [],
          message: responseData.message,
          error: responseData.error,
          exception: responseData.exception,
          path: responseData.path,
          timestamp: responseData.timestamp,
        });
        
        // 응답 데이터의 모든 속성 출력
        if (responseData && typeof responseData === 'object') {
          console.error('[createDiscountRule] 응답 데이터 속성:', Object.keys(responseData));
          for (const key in responseData) {
            if (responseData.hasOwnProperty(key)) {
              console.error(`[createDiscountRule] ${key}:`, responseData[key]);
            }
          }
        }
        
        // 스택 트레이스가 있으면 출력
        if (responseData.trace) {
          console.error('[createDiscountRule] 스택 트레이스 (일부):', responseData.trace.substring(0, 1000));
        }
        
        // 필드별 에러가 있으면 출력
        if (responseData.errors) {
          console.error('[createDiscountRule] 필드별 에러:', responseData.errors);
        }
      } else {
        console.error('[createDiscountRule] 네트워크 에러 또는 응답 없음');
        console.error('[createDiscountRule] 에러 메시지:', error.message);
      }
      
      // 응답 헤더도 확인
      if (error.response?.headers) {
        console.error('[createDiscountRule] 응답 헤더:', error.response.headers);
      }
      
      console.error('[createDiscountRule] 전체 에러 객체:', error);
      console.error('[createDiscountRule] ===============================');
      throw error;
    }
  }

  async updateDiscountRule(
    ruleId: number,
    data: DiscountRuleUpdateRequest
  ): Promise<JsonBody<DiscountRuleResponse>> {
    console.log('[updateDiscountRule] ========== 요청 시작 ==========');
    console.log('[updateDiscountRule] 요청 URL:', `/api/v1/admin/policies/rules/${ruleId}`);
    console.log('[updateDiscountRule] 룰 ID:', ruleId);
    console.log('[updateDiscountRule] 요청 데이터 (JSON):', JSON.stringify(data, null, 2));
    console.log('[updateDiscountRule] 요청 데이터 (객체):', data);
    
    try {
      const response = await this.client.put(`/api/v1/admin/policies/rules/${ruleId}`, data);
      console.log('[updateDiscountRule] 응답 성공:', response.data);
      console.log('[updateDiscountRule] ========== 요청 완료 ==========');
      return response.data;
    } catch (error: any) {
      console.error('[updateDiscountRule] ========== 에러 발생 ==========');
      console.error('[updateDiscountRule] 요청 URL:', `/api/v1/admin/policies/rules/${ruleId}`);
      console.error('[updateDiscountRule] 룰 ID:', ruleId);
      console.error('[updateDiscountRule] 요청 데이터 (JSON):', JSON.stringify(data, null, 2));
      console.error('[updateDiscountRule] 요청 데이터 (객체):', data);
      console.error('[updateDiscountRule] 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
      });
      
      // 서버 응답 상세 정보 출력
      if (error.response?.data) {
        const responseData = error.response.data;
        
        // 전체 응답 데이터를 JSON으로 출력
        console.error('[updateDiscountRule] 서버 응답 전체 (JSON):', JSON.stringify(responseData, null, 2));
        console.error('[updateDiscountRule] 서버 응답 상세:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: responseData,
          dataType: typeof responseData,
          dataKeys: responseData ? Object.keys(responseData) : [],
          message: responseData.message,
          error: responseData.error,
          exception: responseData.exception,
          path: responseData.path,
          timestamp: responseData.timestamp,
        });
        
        // 응답 데이터의 모든 속성 출력
        if (responseData && typeof responseData === 'object') {
          console.error('[updateDiscountRule] 응답 데이터 속성:', Object.keys(responseData));
          for (const key in responseData) {
            if (responseData.hasOwnProperty(key)) {
              console.error(`[updateDiscountRule] ${key}:`, responseData[key]);
            }
          }
        }
        
        // 스택 트레이스가 있으면 출력
        if (responseData.trace) {
          console.error('[updateDiscountRule] 스택 트레이스 (일부):', responseData.trace.substring(0, 1000));
        }
        
        // 필드별 에러가 있으면 출력
        if (responseData.errors) {
          console.error('[updateDiscountRule] 필드별 에러:', responseData.errors);
        }
      } else {
        console.error('[updateDiscountRule] 네트워크 에러 또는 응답 없음');
        console.error('[updateDiscountRule] 에러 메시지:', error.message);
      }
      
      // 응답 헤더도 확인
      if (error.response?.headers) {
        console.error('[updateDiscountRule] 응답 헤더:', error.response.headers);
      }
      
      console.error('[updateDiscountRule] 전체 에러 객체:', error);
      console.error('[updateDiscountRule] ===============================');
      throw error;
    }
  }

  // Admin - Review Match APIs
  async getReviewMatches(): Promise<JsonBody<ReviewMatchListResponse>> {
    const response = await this.client.get('/api/v1/admin/review-matches/review');
    return response.data;
  }

  async confirmReviewMatch(
    reviewMatchId: number,
    data: ReviewConfirmRequest
  ): Promise<JsonBody<ReviewConfirmResponse>> {
    const response = await this.client.post(`/api/v1/admin/review-matches/${reviewMatchId}/confirm`, data);
    return response.data;
  }

  // Admin - Inventory APIs
  async adjustStock(data: AdminStockAdjustRequest): Promise<JsonBody<void>> {
    const response = await this.client.post('/api/v1/admin/inventory/adjust', data);
    return response.data;
  }

  async getStockHistory(
    productId: number,
    params?: { page?: number; size?: number }
  ): Promise<JsonBody<PageStockHistory>> {
    const response = await this.client.get(`/api/v1/admin/inventory/${productId}/history`, { params });
    return response.data;
  }

  async getRiskyInventory(): Promise<JsonBody<any[]>> {
    const response = await this.client.get('/api/v1/admin/inventory/risky');
    return response.data;
  }

  // Admin - Feature Flag APIs
  async getFeatures(): Promise<JsonBody<FeatureFlagResponse[]>> {
    const response = await this.client.get('/api/v1/admin/features');
    return response.data;
  }

  async toggleFeature(key: FeatureKey, enabled: boolean): Promise<JsonBody<void>> {
    const response = await this.client.put(`/api/v1/admin/features/${key}`, null, {
      params: { enabled },
    });
    return response.data;
  }

  // Admin - Sales Stats APIs
  async getDailySalesStats(from: string, to: string): Promise<JsonBody<SalesStatRow[]>> {
    const response = await this.client.get('/api/v1/admin/sales-stats/daily', {
      params: { from, to },
    });
    return response.data;
  }

  async getWeeklySalesStats(from: string, to: string): Promise<JsonBody<SalesStatRow[]>> {
    const response = await this.client.get('/api/v1/admin/sales-stats/weekly', {
      params: { from, to },
    });
    return response.data;
  }

  async getMonthlySalesStats(from: string, to: string): Promise<JsonBody<SalesStatRow[]>> {
    const response = await this.client.get('/api/v1/admin/sales-stats/monthly', {
      params: { from, to },
    });
    return response.data;
  }
}

export const apiService = new ApiService();
