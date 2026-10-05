-- 课题组公告表：公告属于课题组，仅超管/组管可发布管理，导师/学生只读可标记已读
-- 幂等：重复执行无副作用。
-- 说明：硬删除（不保留 deleted_at）；课题组被删除时由应用层级联删除本表与已读表；
--   publisher_id 仅作发布人记录（用户被删 / 取消管理员不影响公告存在）。
CREATE TABLE IF NOT EXISTS `group_notice` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '公告ID',
  `group_id`       BIGINT       NOT NULL COMMENT '所属课题组ID（组删除时级联删除）',
  `publisher_id`   BIGINT       NOT NULL COMMENT '发布人用户ID',
  `publisher_role` VARCHAR(20)  NOT NULL COMMENT '发布时角色：super_admin/group_admin',
  `title`          VARCHAR(100) NOT NULL COMMENT '公告标题',
  `content`        TEXT         NOT NULL COMMENT '公告内容',
  `is_top`         TINYINT      NOT NULL DEFAULT 0 COMMENT '是否置顶：1置顶，0普通',
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1已发布，2下架',
  `publish_time`   DATETIME     NOT NULL COMMENT '发布时间',
  `create_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_status` (`status`),
  KEY `idx_is_top` (`is_top`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题组公告表';
