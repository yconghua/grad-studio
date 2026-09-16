-- 任务协作表（协同办公 → 任务协作）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `task` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`       VARCHAR(200) NOT NULL                COMMENT '任务标题',
  `description` TEXT         NULL                    COMMENT '任务描述',
  `project_id`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联项目 id（软关联 project.id）',
  `assignee_id` INT UNSIGNED NULL DEFAULT NULL       COMMENT '负责人用户 id（软关联 user.id）',
  `priority`    VARCHAR(10)  NOT NULL DEFAULT 'medium' COMMENT '优先级：high 高 / medium 中 / low 低',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'todo' COMMENT '状态：todo 待办 / doing 进行中 / done 已完成',
  `progress`    TINYINT UNSIGNED NOT NULL DEFAULT 0  COMMENT '进度（0-100）',
  `due_date`    DATE         NULL DEFAULT NULL       COMMENT '截止日期',
  `created_by`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_assignee_id` (`assignee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务协作表';
