-- 任务 / 子任务 / 评论与变更日志（模块3 项目与任务协作 - 任务看板）
-- 看板四列由 task.status 驱动：待办 / 进行中 / 待审核 / 已完成。
-- sort_order 用于看板内拖拽排序，拖动时只改该字段。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `task` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `project_id`  INT UNSIGNED DEFAULT NULL            COMMENT '关联项目 id，空表示不挂项目',
  `title`       VARCHAR(150) NOT NULL                COMMENT '任务标题',
  `description` TEXT         DEFAULT NULL            COMMENT '任务描述',
  `assignee_id` INT UNSIGNED DEFAULT NULL            COMMENT '指派给 member.id',
  `creator_id`  INT UNSIGNED DEFAULT NULL            COMMENT '创建人 member.id',
  `priority`    VARCHAR(10)  NOT NULL DEFAULT '中'    COMMENT '优先级：高 / 中 / 低',
  `status`      VARCHAR(20)  NOT NULL DEFAULT '待办'  COMMENT '状态：待办 / 进行中 / 待审核 / 已完成',
  `sort_order`  INT          NOT NULL DEFAULT 0      COMMENT '看板内排序序号',
  `due_date`    DATETIME     DEFAULT NULL            COMMENT '截止时间',
  `finish_time` DATETIME     DEFAULT NULL            COMMENT '完成时间',
  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_project` (`project_id`),
  KEY `idx_assignee` (`assignee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_due_date` (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务表';

CREATE TABLE IF NOT EXISTS `task_subtask` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id`    INT UNSIGNED NOT NULL                COMMENT '所属任务 id',
  `title`      VARCHAR(150) NOT NULL                COMMENT '子任务标题',
  `done`       TINYINT      NOT NULL DEFAULT 0      COMMENT '是否完成：0 未完成 / 1 已完成',
  `sort_order` INT          NOT NULL DEFAULT 0      COMMENT '排序序号',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务子任务表';

CREATE TABLE IF NOT EXISTS `task_comment` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id`    INT UNSIGNED NOT NULL                COMMENT '任务 id',
  `member_id`  INT UNSIGNED DEFAULT NULL            COMMENT '操作人 member.id',
  `type`       VARCHAR(20)  NOT NULL DEFAULT '评论'  COMMENT '类型：评论 / 变更记录',
  `content`    VARCHAR(500) NOT NULL                COMMENT '内容',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务评论与变更日志表';
