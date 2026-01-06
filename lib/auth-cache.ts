import { User, Household } from '@/types';

// 全局缓存用户和家庭信息
let cachedUser: User | null = null;
let cachedHousehold: Household | null = null;
let cacheInitialized = false;

// 初始化缓存（登录时调用）
export async function initializeAuthCache(
  user: User | null,
  household: Household | null
): Promise<void> {
  cachedUser = user;
  cachedHousehold = household;
  cacheInitialized = true;
}

// 获取缓存的用户信息
export function getCachedUser(): User | null {
  return cachedUser;
}

// 获取缓存的家庭信息
export function getCachedHousehold(): Household | null {
  return cachedHousehold;
}

// 更新缓存的用户信息
export function updateCachedUser(user: User | null): void {
  cachedUser = user;
}

// 更新缓存的家庭信息
export function updateCachedHousehold(household: Household | null): void {
  cachedHousehold = household;
}

// 清除缓存（登出时调用）
export function clearAuthCache(): void {
  cachedUser = null;
  cachedHousehold = null;
  cacheInitialized = false;
}

// 检查缓存是否已初始化
export function isCacheInitialized(): boolean {
  return cacheInitialized;
}

