-- 讨论区回复表（协同办公 → 讨论区）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `forum_reply` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `post_id`    INT UNSIGNED NOT NULL                COMMENT '帖子 id（软关联 forum_post.id）',
  `parent_id`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '父回复 id（楼中楼，NULL=直接回复帖子）',
  `content`    TEXT         NOT NULL                COMMENT '回复内容',
  `author_id`  INT UNSIGNED NOT NULL                COMMENT '回复人用户 id（软关联 user.id）',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '回复时间',
  PRIMARY KEY (`id`),
  KEY `idx_post_id` (`post_id`),
  KEY `idx_author_id` (`author_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='讨论区回复表';
