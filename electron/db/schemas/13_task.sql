-- 任务主表：任务模块核心表，属于课题组，创建者即负责人/验收人
-- 幂等：重复执行无副作用。
-- 说明：
--   - 创建者（creator_id）即负责人与验收人，创建时固定为当前登录的组管/导师，无独立验收人字段；
--   - 创建者不参与任务（组管参与人=本组导师+学生，导师参与人=自己学生），验收与干活天然分离；
--   - 任务为单层结构，无父子任务关系；
--   - 软删除：is_deleted=1 且写入 deleted_at；恢复时两者清零。
--   - version 为乐观锁版本号：所有写操作必须带版本条件更新（冲突抛「任务已被他人更新」）。
CREATE TABLE IF NOT EXISTS `task` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  `group_id`      BIGINT       NOT NULL COMMENT '所属课题组ID',
  `title`         VARCHAR(100) NOT NULL COMMENT '任务标题',
  `description`   TEXT         DEFAULT NULL COMMENT '任务描述',
  `creator_id`    BIGINT       NOT NULL COMMENT '创建人ID（即负责人/验收人）',
  `creator_role`  VARCHAR(20)  NOT NULL COMMENT '创建角色：group_admin/mentor',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1待办 2进行中 3待验收 4已完成 5已取消',
  `priority`      TINYINT      NOT NULL DEFAULT 2 COMMENT '优先级：1低 2中 3高 4紧急',
  `start_time`    DATETIME     DEFAULT NULL COMMENT '开始时间',
  `due_time`      DATETIME     DEFAULT NULL COMMENT '截止时间',
  `finish_time`   DATETIME     DEFAULT NULL COMMENT '完成时间',
  `visible_scope` TINYINT      NOT NULL DEFAULT 1 COMMENT '可见范围（保留字段，本期固定为1）',
  `progress`      INT          NOT NULL DEFAULT 0 COMMENT '进度百分比 0-100',
  `sort_order`    INT          NOT NULL DEFAULT 0 COMMENT '排序值（保留）',
  `version`       INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本号（写操作必须带版本条件）',
  `is_deleted`    TINYINT      NOT NULL DEFAULT 0 COMMENT '软删除标记：0正常，1已删除',
  `deleted_at`    DATETIME     DEFAULT NULL COMMENT '删除时间（软删写入，恢复清零）',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  KEY `idx_group_status_due` (`group_id`, `status`, `due_time`),
  KEY `idx_creator_status` (`creator_id`, `status`, `is_deleted`),
  KEY `idx_deleted` (`is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务主表（创建者即负责人/验收人）';
