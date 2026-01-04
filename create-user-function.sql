-- ============================================
-- 创建数据库函数来创建用户和家庭（绕过 RLS）
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 创建函数：为新用户创建家庭和用户记录
-- 使用 SECURITY DEFINER 可以绕过 RLS 策略
CREATE OR REPLACE FUNCTION create_user_with_household(
  p_user_id UUID,
  p_email TEXT,
  p_household_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_final_household_name TEXT;
BEGIN
  -- 生成家庭名称
  IF p_household_name IS NULL OR p_household_name = '' THEN
    v_final_household_name := split_part(p_email, '@', 1) || '的家庭';
  ELSE
    v_final_household_name := p_household_name;
  END IF;

  -- 创建家庭
  INSERT INTO households (name)
  VALUES (v_final_household_name)
  RETURNING id INTO v_household_id;

  -- 创建用户记录（如果不存在）
  -- 使用 ON CONFLICT 来处理用户记录已存在的情况
  INSERT INTO users (id, email, household_id)
  VALUES (p_user_id, p_email, v_household_id)
  ON CONFLICT (id) 
  DO UPDATE SET 
    email = p_email,
    household_id = v_household_id;

  -- 返回家庭 ID
  RETURN v_household_id;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_user_with_household(UUID, TEXT, TEXT) TO authenticated;

-- 验证函数已创建
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_user_with_household';

