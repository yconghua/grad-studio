-- 工具箱 · 公司搜索历史（34）
-- 按用户记录公司搜索关键词（可带行业/城市），用于最近搜索与热门推荐。
CREATE TABLE IF NOT EXISTS `tool_company_search_history` (
  `id`           BIGINT      NOT NULL AUTO_INCREMENT COMMENT '历史ID',
  `user_id`      BIGINT      NOT NULL COMMENT '用户ID',
  `keyword`      VARCHAR(200) NOT NULL COMMENT '公司名/关键词',
  `city`         VARCHAR(50) DEFAULT NULL COMMENT '城市（岗位场景可选）',
  `result_count` INT         NOT NULL DEFAULT 0 COMMENT '合并后结果数量',
  `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱公司搜索历史';
