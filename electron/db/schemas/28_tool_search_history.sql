-- 工具箱 · 学术搜索聚合历史（28）
-- 按用户记录搜索历史（关键词 + 筛选条件 + 结果数），不缓存搜索全文结果；
-- filters 为筛选条件 JSON（年份范围/来源/OA/文献类型）。
CREATE TABLE IF NOT EXISTS `tool_search_history` (
  `id`           BIGINT      NOT NULL AUTO_INCREMENT COMMENT '历史ID',
  `user_id`      BIGINT      NOT NULL COMMENT '用户ID',
  `keyword`      VARCHAR(300) NOT NULL COMMENT '搜索关键词',
  `filters`      VARCHAR(500) DEFAULT NULL COMMENT '筛选条件JSON',
  `result_count` INT         NOT NULL DEFAULT 0 COMMENT '合并后结果数量',
  `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱学术搜索历史';
