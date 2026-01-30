-- 为 categories 和 purposes 表添加 usage_count 字段
-- 用于根据使用频率对选项进行排序

-- 1. 为 categories 表添加 usage_count 字段
ALTER TABLE categories ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- 2. 为 purposes 表添加 usage_count 字段
ALTER TABLE purposes ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- 3. 创建函数：统计并更新所有 categories 的 usage_count
CREATE OR REPLACE FUNCTION update_all_category_usage_counts()
RETURNS void AS $$
BEGIN
  UPDATE categories c
  SET usage_count = COALESCE(counts.cnt, 0)
  FROM (
    SELECT ri.category_id, COUNT(*) as cnt
    FROM receipt_items ri
    JOIN receipts r ON ri.receipt_id = r.id
    GROUP BY ri.category_id
  ) counts
  WHERE c.id = counts.category_id;
  
  -- 将没有使用记录的分类设为0
  UPDATE categories
  SET usage_count = 0
  WHERE id NOT IN (
    SELECT DISTINCT category_id FROM receipt_items WHERE category_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 创建函数：统计并更新所有 purposes 的 usage_count
CREATE OR REPLACE FUNCTION update_all_purpose_usage_counts()
RETURNS void AS $$
BEGIN
  UPDATE purposes p
  SET usage_count = COALESCE(counts.cnt, 0)
  FROM (
    SELECT ri.purpose_id, COUNT(*) as cnt
    FROM receipt_items ri
    JOIN receipts r ON ri.receipt_id = r.id
    WHERE ri.purpose_id IS NOT NULL
    GROUP BY ri.purpose_id
  ) counts
  WHERE p.id = counts.purpose_id;
  
  -- 将没有使用记录的用途设为0
  UPDATE purposes
  SET usage_count = 0
  WHERE id NOT IN (
    SELECT DISTINCT purpose_id FROM receipt_items WHERE purpose_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建函数：增加单个 category 的 usage_count
CREATE OR REPLACE FUNCTION increment_category_usage(category_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE categories
  SET usage_count = usage_count + 1
  WHERE id = category_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 创建函数：增加单个 purpose 的 usage_count
CREATE OR REPLACE FUNCTION increment_purpose_usage(purpose_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE purposes
  SET usage_count = usage_count + 1
  WHERE id = purpose_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 创建触发器函数：在 receipt_items 插入或更新时自动更新 usage_count
CREATE OR REPLACE FUNCTION update_usage_counts_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果是更新操作，先减少旧值的计数
  IF TG_OP = 'UPDATE' THEN
    -- 如果 category_id 改变了
    IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
      IF OLD.category_id IS NOT NULL THEN
        UPDATE categories SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.category_id;
      END IF;
      IF NEW.category_id IS NOT NULL THEN
        UPDATE categories SET usage_count = usage_count + 1 WHERE id = NEW.category_id;
      END IF;
    END IF;
    
    -- 如果 purpose_id 改变了
    IF OLD.purpose_id IS DISTINCT FROM NEW.purpose_id THEN
      IF OLD.purpose_id IS NOT NULL THEN
        UPDATE purposes SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.purpose_id;
      END IF;
      IF NEW.purpose_id IS NOT NULL THEN
        UPDATE purposes SET usage_count = usage_count + 1 WHERE id = NEW.purpose_id;
      END IF;
    END IF;
  END IF;
  
  -- 如果是插入操作，增加新值的计数
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NOT NULL THEN
      UPDATE categories SET usage_count = usage_count + 1 WHERE id = NEW.category_id;
    END IF;
    IF NEW.purpose_id IS NOT NULL THEN
      UPDATE purposes SET usage_count = usage_count + 1 WHERE id = NEW.purpose_id;
    END IF;
  END IF;
  
  -- 如果是删除操作，减少旧值的计数
  IF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL THEN
      UPDATE categories SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.category_id;
    END IF;
    IF OLD.purpose_id IS NOT NULL THEN
      UPDATE purposes SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.purpose_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 创建触发器
DROP TRIGGER IF EXISTS trigger_update_usage_counts ON receipt_items;
CREATE TRIGGER trigger_update_usage_counts
  AFTER INSERT OR UPDATE OR DELETE ON receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_counts_on_item_change();

-- 9. 初始化现有数据的 usage_count
SELECT update_all_category_usage_counts();
SELECT update_all_purpose_usage_counts();

-- 10. 创建索引以优化排序查询
CREATE INDEX IF NOT EXISTS idx_categories_usage_count ON categories(space_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_purposes_usage_count ON purposes(space_id, usage_count DESC);
