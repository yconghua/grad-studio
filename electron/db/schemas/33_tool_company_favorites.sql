-- 工具箱 · 公司收藏与备注（33）
-- 按 user_id + company_key（公司名）唯一；company_snapshot 为收藏时的信息快照。
CREATE TABLE IF NOT EXISTS `tool_company_favorites` (
  `id`               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '收藏ID',
  `user_id`          BIGINT       NOT NULL COMMENT '用户ID',
  `company_key`      VARCHAR(200) NOT NULL COMMENT '公司名（唯一键）',
  `company_snapshot` MEDIUMTEXT   DEFAULT NULL COMMENT '收藏时的公司信息快照JSON',
  `note`             VARCHAR(1000) DEFAULT NULL COMMENT '备注',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_company` (`user_id`, `company_key`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱公司收藏';
