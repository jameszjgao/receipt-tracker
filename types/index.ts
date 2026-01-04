// 小票状态
export type ReceiptStatus = 'pending' | 'processing' | 'confirmed';

// 商品用途
export type ItemPurpose = 'Personnel' | 'Business';

// 消费分类
export interface Category {
  id: string;
  householdId: string;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 支付账户
export interface PaymentAccount {
  id: string;
  householdId: string;
  name: string;
  isAiRecognized: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 小票商品项
export interface ReceiptItem {
  id?: string;
  name: string;
  categoryId: string;
  category?: Category; // 关联的分类对象
  purpose: ItemPurpose;
  price: number;
  isAsset: boolean;
  confidence?: number; // AI识别置信度
}

// 小票数据
export interface Receipt {
  id?: string;
  householdId: string;
  storeName: string;
  totalAmount: number;
  date: string;
  paymentAccountId?: string;
  paymentAccount?: PaymentAccount; // 关联的支付账户对象
  status: ReceiptStatus;
  imageUrl?: string;
  items: ReceiptItem[];
  createdAt?: string;
  updatedAt?: string;
  processedBy?: string;
  confidence?: number; // 整体识别置信度
}

// 用户数据
export interface User {
  id: string;
  email: string;
  householdId: string;
  createdAt?: string;
}

// 家庭账户
export interface Household {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

// Gemini识别结果（使用分类名称，后续会匹配到分类ID）
export interface GeminiReceiptResult {
  storeName: string;
  date: string;
  totalAmount: number;
  currency?: string; // 币种，如：CNY、USD
  paymentAccountName?: string; // 支付账户，包含卡号尾号信息
  tax?: number; // 税费
  items: Array<{
    name: string;
    categoryName: string; // 分类名称，从[食品,外餐, 居家, 交通, 购物, 医疗, 教育]中选择
    price: number;
    purpose?: ItemPurpose; // 可选，如果AI没有识别则默认为Personnel
    isAsset?: boolean; // 可选
    confidence?: number; // 可选
  }>;
  confidence?: number; // 可选，整体识别置信度
}

