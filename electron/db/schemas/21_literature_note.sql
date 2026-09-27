-- 阅读笔记表：文献阅读笔记（与文献多对一）
-- 幂等：重复执行无副作用。
-- 说明：一条文献可有多条笔记；内容为核心观点 / 摘录 / 思考等。
CREATE TABLE IF NOT EXISTS `literature_note` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `literature_id` INT UNSIGNED NOT NULL                COMMENT '文献 literature.id',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '笔记人 user.id',
  `content`       TEXT                                 COMMENT '笔记内容',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_literature` (`literature_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='阅读笔记表';
