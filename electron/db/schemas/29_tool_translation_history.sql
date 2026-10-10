-- 工具箱 · 在线翻译历史（29）
-- 按 user_id + 原文哈希 + 目标语言 + 引擎 唯一：同原文同目标语言同引擎去重；
-- source_text / translated_text 用 MEDIUMTEXT 容纳长学术文本。
CREATE TABLE IF NOT EXISTS `tool_translation_history` (
  `id`               BIGINT      NOT NULL AUTO_INCREMENT COMMENT '历史ID',
  `user_id`          BIGINT      NOT NULL COMMENT '用户ID',
  `src_hash`         CHAR(32)    NOT NULL COMMENT '原文哈希MD5',
  `src_lang`         VARCHAR(10) NOT NULL DEFAULT 'auto' COMMENT '源语言：auto/zh/en/ja…',
  `target_lang`      VARCHAR(10) NOT NULL COMMENT '目标语言：zh/en/ja…',
  `engine`           VARCHAR(20) NOT NULL COMMENT '翻译引擎：deepl/baidu/youdao',
  `source_text`      MEDIUMTEXT  NOT NULL COMMENT '原文',
  `translated_text`  MEDIUMTEXT  NOT NULL COMMENT '译文',
  `created_at`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_src` (`user_id`, `src_hash`, `target_lang`, `engine`),
  KEY `idx_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱翻译历史';
