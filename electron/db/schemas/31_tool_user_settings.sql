-- 工具箱 · 用户设置（31）
-- 按 user_id 唯一；api_keys 为 {source: safeStorage加密串} 的 JSON；
-- favorites / recent_used 为工具收藏与最近使用的 JSON（前端透传保存）。
CREATE TABLE IF NOT EXISTS `tool_user_settings` (
  `id`                 BIGINT       NOT NULL AUTO_INCREMENT COMMENT '设置ID',
  `user_id`            BIGINT       NOT NULL COMMENT '用户ID（导师/学生）',
  `default_citation`   VARCHAR(20)  NOT NULL DEFAULT 'gb7714' COMMENT '默认引用格式：gb7714/apa/mla/chicago/bibtex',
  `translate_engines`  VARCHAR(100) DEFAULT NULL COMMENT '默认展示的翻译引擎（逗号分隔，空=全部）',
  `api_keys`           MEDIUMTEXT   DEFAULT NULL COMMENT '各源API Key加密JSON {source: encryptedBase64}',
  `favorites`          MEDIUMTEXT   DEFAULT NULL COMMENT '收藏JSON：{tools:[], journals:[], companies:[]}',
  `recent_used`        VARCHAR(300) DEFAULT NULL COMMENT '最近使用工具JSON数组',
  `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱用户设置';
