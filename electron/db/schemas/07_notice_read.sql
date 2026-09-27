-- 公告已读表：记录「哪个用户已读哪条公告」（未读红点判定）
-- 幂等：重复执行无副作用。
-- 说明：同一用户对同一公告只保留一条已读记录（唯一索引）；
--   未读数 = 该用户可见公告总数 - 本表已读记录数。
CREATE TABLE IF NOT EXISTS `notice_read` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `notice_id`     INT UNSIGNED NOT NULL                COMMENT '公告 notice.id',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '已读用户 user.id',
  `read_at`       DATETIME     NOT NULL                COMMENT '阅读时间',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_notice_user` (`notice_id`, `user_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公告已读表';
