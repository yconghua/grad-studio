-- 工具箱 · 公司搜索缓存（30）
-- 按 user_id + 公司名哈希 隔离；payload 为工商+招聘多源合并结果JSON（含来源标注）；
-- 空结果也缓存（短 TTL，由服务层决定缓存时长）。
CREATE TABLE IF NOT EXISTS `tool_company_cache` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '缓存ID',
  `user_id`    BIGINT       NOT NULL COMMENT '用户ID',
  `query_key`  CHAR(32)     NOT NULL COMMENT '公司名哈希MD5',
  `payload`    MEDIUMTEXT   NOT NULL COMMENT '多源合并结果JSON',
  `sources`    VARCHAR(200) DEFAULT NULL COMMENT '命中的数据源列表',
  `empty_hit`  TINYINT      NOT NULL DEFAULT 0 COMMENT '是否空结果缓存：0否，1是',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_key` (`user_id`, `query_key`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱公司搜索缓存';
