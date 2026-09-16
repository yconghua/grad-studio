-- 讨论区帖子表（协同办公 → 讨论区）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `forum_post` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`       VARCHAR(200) NOT NULL                COMMENT '帖子标题',
  `content`     TEXT         NULL                    COMMENT '帖子内容',
  `type`        VARCHAR(20)  NOT NULL DEFAULT 'post' COMMENT '类型：post 帖子 / qa 问答 / share 分享',
  `author_id`   INT UNSIGNED NOT NULL                COMMENT '发帖人用户 id（软关联 user.id）',
  `view_count`  INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '浏览数',
  `reply_count` INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '回复数',
  `pinned`      TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '是否置顶（0 否 1 是）',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_author_id` (`author_id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='讨论区帖子表';
