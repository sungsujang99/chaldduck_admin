// API Response wrapper
export interface JsonBody<T> {
  status: number;
  message: string;
  data: T;
}

// Customer types
export interface CustomerResponse {
  customerId: number;
  name: string;
  phone: string;
  blocked?: boolean;
  blockedReason?: string;
  blockedAt?: string;
}

export interface CustomerUpsertRequest {
  name: string;
  phone: string;
}

export interface AddressResponse {
  addressId: number;
  label: string;
  recipientName: string;
  recipientPhone: string;
  zipCode: string;
  address1: string;
  address2: string;
  isDefault: boolean;
}

export interface AddressCreateRequest {
  label: string;
  recipientName: string;
  recipientPhone: string;
  zipCode: string;
  address1: string;
  address2: string;
  isDefault?: boolean;
}

export interface AddressUpdateRequest {
  label: string;
  recipientName: string;
  recipientPhone: string;
  zipCode: string;
  address1: string;
  address2: string;
  isDefault?: boolean;
}

export interface CustomerProfileResponse {
  customer: CustomerResponse;
  blockInfo?: BlockInfo;
  addresses: AddressResponse[];
  orders?: any[];
}

// Order types
export interface OrderItemCreateRequest {
  productName: string;
  productId?: number;
  unitPrice: number;
  quantity: number;
}

export interface OrderCreateRequest {
  paymentMethod: PaymentMethod;
  items: OrderItemCreateRequest[];
  cashReceipt?: boolean;
}

export interface OrderItemResponse {
  orderItemId: number;
  productId?: number; // 상품 ID (매입가 조회용)
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type OrderStatus = 'CREATED' | 'PAID' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED';
export type FulfillmentType = 'DELIVERY' | 'PICKUP';
export type DeliveryStatus = 'NONE' | 'READY' | 'DELIVERING' | 'DELIVERED';

export interface OrderResponse {
  orderId: number;
  customerId: number;
  orderNo: string;
  status: OrderStatus;
  orderedAt?: string; // 주문 시각
  canceledBy?: 'CUSTOMER' | 'SYSTEM' | 'ADMIN';
  cancelReason?: string;
  canceledAt?: string;
  recipientName: string;
  recipientPhone: string;
  zipCode: string;
  address1: string;
  address2: string;
  address3?: string; // 건물명
  subtotalAmount: number;
  deliveryFee: number;
  discountAmount: number;
  finalAmount: number;
  cashReceipt?: boolean;
  cashReceiptNo?: string;
  fulfillmentType: FulfillmentType;
  deliveryStatus: DeliveryStatus;
  trackingNo?: string;
  paymentMethod?: PaymentMethod;
  active?: boolean;
  deletedAt?: string;
  items: OrderItemResponse[];
}

// Payment types
export type PaymentMethod = 'BANK_TRANSFER' | 'CARD';
export type PaymentStatus = 'READY' | 'PAID' | 'FAILED' | 'CANCELED';

export interface PaymentCreateRequest {
  method: PaymentMethod;
  memo?: string;
}

export interface PaymentMarkPaidRequest {
  pgPaymentKey?: string;
}

export interface PaymentResponse {
  paymentId: number;
  orderId: number;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  memo?: string;
  pgPaymentKey?: string;
}

// Bankda types
export interface BankTx {
  bkcode?: string;
  accountnum?: string;
  bkname?: string;
  bkdate?: string;
  bktime?: string;
  bkjukyo?: string;
  bkcontent?: string;
  bketc?: string;
  bkinput?: number;
  bkoutput?: number;
  bkjango?: number;
}

export interface BankdaTxResponse {
  record: number;
  description: string;
  bank: BankTx[];
}

export interface BankdaTxQuery {
  accountnum?: string;
  bkname?: string;
  bkcode?: string;
  datefrom?: string;
  dateto?: string;
  istest?: string;
  jukyo?: string;
  amount?: number;
  testMode?: boolean;
}

export interface FailSample {
  bkcode?: string;
  bkjukyo?: string;
  extractedOrderNo?: string;
  bkinput?: number;
  reason?: string;
}

export interface MatchResult {
  matched: number;
  review: number;
  failed: number;
  ignored: number;
  scanned: number;
  reasons?: Record<string, number>;
  samples?: FailSample[];
}

// Notification types
export type NotificationChannel = 'KAKAO' | 'SMS';
export type NotificationTemplateCode = 
  | 'ORDER_CREATED' 
  | 'PAYMENT_PAID' 
  | 'ORDER_COMPLETED' 
  | 'DELIVERY_DELIVERED' 
  | 'DELIVERY_STARTED' 
  | 'ORDER_CONFIRMED';
export type NotificationStatus = 'READY' | 'SUCCESS' | 'FAILED';

export interface NotificationLogResponse {
  notificationLogId: number;
  channel: NotificationChannel;
  templateCode: NotificationTemplateCode;
  status: NotificationStatus;
  recipientPhone: string;
  templateVarsJson?: string;
  failReason?: string;
}

// Product types
export type SoldOutStatus = 'IN_STOCK' | 'LOW_STOCK' | 'SOLD_OUT';
export type ProductCategory = 'RICE_CAKE' | 'CAKE' | 'BREAD' | 'COOKIE' | 'CHOCOLATE' | 'ICE_CREAM' | 'BEVERAGE' | 'GIFT_SET' | 'OTHER';
export type TaxType = 'TAXABLE' | 'TAX_EXEMPT';

export interface AdminProductStockRow {
  productId: number;
  name: string;
  price: number;
  purchasePrice?: number;
  stockQty: number;
  safetyStock: number;
  soldOutStatus: SoldOutStatus;
  active?: boolean;
  deletedAt?: string;
  category?: ProductCategory;
  categoryId?: number;    // 서버에서 반환하는 카테고리 ID
  categoryCode?: string;  // 서버에서 반환하는 카테고리 코드
  categoryName?: string;  // 서버에서 반환하는 카테고리 이름
  taxType?: TaxType;
  sortOrder?: number;
}

// 상품 정렬 순서 변경
export interface ProductOrderItem {
  productId: number;
  sortOrder: number;
}

export interface ProductReorderRequest {
  items: ProductOrderItem[];
}

export interface ProductCreateRequest {
  name: string;
  price: number;
  initialStockQty: number;
  safetyStock: number;
  purchasePrice?: number;
  categoryId?: number;  // 카테고리 ID (숫자)
  taxType?: TaxType;
}

// 카테고리 관련 타입
export interface AdminCategoryRow {
  categoryId: number;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCategoryCreateRequest {
  code: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
}

export interface StockUpdateRequest {
  stockQty: number;
  safetyStock: number;
  memo?: string;
}

export interface ProductUpdateRequest {
  purchasePrice?: number;
  price?: number;
  stockQty?: number;
  safetyStock?: number;
  active?: boolean;
}

// 하위 호환성을 위해 기존 타입 유지
export interface ProductResponse {
  productId: number;
  productName: string;
  description?: string;
  unitPrice: number;
  stock?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ProductUpdateRequest는 위에서 정의됨 (purchasePrice, price, stockQty, safetyStock, active 포함)
// 하위 호환성 타입은 ProductUpdateRequestLegacy로 분리
export interface ProductUpdateRequestLegacy {
  productName?: string;
  description?: string;
  unitPrice?: number;
  stock?: number;
  isActive?: boolean;
}

// Policy types
export type ShippingRuleType = 'ZIP_CODE_DISCOUNT' | 'FREE_OVER_AMOUNT' | 'DEFAULT_FEE';
export type DiscountRuleType = 'BANK_TRANSFER_FIXED' | 'QTY_FIXED' | 'BANK_TRANSFER_RATE' | 'QTY_RATE';

export interface ShippingPolicy {
  id: number;
  createDate: string;
  updateDate: string;
  name: string;
  startAt: string;
  endAt: string;
  active: boolean;
  rules: ShippingRule[];
}

export interface ShippingRule {
  id: number;
  createDate: string;
  updateDate: string;
  policy: ShippingPolicy;
  type: ShippingRuleType;
  label: string;
  zipPrefix?: string;
  fee?: number;
  freeOverAmount?: number;
  active: boolean;
}

export interface ShippingPolicyCreateRequest {
  name: string;
  startAt: string;
  endAt: string;
  active?: boolean;
}

export interface ShippingRuleCreateRequest {
  policyId: number;
  type: ShippingRuleType;
  label: string;
  zipCode?: string;  // 서버 API 스펙에 맞게 zipPrefix -> zipCode로 변경
  fee?: number;
  freeOverAmount?: number;
  active?: boolean;
}

export interface DiscountPolicy {
  id: number;
  createDate: string;
  updateDate: string;
  name: string;
  policyStartDate: string;
  policyEndDate: string;
  active: boolean;
  rules: DiscountRule[];
}

export type ApplyScope = 'ALL' | 'PICKUP';

export interface DiscountRule {
  id: number;
  createDate: string;
  updateDate: string;
  policy: DiscountPolicy;
  type: DiscountRuleType;
  targetProductId?: number;
  label: string;
  applyScope?: ApplyScope;
  discountRate?: number;
  amountOff?: number;
  minAmount?: number;
  minQty?: number;
  active: boolean;
  rateType?: boolean;
  fixedType?: boolean;
}

export interface DiscountPolicyCreateRequest {
  name: string;
  startAt: string;
  endAt: string;
  active?: boolean;
}

export interface DiscountRuleCreateRequest {
  policyId: number;
  type: DiscountRuleType;
  targetProductId: number; // 필수
  label: string;
  applyScope: ApplyScope; // 필수
  discountRate?: number; // RATE 타입일 때 필수
  amountOff?: number; // FIXED 타입일 때 필수
  minAmount?: number;
  minQty?: number;
  active?: boolean;
}

export interface DiscountRuleUpdateRequest {
  label?: string;
  type?: DiscountRuleType;
  targetProductId?: number;
  applyScope?: ApplyScope;
  discountRate?: number;
  amountOff?: number;
  minAmount?: number;
  minQty?: number;
  active?: boolean;
}

// Policy Response types (for GET APIs)
export interface ShippingPolicyResponse {
  id: number;
  name: string;
  startAt: string;
  endAt: string;
  active: boolean;
  rules: ShippingRuleResponse[];
}

export interface ShippingRuleResponse {
  id: number;
  policyId: number;
  type: ShippingRuleType;
  label: string;
  zipCode?: string;  // 서버 API 스펙 변경: zipPrefix -> zipCode
  fee?: number;
  freeOverAmount?: number;
  active: boolean;
}

export interface DiscountPolicyResponse {
  id: number;
  name: string;
  startAt: string;
  endAt: string;
  active: boolean;
  rules: DiscountRuleResponse[];
}

export interface DiscountRuleResponse {
  id: number;
  type: DiscountRuleType;
  targetProductId?: number;
  label: string;
  applyScope?: ApplyScope;
  discountRate?: number;
  amountOff?: number;
  minAmount?: number;
  minQty?: number;
  active: boolean;
}

// Order Pricing types
export interface PricingItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
}

export interface PricingRequest {
  paymentMethod: PaymentMethod;
  zipCode?: string;
  items: PricingItem[];
}

export interface DiscountLine {
  label: string;
  amount: number;
}

export interface ItemAvailability {
  stockQty: number;
  safetyStock: number;
  soldOutStatus: SoldOutStatus;
  orderable: boolean;
  blockReason?: string;
}

export interface ItemPricingBreakdown {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  itemSubtotal: number;
  discounts: DiscountLine[];
  itemDiscountTotal: number;
  itemFinal: number;
  availability: ItemAvailability;
}

export interface OrderPricingResponse {
  items: ItemPricingBreakdown[];
  subtotalAmount: number;
  discountAmount: number;
  deliveryFee: number;
  finalAmount: number;
}

// Review Match types
export type BankMatchStatus = 'NEW' | 'MATCHED' | 'FAILED' | 'REVIEW' | 'IGNORED';

export interface ReviewMatchRow {
  reviewMatchId: number;
  reason: string;
  bankTransactionId: number;
  bkdate: string;
  bktime: string;
  bkjukyo: string;
  amountIn: number;
  amountOut: number;
  bankMatchStatus: BankMatchStatus;
  fixedOrderId?: number;
}

export interface ReviewMatchListResponse {
  count: number;
  items: ReviewMatchRow[];
}

export interface ReviewConfirmRequest {
  orderId: number;
}

export interface ReviewConfirmResponse {
  reviewMatchId: number;
  bankTransactionId: number;
  orderId: number;
  orderStatus: string;
  bankMatchStatus: BankMatchStatus;
  message: string;
}

// Inventory types
export interface AdminStockAdjustRequest {
  productId: number;
  delta: number;
  memo?: string;
}

export type StockHistoryType = 'ORDER_DECREASE' | 'ORDER_RESTORE' | 'ADMIN_ADJUST' | 'INITIAL_SET';

export interface StockHistory {
  id: number;
  createDate: string;
  updateDate: string;
  product: {
    id: number;
    createDate: string;
    updateDate: string;
    name: string;
    price: number;
    active: boolean;
  };
  type: StockHistoryType;
  delta: number;
  afterQty: number;
  orderId?: number;
  memo?: string;
}

export interface PageStockHistory {
  totalElements: number;
  totalPages: number;
  size: number;
  content: StockHistory[];
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// Order Delivery types
export interface OrderDeliveryStartRequest {
  trackingNo: string;
}

export interface OrderCancelRequest {
  reason?: string;
}

// Feature Flag types
export type FeatureKey = 'ORDER' | 'DELIVERY_ORDER';

export interface FeatureFlagResponse {
  key: FeatureKey;
  enabled: boolean;
  description: string;
}

// Cash Receipt types
export interface CashReceiptNoUpdateRequest {
  cashReceiptNo: string;
}

// Pagination types
export interface PageableObject {
  offset: number;
  sort: SortObject;
  unpaged: boolean;
  paged: boolean;
  pageNumber: number;
  pageSize: number;
}

export interface SortObject {
  empty: boolean;
  unsorted: boolean;
  sorted: boolean;
}

export interface PageOrderResponse {
  totalElements: number;
  totalPages: number;
  size: number;
  content: OrderResponse[];
  number: number;
  sort: SortObject;
  numberOfElements: number;
  pageable: PageableObject;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// Customer List types
export interface CustomerAddressResponse {
  addressId: number;
  recipientName: string;
  recipientPhone: string;
  zipCode: string;
  address1: string;
  address2: string;
}

export interface BlockInfo {
  blocked: boolean;
  blockedReason?: string | null;
  blockedAt?: string | null;
}

export interface CustomerListResponse {
  customerId: number;
  name: string;
  phone: string;
  blocked?: boolean; // 하위 호환성을 위해 유지
  blockedReason?: string;
  blockedAt?: string;
  blockInfo?: BlockInfo; // 실제 API 응답 구조
  addresses: CustomerAddressResponse[];
}

export interface CustomerBlockUpdateRequest {
  blocked: boolean;
  reason?: string;
}

export interface PageCustomerListResponse {
  totalElements: number;
  totalPages: number;
  size: number;
  content: CustomerListResponse[];
  number: number;
  sort: SortObject;
  numberOfElements: number;
  pageable: PageableObject;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// Sales Stats types
export interface SalesAgg {
  gross: number;
  refund: number;
  net: number;
  count: number;
}

export interface SalesStatRow {
  periodStart: string; // date format
  total: SalesAgg;
  bankTransfer: SalesAgg;
  card: SalesAgg;
}