-- ============================================
-- 确保一个家庭与一个email只能有一条邀请记录
-- 添加唯一约束并使用UPSERT逻辑
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：清理可能的重复数据（保留最新的一条）
-- 如果有重复记录，只保留created_at最新的那条
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- 查找重复记录的数量（只计算数量，不需要返回具体列）
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT household_id, LOWER(TRIM(invitee_email)) as normalized_email
    FROM household_invitations
    WHERE LOWER(TRIM(invitee_email)) IS NOT NULL
    GROUP BY household_id, LOWER(TRIM(invitee_email))
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate invitation groups, cleaning up...', duplicate_count;
    
    -- 删除重复记录，只保留每组中created_at最新的那条
    DELETE FROM household_invitations
    WHERE id NOT IN (
      SELECT DISTINCT ON (household_id, LOWER(TRIM(invitee_email)))
        id
      FROM household_invitations
      WHERE LOWER(TRIM(invitee_email)) IS NOT NULL
      ORDER BY household_id, LOWER(TRIM(invitee_email)), created_at DESC
    );
    
    RAISE NOTICE 'Cleanup completed. Removed duplicate invitations.';
  ELSE
    RAISE NOTICE 'No duplicate invitations found.';
  END IF;
END $$;

-- 第二步：添加唯一约束（household_id + invitee_email）
-- 注意：使用LOWER(TRIM(invitee_email))确保email比较不区分大小写和空格
-- 由于PostgreSQL不支持函数索引作为唯一约束，我们创建一个唯一索引
-- 并添加一个CHECK约束来确保数据一致性

-- 先删除可能存在的旧约束
ALTER TABLE household_invitations 
  DROP CONSTRAINT IF EXISTS unique_household_invitee_email;

-- 创建唯一索引（基于household_id和标准化的email）
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_invitations_unique_email 
  ON household_invitations (household_id, LOWER(TRIM(invitee_email)));

-- 添加注释说明这个索引的唯一性约束作用
COMMENT ON INDEX idx_household_invitations_unique_email IS 
  'Ensures only one invitation per household-email combination';

-- 第三步：更新RPC函数，使用UPSERT逻辑（先查找，存在则更新，不存在则插入）
-- 注意：由于唯一索引是表达式索引，不能直接在ON CONFLICT中使用，所以使用先查找后更新的方式
CREATE OR REPLACE FUNCTION create_household_invitation(
  p_household_id UUID,
  p_inviter_id UUID,
  p_inviter_email TEXT,
  p_invitee_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_normalized_email TEXT := LOWER(TRIM(p_invitee_email));
  v_existing_id UUID;
  v_existing_status TEXT;
BEGIN
  -- 先检查是否已存在记录（基于household_id + normalized email）
  -- 只查找一条记录（由于唯一约束，应该只有一条）
  SELECT id, status INTO v_existing_id, v_existing_status
  FROM household_invitations
  WHERE household_id = p_household_id
    AND LOWER(TRIM(invitee_email)) = v_normalized_email
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- 如果已存在，更新现有记录：重置为pending状态，更新邀请者信息
    -- 无论之前是什么状态（accepted, declined, cancelled, removed），都重置为pending（重新邀请）
    UPDATE household_invitations
    SET
      status = 'pending',
      inviter_id = p_inviter_id,
      inviter_email = p_inviter_email,
      created_at = NOW(),  -- 更新创建时间，表示重新邀请
      accepted_at = NULL   -- 清除之前的接受时间
    WHERE id = v_existing_id
    RETURNING id INTO v_invitation_id;
    
    RAISE NOTICE 'Updated existing invitation: % (previous status: %)', v_existing_id, v_existing_status;
  ELSE
    -- 如果不存在，创建新记录
    INSERT INTO household_invitations (
      household_id,
      inviter_id,
      inviter_email,
      invitee_email,
      status,
      created_at
    )
    VALUES (
      p_household_id,
      p_inviter_id,
      p_inviter_email,
      v_normalized_email,
      'pending',
      NOW()
    )
    RETURNING id INTO v_invitation_id;
    
    RAISE NOTICE 'Created new invitation: %', v_invitation_id;
  END IF;

  RETURN v_invitation_id;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_household_invitation(UUID, UUID, TEXT, TEXT) TO authenticated;

-- 第四步：创建辅助函数，基于household_id + email查找邀请
CREATE OR REPLACE FUNCTION get_invitation_by_household_email(
  p_household_id UUID,
  p_invitee_email TEXT
)
RETURNS TABLE (
  id UUID,
  household_id UUID,
  inviter_id UUID,
  inviter_email TEXT,
  invitee_email TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_email TEXT := LOWER(TRIM(p_invitee_email));
BEGIN
  RETURN QUERY
  SELECT 
    hi.id,
    hi.household_id,
    hi.inviter_id,
    hi.inviter_email,
    hi.invitee_email,
    hi.status,
    hi.created_at,
    hi.accepted_at
  FROM household_invitations hi
  WHERE hi.household_id = p_household_id
    AND LOWER(TRIM(hi.invitee_email)) = v_normalized_email
  ORDER BY hi.created_at DESC
  LIMIT 1;
END;
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION get_invitation_by_household_email(UUID, TEXT) TO authenticated;

-- 第五步：验证唯一索引和函数已创建
SELECT 
    '✅ Unique index' as status,
    indexname as index_name,
    indexdef as index_definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'household_invitations'
  AND indexname = 'idx_household_invitations_unique_email';

SELECT
    '✅ RPC functions' as status,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('create_household_invitation', 'get_invitation_by_household_email')
ORDER BY routine_name;

-- 第六步：验证数据唯一性
SELECT 
    '✅ Data integrity check' as status,
    COUNT(*) as total_invitations,
    COUNT(DISTINCT (household_id, LOWER(TRIM(invitee_email)))) as unique_household_email_pairs,
    COUNT(*) - COUNT(DISTINCT (household_id, LOWER(TRIM(invitee_email)))) as duplicates
FROM household_invitations;

