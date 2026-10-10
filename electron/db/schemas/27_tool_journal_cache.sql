-- 工具箱 · 期刊信息查询缓存（27）
-- 全局共享（期刊指标不因用户而异），不按 user_id 隔离；
-- query_key = 归一化期刊名或 ISSN/eISSN。
CREATE TABLE IF NOT EXISTS `tool_journal_cache` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '缓存ID',
  `query_key`  VARCHAR(120) NOT NULL COMMENT '归一化期刊名或ISSN',
  `payload`    MEDIUMTEXT   NOT NULL COMMENT '多源合并结果JSON（含字段来源标注）',
  `sources`    VARCHAR(200) DEFAULT NULL COMMENT '命中的数据源列表',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_key` (`query_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱期刊查询缓存（全局共享）';
