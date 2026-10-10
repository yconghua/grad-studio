-- 工具箱 · DOI 文献信息查询缓存（26）
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 设计约定：
--   - 按 user_id 隔离：导师/学生各自的 DOI 查询结果互不可见；
--   - query_key = 归一化查询键的 MD5（DOI / 标题 / PMID），跨源合并后的结果整包缓存；
--   - payload 为多源合并后的 JSON（含字段来源标注），sources 为命中的源列表。
CREATE TABLE IF NOT EXISTS `tool_doi_cache` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '缓存ID',
  `user_id`    BIGINT       NOT NULL COMMENT '用户ID（学生/导师，隔离依据）',
  `query_key`  CHAR(32)     NOT NULL COMMENT '查询键MD5（DOI/标题/PMID 归一化）',
  `query_type` VARCHAR(10)  NOT NULL DEFAULT 'doi' COMMENT '查询类型：doi/title/pmid',
  `payload`    MEDIUMTEXT   NOT NULL COMMENT '多源合并结果JSON（含字段来源标注）',
  `sources`    VARCHAR(200) DEFAULT NULL COMMENT '命中的数据源列表（逗号分隔）',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_key` (`user_id`, `query_key`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱DOI查询缓存';
