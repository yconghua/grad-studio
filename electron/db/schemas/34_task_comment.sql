-- 任务评论表（任务详情 → 评论区，支持 Markdown 和 @成员）
CREATE TABLE IF NOT EXISTS `task_comment` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id`     INT UNSIGNED NOT NULL                COMMENT '关联任务 id（软关联 task.id）',
  `author_id`   INT UNSIGNED NOT NULL                COMMENT '评论人用户 id',
  `content`     TEXT         NOT NULL                COMMENT '评论内容（支持 Markdown）',
  `mentions`     VARCHAR(500) NULL DEFAULT NULL       COMMENT '被@的用户 id 列表，逗号分隔',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评论时间',
  PRIMARY KEY (`id`),
  KEY `idx_task_id` (`task_id`),
  KEY `idx_author_id` (`author_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务评论表';
