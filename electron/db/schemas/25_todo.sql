-- 个人待办：导师/学生个人轻量待办，可手动新建或由任务/组会/周报/公告一键转换
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 设计约定：
--   - 归属核心：owner_id（学生/导师，服务端注入）；group_id 仅为按组筛选的冗余；
--   - 转换单向：source_type + source_id 仅复制来源信息，不修改原模块数据；
--   - 唯一约束 uk_owner_source：同一条来源不能被同一人重复转成待办
--     （MySQL 唯一索引对 NULL 不去重，手动新建的待办 source 为空，互不影响）；
--   - 状态机：pending 待办 / done 已完成（勾掉即完，无验收/退回）；
--   - change_ts：行变更时间戳（全局刷新指纹检测用）。
CREATE TABLE IF NOT EXISTS `todos` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '待办ID',
  `owner_id`    BIGINT       NOT NULL COMMENT '归属人用户ID（学生/导师，服务端注入）',
  `group_id`    BIGINT       NOT NULL COMMENT '创建时所在课题组ID（冗余，按组筛选用）',
  `title`       VARCHAR(200) NOT NULL COMMENT '待办名称',
  `priority`    VARCHAR(10)  NOT NULL DEFAULT 'medium' COMMENT '紧急程度：low低/medium中/high高',
  `due_time`    DATETIME     DEFAULT NULL COMMENT '结束时间（全天待办存当天00:00:00）',
  `all_day`     TINYINT      NOT NULL DEFAULT 0 COMMENT '是否全天：0否，1是',
  `note`        TEXT         DEFAULT NULL COMMENT '备注（多行文本）',
  `tag`         VARCHAR(50)  DEFAULT NULL COMMENT '标签（自定义，如实验/写作/行政）',
  `remind`      VARCHAR(10)  NOT NULL DEFAULT 'none' COMMENT '提醒：none不提醒/1h提前一小时/1d提前一天',
  `source_type` VARCHAR(20)  DEFAULT NULL COMMENT '来源类型：task/meeting/report/notice（手动新建为空）',
  `source_id`   BIGINT       DEFAULT NULL COMMENT '来源记录ID（手动新建为空）',
  `status`      VARCHAR(10)  NOT NULL DEFAULT 'pending' COMMENT '状态：pending待办/done已完成',
  `done_at`     DATETIME     DEFAULT NULL COMMENT '完成时间',
  `reminded_at` DATETIME     DEFAULT NULL COMMENT '提醒发送时间（调度器去重）',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  `is_deleted`  TINYINT      NOT NULL DEFAULT 0 COMMENT '软删除标记：0正常，1已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_owner_source` (`owner_id`, `source_type`, `source_id`),
  KEY `idx_owner_status` (`owner_id`, `status`),
  KEY `idx_group` (`group_id`),
  KEY `idx_due` (`due_time`),
  KEY `idx_remind` (`remind`, `reminded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='个人待办';

-- ===== 通知类型注册 =====
-- 待办提醒通知（调度器到点推送 → 通知中心）
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'todo_remind', '待办提醒', 'task', 1, 1, 51
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'todo_remind');
