-- 课题组公告表：课题组公告（组管新增 / 编辑 / 删除 / 置顶，导师与学生只读）
-- 幂等：重复执行无副作用。
-- 说明：未读红点 = 公告数 - 已读记录数（见 notice_read 表）；
--   置顶通过 is_top 标记，列表排序：置顶优先、发布时间倒序。
CREATE TABLE IF NOT EXISTS `notice` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `meeting_id`    INT UNSIGNED DEFAULT NULL            COMMENT '关联组会 meeting.id（组会发布时自动生成的公告）',
  `title`         VARCHAR(200) NOT NULL                COMMENT '公告标题',
  `content`       TEXT                                 COMMENT '公告正文',
  `is_top`        TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '是否置顶：1 置顶 / 0 普通',
  `publisher_id`  INT UNSIGNED NOT NULL                COMMENT '发布人 user.id（课题组管理员）',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active 生效中 / archived 已归档',
  `published_at`  DATETIME                             COMMENT '发布时间（默认取创建时间）',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_group_top` (`group_id`, `is_top`),
  KEY `idx_meeting` (`meeting_id`),
  KEY `idx_publisher` (`publisher_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题组公告表';
