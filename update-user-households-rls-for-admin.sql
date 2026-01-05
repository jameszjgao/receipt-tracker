-- 更新 user_households 表的 RLS 策略以支持管理员删除其他成员
-- 在 Supabase SQL Editor 中执行此脚本

-- 删除现有的 DELETE 策略
DROP POLICY IF EXISTS "Users can delete their household associations" ON user_households;

-- 创建新的 DELETE 策略：
-- 1. 用户可以删除自己的关联（离开家庭）
-- 2. 管理员可以删除同一家庭中其他成员的关联（移除成员）
CREATE POLICY "Users can delete their household associations" ON user_households
  FOR DELETE USING (
    user_id = auth.uid()  -- 用户可以删除自己的关联
    OR EXISTS (
      -- 或者当前用户是该家庭的管理员
      SELECT 1 FROM user_households uh1
      WHERE uh1.user_id = auth.uid()
        AND uh1.household_id = user_households.household_id
        AND uh1.is_admin = TRUE
    )
  );

